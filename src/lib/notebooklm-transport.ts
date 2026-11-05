import undici, { Agent } from "undici";
import { CHAT_REQUEST_ID, isChatStatus, publicChatStatus } from "./chat-types";
import { chatSession } from "./chat-session";

// Pair Undici's fetch with its own Agent: Node's bundled version can differ.
// Reserve connections for status/cancel while the answer request stays open.
const dispatcher = new Agent({
  connect: { family: 4, autoSelectFamily: false, timeout: 15_000 },
  connections: 8,
  pipelining: 1,
});

export function chatError(message: string, status: number, retryAfter?: string | null) {
  return Response.json({ error: message }, {
    status,
    headers: { "Cache-Control": "no-store", ...(retryAfter && /^\d{1,5}$/.test(retryAfter) ? { "Retry-After": retryAfter } : {}) },
  });
}

export function validChatOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const supplied = new URL(origin);
    const url = new URL(request.url);
    // Next can normalize an incoming IP/custom hostname to localhost internally.
    // Host is browser-controlled by the destination, unlike X-Forwarded-Host.
    const host = request.headers.get("host") ?? url.host;
    const protocol = request.headers.get("x-forwarded-proto") === "https" ? "https:" : url.protocol;
    return supplied.origin === origin && supplied.host === host && supplied.protocol === protocol;
  } catch { return false; }
}

export function chatUpstream(path: string) {
  const apiKey = process.env.NOTEBOOKLM_API_KEY;
  const url = new URL(path, process.env.NOTEBOOKLM_API_URL);
  if (url.protocol !== "https:" || !apiKey || apiKey.length < 32) throw new Error("Chat is not configured");
  return { url, apiKey };
}

export function fetchChat(url: URL, apiKey: string, options: { method: "GET" | "POST" | "DELETE"; body?: string; timeout: number; session?: string; async?: boolean; appAccessToken?: string; appUserId?: string }) {
  return undici.fetch(url, {
    method: options.method,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", Authorization: `Bearer ${apiKey}`,
      ...(options.session ? { "X-Chat-Session": options.session } : {}), ...(options.async ? { Prefer: "respond-async" } : {}),
      ...(options.appAccessToken ? { "X-App-Authorization": `Bearer ${options.appAccessToken}` } : {}),
      ...(options.appUserId ? { "X-App-User-Id": options.appUserId } : {}) },
    body: options.body,
    signal: AbortSignal.timeout(options.timeout),
    redirect: "error",
    dispatcher,
  });
}

export async function chatControl(request: Request, requestId: string, action: "status" | "cancel") {
  if (!validChatOrigin(request)) return chatError("이 페이지에서 다시 이용해주세요.", 403);
  if (!CHAT_REQUEST_ID.test(requestId)) return chatError("질문 정보를 확인해주세요.", 400);
  const session = chatSession(request);
  if (!session) return chatError("대화를 다시 불러온 뒤 이용해주세요.", 401);
  let config: ReturnType<typeof chatUpstream>;
  try { config = chatUpstream(`/chat/${requestId}/${action}`); }
  catch { return chatError("채팅 연결을 준비 중이에요.", 503); }
  try {
    const response = await fetchChat(config.url, config.apiKey, { method: action === "status" ? "GET" : "POST", timeout: 25_000, session: session.value });
    if (!response.ok) {
      if (response.status === 404) return chatError("요청을 찾지 못했어요. 대화를 다시 불러와주세요.", 404);
      if (response.status === 429) return chatError("잠시 후 다시 시도해주세요.", 429, response.headers.get("retry-after"));
      return chatError(action === "cancel" ? "생성을 중지하지 못했어요. 다시 눌러주세요." : "생성 상태를 확인하지 못했어요.", 502);
    }
    const status: unknown = await response.json();
    if (!isChatStatus(status) || status.request_id !== requestId) return chatError("생성 상태를 읽지 못했어요.", 502);
    // Never forward opaque generation tokens or arbitrary upstream fields.
    return Response.json(publicChatStatus(status), { status: response.status === 202 ? 202 : 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    return chatError(action === "cancel" ? "중지 요청을 확인하지 못했어요. 다시 눌러주세요." : "생성 상태를 확인하지 못했어요.", 502);
  }
}

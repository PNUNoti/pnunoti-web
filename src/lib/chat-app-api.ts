import { CHAT_REQUEST_ID } from "./chat-types";
import { chatSession } from "./chat-session";
import { chatError, chatUpstream, fetchChat, validChatOrigin } from "./notebooklm-transport";

export const APP_TICKET = /^[A-Za-z0-9_-]{43}$/;

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 2048) { await reader.cancel(); throw new Error(); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let at = 0;
  for (const value of chunks) { bytes.set(value, at); at += value.byteLength; }
  const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
  return body as Record<string, unknown>;
}

export async function appChatConnection(request: Request, resume: boolean) {
  if (!validChatOrigin(request)) return chatError("앱에서 다시 이용해주세요.", 403);
  let body: Record<string, unknown>;
  try { body = await readBody(request); }
  catch { return chatError("알림 연결 정보를 확인해주세요.", 400); }
  if (typeof body.request_id !== "string" || !CHAT_REQUEST_ID.test(body.request_id)) return chatError("질문 정보를 확인해주세요.", 400);
  const allowed = resume ? ["request_id", "ticket"] : ["request_id", "push_token", "purpose"];
  if (Object.keys(body).some((key) => !allowed.includes(key))) return chatError("알림 연결 정보를 확인해주세요.", 400);
  const accessToken = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9_.-]{20,8192})$/)?.[1];
  const appUserId = request.headers.get("x-app-user-id");
  if (resume) {
    if (body.ticket === undefined ? !appUserId || !CHAT_REQUEST_ID.test(appUserId) : typeof body.ticket !== "string" || !APP_TICKET.test(body.ticket)) return chatError("대화 연결이 만료됐어요. 알림을 다시 눌러주세요.", 400);
  } else {
    if (!accessToken) return chatError("앱 로그인이 필요해요.", 401);
    const hasToken = body.push_token !== undefined;
    if ((hasToken && (typeof body.push_token !== "string" || !/^(?:ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{8,200}\]$/.test(body.push_token))) ||
      (body.purpose === "notify" && !hasToken) ||
      !["notify", "resume", "identity"].includes(String(body.purpose))) return chatError("알림 연결 정보를 확인해주세요.", 400);
  }
  const session = resume ? chatSession(request, true)! : null;
  try {
    const config = chatUpstream(resume ? "/chat/app-resume" : "/chat/app-session");
    const response = await fetchChat(config.url, config.apiKey, {
      method: "POST", timeout: 15_000, body: JSON.stringify(body), session: session?.value,
      appAccessToken: resume ? undefined : accessToken,
      appUserId: resume ? appUserId ?? undefined : undefined,
    });
    if (!response.ok) {
      const status = [400,401,403,404,409,429,503].includes(response.status) ? response.status : 502;
      return chatError(resume ? "답변을 불러오지 못했어요. 앱 로그인 상태를 확인한 뒤 알림을 다시 눌러주세요." : "완료 알림을 연결하지 못했어요.", status);
    }
    const data = await response.json() as Record<string, unknown>;
    const headers = { "Cache-Control": "no-store", ...(session?.cookie ? { "Set-Cookie": session.cookie } : {}) };
    if (resume) {
      if (typeof data.conversation_id !== "string" || !CHAT_REQUEST_ID.test(data.conversation_id) || data.request_id !== body.request_id) throw new Error();
      return Response.json({ conversation_id: data.conversation_id, request_id: data.request_id }, { headers });
    }
    if (typeof data.ticket !== "string" || !APP_TICKET.test(data.ticket)) throw new Error();
    return Response.json({ ticket: data.ticket }, { headers });
  } catch { return chatError("알림 연결을 준비하지 못했어요. 잠시 후 다시 시도해주세요.", 503); }
}

export async function appChatIdentity(request: Request) {
  if (!validChatOrigin(request)) return chatError("이 페이지에서 다시 이용해주세요.", 403);
  const session = chatSession(request);
  if (!session) return chatError("대화를 먼저 불러와주세요.", 401);
  let body: Record<string, unknown> | undefined;
  if (request.method !== "DELETE") {
    try { body = await readBody(request); } catch { return chatError("앱 연결 정보를 확인해주세요.", 400); }
    if (Object.keys(body).some(key => !["request_id", "ticket"].includes(key)) ||
      typeof body.request_id !== "string" || !CHAT_REQUEST_ID.test(body.request_id) ||
      typeof body.ticket !== "string" || !APP_TICKET.test(body.ticket)) return chatError("앱 연결 정보를 확인해주세요.", 400);
  }
  try {
    const config = chatUpstream("/chat/app-identity");
    const response = await fetchChat(config.url, config.apiKey, { method: request.method === "DELETE" ? "DELETE" : "POST",
      timeout: 15_000, session: session.value, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) return chatError("앱 로그인 상태를 확인해주세요.", [400,401,403,409,429,503].includes(response.status) ? response.status : 502);
    if (!body) return Response.json({ cleared: true }, { headers: { "Cache-Control": "no-store" } });
    const data = await response.json() as Record<string, unknown>;
    if (typeof data.user_id !== "string" || !CHAT_REQUEST_ID.test(data.user_id) || typeof data.expires_at !== "number" || !Number.isFinite(data.expires_at)) throw new Error();
    return Response.json({ user_id: data.user_id, expires_at: data.expires_at }, { headers: { "Cache-Control": "no-store" } });
  } catch { return chatError("앱 연결을 준비하지 못했어요. 다시 시도해주세요.", 503); }
}

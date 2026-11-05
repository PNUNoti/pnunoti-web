import { CHAT_HISTORY_REVISION, CHAT_REQUEST_ID, isChatHistory, isChatHistoryAvailability, isChatReply, isChatStatus, publicChatReply, publicChatStatus } from "../../../lib/chat-types";
import { chatError as error, chatUpstream, fetchChat, validChatOrigin } from "../../../lib/notebooklm-transport";
import { chatSession } from "../../../lib/chat-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_BODY_BYTES = 16_384;

export async function GET(request: Request) {
  if (!validChatOrigin(request)) return error("이 페이지에서 다시 이용해주세요.", 403);
  const params = new URL(request.url).searchParams;
  const summary = params.get("summary") === "true";
  const conversationId = params.get("conversation_id");
  const focusId = params.get("request_id");
  if (conversationId !== null && (!CHAT_REQUEST_ID.test(conversationId) || summary)) return error("대화를 확인하고 다시 시도해주세요.", 400);
  if (focusId !== null && (!CHAT_REQUEST_ID.test(focusId) || !conversationId || summary)) return error("질문 정보를 확인해주세요.", 400);
  const session = chatSession(request, true)!;
  const headers = { "Cache-Control": "no-store", ...(session.cookie ? { "Set-Cookie": session.cookie } : {}) };
  // A new browser credential cannot own earlier server history.
  if (summary && session.cookie) return Response.json({ conversation_id: null, has_history: false, revision: null }, { headers });
  try {
    const query = summary ? "?summary=true" : conversationId ? `?conversation_id=${conversationId}${focusId ? `&request_id=${focusId}` : ""}` : "";
    const config = chatUpstream(`/chat/history${query}`);
    const response = await fetchChat(config.url, config.apiKey, { method: "GET", timeout: 15_000, session: session.value });
    const history: unknown = await response.json();
    if (response.status === 404) return error("이전 대화가 정리됐어요. 새 질문을 시작해주세요.", 404);
    if (summary) {
      if (!response.ok || !isChatHistoryAvailability(history)) return error("이전 대화를 확인하지 못했어요. 다시 시도해주세요.", 502);
      return Response.json({ conversation_id: history.conversation_id, has_history: history.has_history, revision: history.revision }, { headers });
    }
    if (!response.ok || !isChatHistory(history)) return error("대화를 불러오지 못했어요. 다시 시도해주세요.", 502);
    return Response.json({ conversation_id: history.conversation_id,
      turns: history.turns.map(({ id, question, status }) => ({ id, question, status: publicChatStatus(status) })),
    }, { headers });
  } catch { return error("대화를 불러오지 못했어요. 다시 시도해주세요.", 503); }
}

export async function POST(request: Request) {
  if (!validChatOrigin(request)) {
    return error("이 페이지에서 다시 질문해주세요.", 403);
  }

  let config: ReturnType<typeof chatUpstream>;
  try {
    config = chatUpstream("/chat");
  } catch {
    return error("채팅 연결을 준비 중이에요. 잠시 후 다시 이용해주세요.", 503);
  }

  const session = chatSession(request);
  if (!session) return error("대화를 먼저 불러온 뒤 질문해주세요.", 401);

  let body: Record<string, unknown>;
  try {
    // Bound chunked requests too, before parsing JSON or calling NotebookLM.
    const reader = request.body?.getReader();
    if (!reader) return error("질문을 입력해주세요.", 400);
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        return error("질문은 4,000자 이내로 입력해주세요.", 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    body = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
  } catch {
    return error("질문 형식을 확인하고 다시 보내주세요.", 400);
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const conversationId = body.conversation_id;
  const requestId = body.request_id;
  const discardId = body.discard_conversation_id;
  const discardRevision = body.discard_revision;
  const notificationTicket = body.notification_ticket;
  const appUserId = request.headers.get("x-app-user-id");
  if (appUserId !== null && !CHAT_REQUEST_ID.test(appUserId)) return error("앱 로그인 정보를 확인해주세요.", 400);
  if (!message || message.length > 4000 ||
    Object.keys(body).some((key) => !["message", "conversation_id", "request_id", "discard_conversation_id", "discard_revision", "notification_ticket"].includes(key)) ||
    (notificationTicket !== undefined && (typeof notificationTicket !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(notificationTicket))) ||
    ((discardId === undefined) !== (discardRevision === undefined)) ||
    (discardId !== undefined && (typeof discardId !== "string" || !CHAT_REQUEST_ID.test(discardId) || conversationId !== undefined)) ||
    (discardRevision !== undefined && (typeof discardRevision !== "string" || !CHAT_HISTORY_REVISION.test(discardRevision))) ||
    (requestId !== undefined && (typeof requestId !== "string" || !CHAT_REQUEST_ID.test(requestId))) ||
    (conversationId !== undefined && (typeof conversationId !== "string" || !CHAT_REQUEST_ID.test(conversationId)))) {
    return error("질문은 1~4,000자로 입력해주세요.", 400);
  }

  try {
    const response = await fetchChat(config.url, config.apiKey, {
      method: "POST",
      body: JSON.stringify({ message, ...(conversationId ? { conversation_id: conversationId } : {}), ...(requestId ? { request_id: requestId } : {}),
        ...(discardId ? { discard_conversation_id: discardId, discard_revision: discardRevision } : {}),
        ...(notificationTicket ? { notification_ticket: notificationTicket } : {}) }),
      timeout: 20_000, session: session.value, async: true, appUserId: appUserId ?? undefined,
    });
    if (!response.ok) {
      if ([401, 403].includes(response.status)) return error("앱 로그인 연결이 만료됐어요. 다시 시도해주세요.", response.status);
      if (response.status === 409) {
        const detail = await response.json().catch(() => null) as { code?: string } | null;
        if (detail?.code === "cancelled") return Response.json({ code: "cancelled" }, { status: 409, headers: { "Cache-Control": "no-store" } });
        if (detail?.code === "session_busy") return error("다른 창에서 답변을 준비 중이에요. 대화를 새로고침해주세요.", 409);
      }
      if (response.status === 404) return error("대화를 찾지 못했어요. 새 대화에서 다시 질문해주세요.", 404);
      if (response.status === 429) return error("대기 요청이 많거나 사용량 한도에 도달했어요. 잠시 후 다시 시도해주세요.", 429, response.headers.get("retry-after"));
      if (response.status === 504) return error("답변에 시간이 오래 걸리고 있어요. 질문을 조금 구체적으로 바꿔주세요.", 504);
      if (response.status === 503) return error("지금은 답변을 가져올 수 없어요. 잠시 후 다시 시도하거나 질문의 범위를 좁혀주세요.", 503);
      return error("채팅 서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.", 502);
    }
    const reply: unknown = await response.json();
    if (response.status === 202) {
      if (!isChatStatus(reply) || (requestId && reply.request_id !== requestId)) return error("질문 접수 결과를 확인하지 못했어요.", 502);
      return Response.json(publicChatStatus(reply), { status: 202, headers: { "Cache-Control": "no-store" } });
    }
    if (!isChatReply(reply)) return error("답변을 읽지 못했어요. 다시 시도해주세요.", 502);
    return Response.json(publicChatReply(reply), { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    if (cause instanceof Error && ["TimeoutError", "AbortError"].includes(cause.name)) {
      return error("답변 시간이 초과됐어요. 잠시 후 다시 시도해주세요.", 504);
    }
    return error("채팅 서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.", 502);
  }
}

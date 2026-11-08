import { CHAT_HISTORY_REVISION, CHAT_REQUEST_ID, isChatHistory, isChatStatus, type ChatHistory } from "./chat-types";

const KEY = "pnunoti_chat_unseen_request";
function storageKey() {
  const namespace = process.env.NODE_ENV === "development" ? process.env.NEXT_PUBLIC_CHAT_STORAGE_NAMESPACE : undefined;
  return namespace && /^[a-zA-Z0-9_-]{1,48}$/.test(namespace) ? `${KEY}_${namespace}` : KEY;
}
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const ACCEPTANCE_GRACE = 15_000;

// Keep one unseen question until its result is visible. Never store login or push tokens.
export type UnseenChatRequest = { requestId: string; savedAt: number; notificationEnabled: boolean;
  question?: string; conversationId?: string; userId?: string | null; accepted?: boolean;
  discardId?: string; discardRevision?: string };

export class ChatConnectionError extends Error {
  constructor(readonly code: "unverified" | "mismatch" | "notifications") {
    super(code === "unverified" ? "앱 계정을 확인하지 못했어요. 로그인 상태와 연결을 확인한 뒤 다시 시도해주세요."
      : code === "mismatch" ? "질문을 보낸 계정으로 앱에 다시 로그인해주세요."
      : "완료 알림을 연결하지 못했어요. 잠시 후 다시 시도해주세요.");
    this.name = "ChatConnectionError";
  }
}

export function chatAccountError(request: UnseenChatRequest, userId: string | null): ChatConnectionError | null {
  // Anonymous questions belong only to the browser cookie. Connecting an app
  // account later must neither block their recovery nor enable pushes for them.
  if (!request.userId || request.userId === userId) return null;
  return new ChatConnectionError(userId ? "mismatch" : "unverified");
}

export function readUnseenChatRequest(): UnseenChatRequest | null {
  try {
    const value = window.localStorage.getItem(storageKey());
    if (!value) return null;
    const data = JSON.parse(value) as Partial<UnseenChatRequest> | null;
    if (!data || typeof data.requestId !== "string" || !CHAT_REQUEST_ID.test(data.requestId) ||
      typeof data.savedAt !== "number" || !Number.isFinite(data.savedAt) || data.savedAt > Date.now() + 60_000 ||
      Date.now() - data.savedAt > MAX_AGE || typeof data.notificationEnabled !== "boolean") {
      window.localStorage.removeItem(storageKey());
      return null;
    }
    if ((data.question !== undefined && (typeof data.question !== "string" || !data.question.trim() || data.question.length > 4000)) ||
      (data.userId !== undefined && data.userId !== null && (typeof data.userId !== "string" || !CHAT_REQUEST_ID.test(data.userId))) ||
      (data.conversationId !== undefined && (typeof data.conversationId !== "string" || !CHAT_REQUEST_ID.test(data.conversationId))) ||
      (data.accepted !== undefined && typeof data.accepted !== "boolean") ||
      ((data.discardId === undefined) !== (data.discardRevision === undefined)) ||
      (data.discardId !== undefined && (!CHAT_REQUEST_ID.test(data.discardId) || !CHAT_HISTORY_REVISION.test(data.discardRevision!)))) return null;
    return { requestId: data.requestId, savedAt: data.savedAt, notificationEnabled: data.notificationEnabled,
      ...(data.question !== undefined ? { question: data.question, userId: data.userId ?? null } : {}),
      ...(data.conversationId ? { conversationId: data.conversationId } : {}),
      ...(data.accepted !== undefined ? { accepted: data.accepted } : {}),
      ...(data.discardId ? { discardId: data.discardId, discardRevision: data.discardRevision } : {}) };
  } catch { return null; }
}

export function rememberUnseenChatRequest(request: UnseenChatRequest) {
  try { window.localStorage.setItem(storageKey(), JSON.stringify(request)); return true; } catch { return false; }
}

export function submitRememberedQuestion(request: UnseenChatRequest, userId: string | null, signal?: AbortSignal) {
  if (!request.question) throw new Error("질문 내용을 확인해주세요.");
  const accountError = chatAccountError(request, userId);
  if (accountError) throw accountError;
  return fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json", ...(request.userId && userId ? { "X-App-User-Id": userId } : {}) },
    body: JSON.stringify({ message: request.question, request_id: request.requestId,
      ...(request.conversationId ? { conversation_id: request.conversationId } : {}),
      ...(request.discardId ? { discard_conversation_id: request.discardId, discard_revision: request.discardRevision } : {}) }), signal });
}

export function forgetUnseenChatRequest(requestId: string) {
  try {
    // 다른 창에서 시작한 새 요청을 이전 요청의 완료 처리가 지우지 않도록 한다.
    if (readUnseenChatRequest()?.requestId === requestId) window.localStorage.removeItem(storageKey());
  } catch { /* 저장소 접근 실패는 대화를 막지 않는다. */ }
}

export async function recoverUnseenChatRequest(request: UnseenChatRequest, userId?: string): Promise<ChatHistory | null> {
  let response: Response;
  for (let attempt = 0; ; attempt++) {
    response = await fetch(`/api/chat/${request.requestId}/status`, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    // POST 응답을 받기 전에 닫았을 수 있으므로, 접수 직후의 404는 잠시 재확인한다.
    if (request.question || response.status !== 404 || Date.now() - request.savedAt >= ACCEPTANCE_GRACE || attempt >= 10) break;
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  if ([401, 403, 404].includes(response.status) && userId) {
    const grant = await fetch("/api/chat/app-resume", { method: "POST", headers: { "Content-Type": "application/json", "X-App-User-Id": userId },
      body: JSON.stringify({ request_id: request.requestId }), signal: AbortSignal.timeout(20_000) });
    if (grant.status === 404) return null;
    if (!grant.ok) throw new Error("App session recovery unavailable");
    response = await fetch(`/api/chat/${request.requestId}/status`, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  }
  if ([401, 403, 404].includes(response.status)) return null;
  const status: unknown = await response.json();
  if (!response.ok || !isChatStatus(status) || status.request_id !== request.requestId) throw new Error("Invalid recovery status");
  if (!status.conversation_id) return null;
  const historyResponse = await fetch(`/api/chat?conversation_id=${status.conversation_id}&request_id=${request.requestId}`, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if ([401, 403, 404].includes(historyResponse.status)) return null;
  const history: unknown = await historyResponse.json();
  if (!historyResponse.ok || !isChatHistory(history) || history.conversation_id !== status.conversation_id ||
    !history.turns.some(turn => turn.id === request.requestId)) throw new Error("Invalid recovery history");
  return history;
}

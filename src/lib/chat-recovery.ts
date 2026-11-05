import { CHAT_REQUEST_ID, isChatHistory, isChatStatus, type ChatHistory } from "./chat-types";

const KEY = "pnunoti_chat_unseen_request";
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const ACCEPTANCE_GRACE = 15_000;

// 질문·답변·인증 정보는 저장하지 않고, 다시 조회할 요청 하나만 기억한다.
export type UnseenChatRequest = { requestId: string; savedAt: number; notificationEnabled: boolean };

export function readUnseenChatRequest(): UnseenChatRequest | null {
  try {
    const value = window.localStorage.getItem(KEY);
    if (!value) return null;
    const data = JSON.parse(value) as Partial<UnseenChatRequest> | null;
    if (!data || typeof data.requestId !== "string" || !CHAT_REQUEST_ID.test(data.requestId) ||
      typeof data.savedAt !== "number" || !Number.isFinite(data.savedAt) || data.savedAt > Date.now() + 60_000 ||
      Date.now() - data.savedAt > MAX_AGE || typeof data.notificationEnabled !== "boolean") {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return { requestId: data.requestId, savedAt: data.savedAt, notificationEnabled: data.notificationEnabled };
  } catch { return null; }
}

export function rememberUnseenChatRequest(request: UnseenChatRequest) {
  try { window.localStorage.setItem(KEY, JSON.stringify(request)); } catch { /* 저장소를 사용할 수 없어도 전송은 계속한다. */ }
}

export function forgetUnseenChatRequest(requestId: string) {
  try {
    // 다른 창에서 시작한 새 요청을 이전 요청의 완료 처리가 지우지 않도록 한다.
    if (readUnseenChatRequest()?.requestId === requestId) window.localStorage.removeItem(KEY);
  } catch { /* 저장소 접근 실패는 대화를 막지 않는다. */ }
}

export async function recoverUnseenChatRequest(request: UnseenChatRequest): Promise<ChatHistory | null> {
  let response: Response;
  for (let attempt = 0; ; attempt++) {
    response = await fetch(`/api/chat/${request.requestId}/status`, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    // POST 응답을 받기 전에 닫았을 수 있으므로, 접수 직후의 404는 잠시 재확인한다.
    if (response.status !== 404 || Date.now() - request.savedAt >= ACCEPTANCE_GRACE || attempt >= 10) break;
    await new Promise(resolve => setTimeout(resolve, 1500));
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

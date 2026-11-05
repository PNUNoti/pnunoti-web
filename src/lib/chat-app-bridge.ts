import { CHAT_REQUEST_ID, isChatHistory, type ChatHistory } from "./chat-types";
import { isWebView } from "../app/utils/webview";

const RESPONSE = "pnunoti:chat-push-response";
const TICKET = /^[A-Za-z0-9_-]{43}$/;
export type AppChatUser = { user_id: string; expires_at: number };

async function waitForAppBridge() {
  if (isWebView() && window.__PNUNOTI_CHAT_PUSH__ !== 1) await new Promise<void>((resolve) => {
    const ready = () => { clearTimeout(timer); window.removeEventListener("pnunoti:chat-push-ready", ready); resolve(); };
    const timer = setTimeout(ready, 2000);
    window.addEventListener("pnunoti:chat-push-ready", ready);
  });
}

// Reuse the installed app's login bridge once per page, never once per question.
export async function connectAppUser(): Promise<AppChatUser | null> {
  await waitForAppBridge();
  if (!isWebView() || window.__PNUNOTI_CHAT_PUSH__ !== 1) return null;
  const requestId = crypto.randomUUID();
  const ticket = await requestAppPushTicket(requestId);
  if (!ticket) {
    await fetch("/api/chat/app-identity", { method: "DELETE", signal: AbortSignal.timeout(15_000) });
    return null;
  }
  const response = await fetch("/api/chat/app-identity", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request_id: requestId, ticket }), signal: AbortSignal.timeout(20_000) });
  const data: unknown = await response.json();
  if (!response.ok || !data || typeof data !== "object" || !("user_id" in data) || typeof data.user_id !== "string" ||
    !CHAT_REQUEST_ID.test(data.user_id) || !("expires_at" in data) || typeof data.expires_at !== "number" ||
    !Number.isFinite(data.expires_at) || data.expires_at * 1000 <= Date.now()) throw new Error("App login connection unavailable");
  return { user_id: data.user_id, expires_at: data.expires_at };
}

export function notificationRequest(url: string) {
  const value = new URL(url).searchParams.get("chat_request");
  return value && CHAT_REQUEST_ID.test(value) ? value : null;
}

export function requestAppPushTicket(requestId: string, purpose: "notify" | "resume" = "notify", timeoutMs = 12_000): Promise<string | null> {
  if (!isWebView() || window.__PNUNOTI_CHAT_PUSH__ !== 1 || !CHAT_REQUEST_ID.test(requestId)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const id = crypto.randomUUID();
    const finish = (ticket: string | null) => {
      clearTimeout(timer); window.removeEventListener(RESPONSE, receive); resolve(ticket);
    };
    const receive = (event: Event) => {
      const data: unknown = (event as CustomEvent).detail;
      if (!data || typeof data !== "object" || !("id" in data) || data.id !== id) return;
      const ticket = "ticket" in data ? data.ticket : null;
      finish(typeof ticket === "string" && TICKET.test(ticket) ? ticket : null);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    window.addEventListener(RESPONSE, receive);
    try { window.ReactNativeWebView!.postMessage(JSON.stringify({ type: "pnunoti:chat-push-request", id, request_id: requestId, purpose })); }
    catch { finish(null); }
  });
}

export async function restoreNotificationAnswer(requestId: string, userId?: string): Promise<ChatHistory> {
  // Android may execute the document-start injection after React has hydrated.
  await waitForAppBridge();
  const ticket = userId ? null : await requestAppPushTicket(requestId, "resume");
  if (!userId && !ticket) throw new Error("App notification connection unavailable");
  const restored = await fetch("/api/chat/app-resume", {
    method: "POST", headers: { "Content-Type": "application/json", ...(userId ? { "X-App-User-Id": userId } : {}) },
    body: JSON.stringify({ request_id: requestId, ...(ticket ? { ticket } : {}) }), signal: AbortSignal.timeout(20_000),
  });
  const connection = await restored.json() as { conversation_id?: unknown; request_id?: unknown };
  if (!restored.ok || typeof connection.conversation_id !== "string" || !CHAT_REQUEST_ID.test(connection.conversation_id) || connection.request_id !== requestId) throw new Error();
  const response = await fetch(`/api/chat?conversation_id=${connection.conversation_id}&request_id=${requestId}`, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  const history: unknown = await response.json();
  if (!response.ok || !isChatHistory(history) || history.conversation_id !== connection.conversation_id || !history.turns.some((turn) => turn.id === requestId)) throw new Error();
  return history;
}

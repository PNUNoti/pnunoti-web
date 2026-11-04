export type ChatReference = {
  source_id: string;
  citation_number: number | null;
  cited_text: string | null;
  title?: string | null;
  url?: string | null;
  post_id?: string | null;
};

export function safePostId(value: unknown): string | null {
  return typeof value === "string" && CHAT_REQUEST_ID.test(value) ? value : null;
}

export function safeSourceUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 4000 || /[\s\x00-\x1f\x7f]/.test(value)) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? value : null;
  } catch { return null; }
}

export type ChatReply = {
  answer: string;
  conversation_id: string;
  turn_number: number;
  references: ChatReference[];
  request_id?: string;
  next_steps?: { question: string; type_code: number }[];
};

export const CHAT_REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const chatPhases = ["queued", "connecting", "requesting", "generating", "receiving", "cancelling", "completed", "cancelled", "failed"] as const;
export type ChatPhase = typeof chatPhases[number];
export type ChatStatus = {
  request_id: string;
  phase: ChatPhase;
  conversation_id: string | null;
  generating: boolean | null;
  status_available: boolean;
  elapsed_seconds: number;
  events: { phase: ChatPhase; elapsed_seconds: number }[];
  queue_position?: number;
  cancellation_scope?: "response";
  reply?: ChatReply;
  error?: { status: number; message: string; retry_after?: number };
};

export function isChatStatus(value: unknown): value is ChatStatus {
  if (!value || typeof value !== "object") return false;
  const status = value as Record<string, unknown>;
  const phase = (item: unknown) => typeof item === "string" && (chatPhases as readonly string[]).includes(item);
  const elapsed = (item: unknown) => typeof item === "number" && Number.isFinite(item) && item >= 0;
  return typeof status.request_id === "string" && CHAT_REQUEST_ID.test(status.request_id) && phase(status.phase) &&
    (status.conversation_id === null || (typeof status.conversation_id === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(status.conversation_id))) &&
    (status.generating === null || typeof status.generating === "boolean") && typeof status.status_available === "boolean" &&
    elapsed(status.elapsed_seconds) && Array.isArray(status.events) && status.events.length <= 12 && status.events.every((item) =>
      item && typeof item === "object" && phase(item.phase) && elapsed(item.elapsed_seconds)) &&
    (status.queue_position === undefined || (Number.isInteger(status.queue_position) && Number(status.queue_position) >= 0 && Number(status.queue_position) <= 20)) &&
    (status.cancellation_scope === undefined || status.cancellation_scope === "response") &&
    (status.reply === undefined || (isChatReply(status.reply) && status.reply.conversation_id === status.conversation_id &&
      (status.reply.request_id === undefined || status.reply.request_id === status.request_id))) &&
    (status.error === undefined || (status.error !== null && typeof status.error === "object" &&
      Number.isInteger((status.error as Record<string, unknown>).status) && typeof (status.error as Record<string, unknown>).message === "string" &&
      ((status.error as Record<string, unknown>).retry_after === undefined || (Number.isInteger((status.error as Record<string, unknown>).retry_after) && Number((status.error as Record<string, unknown>).retry_after) > 0))));
}

export type ChatHistory = { conversation_id: string | null; turns: { id: string; question: string; status: ChatStatus }[] };

export const CHAT_HISTORY_REVISION = /^[a-f0-9]{64}$/;
export type ChatHistoryAvailability = { conversation_id: string | null; has_history: boolean; revision: string | null };

export function isChatHistoryAvailability(value: unknown): value is ChatHistoryAvailability {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return data.has_history === true
    ? typeof data.conversation_id === "string" && CHAT_REQUEST_ID.test(data.conversation_id) && typeof data.revision === "string" && CHAT_HISTORY_REVISION.test(data.revision)
    : data.has_history === false && data.conversation_id === null && data.revision === null;
}

export function isChatHistory(value: unknown): value is ChatHistory {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return (data.conversation_id === null || (typeof data.conversation_id === "string" && CHAT_REQUEST_ID.test(data.conversation_id))) &&
    Array.isArray(data.turns) && data.turns.length <= 50 && data.turns.every((turn) => turn && typeof turn === "object" &&
      typeof turn.id === "string" && CHAT_REQUEST_ID.test(turn.id) && typeof turn.question === "string" && turn.question.length <= 4000 &&
      isChatStatus(turn.status) && turn.status.request_id === turn.id && turn.status.conversation_id === data.conversation_id);
}

export function publicChatReply(reply: ChatReply): ChatReply {
  return {
    answer: reply.answer, conversation_id: reply.conversation_id, turn_number: reply.turn_number,
    ...(reply.request_id ? { request_id: reply.request_id } : {}),
    references: reply.references.map(({ source_id, citation_number, cited_text, title, url, post_id }) => ({
      source_id, citation_number, cited_text,
      ...(title !== undefined ? { title } : {}), ...(url !== undefined ? { url: safeSourceUrl(url) } : {}),
      ...(post_id !== undefined ? { post_id: safePostId(post_id) } : {}),
    })),
    next_steps: reply.next_steps?.map(({ question, type_code }) => ({ question, type_code })) ?? [],
  };
}

export function publicChatStatus(status: ChatStatus): ChatStatus {
  return {
    request_id: status.request_id, conversation_id: status.conversation_id, phase: status.phase,
    generating: status.generating, status_available: status.status_available, elapsed_seconds: status.elapsed_seconds,
    events: status.events.map(({ phase, elapsed_seconds }) => ({ phase, elapsed_seconds })),
    ...(status.queue_position !== undefined ? { queue_position: status.queue_position } : {}),
    ...(status.cancellation_scope ? { cancellation_scope: status.cancellation_scope } : {}),
    ...(status.reply ? { reply: publicChatReply(status.reply) } : {}),
    ...(status.error ? { error: { status: status.error.status, message: status.error.message, ...(status.error.retry_after ? { retry_after: status.error.retry_after } : {}) } } : {}),
  };
}

export function isChatReply(value: unknown): value is ChatReply {
  if (!value || typeof value !== "object") return false;
  const reply = value as Record<string, unknown>;
  return (
    typeof reply.answer === "string" && reply.answer.trim().length > 0 &&
    typeof reply.conversation_id === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(reply.conversation_id) &&
    Number.isInteger(reply.turn_number) &&
    (reply.request_id === undefined || (typeof reply.request_id === "string" && CHAT_REQUEST_ID.test(reply.request_id))) &&
    (reply.next_steps === undefined || (Array.isArray(reply.next_steps) && reply.next_steps.length <= 3 && reply.next_steps.every((step) =>
      step && typeof step === "object" && typeof step.question === "string" && step.question.trim().length > 0 && step.question.length <= 4000 && step.type_code === 9))) &&
    Array.isArray(reply.references) &&
    reply.references.every((ref: unknown) => {
      if (!ref || typeof ref !== "object") return false;
      const item = ref as Record<string, unknown>;
      return typeof item.source_id === "string" &&
        (item.citation_number === null || (Number.isInteger(item.citation_number) && Number(item.citation_number) > 0)) &&
        (item.cited_text === null || typeof item.cited_text === "string") &&
        (item.title === undefined || item.title === null || (typeof item.title === "string" && item.title.length <= 500)) &&
        (item.url === undefined || item.url === null || (typeof item.url === "string" && item.url.length <= 4000)) &&
        (item.post_id === undefined || item.post_id === null || (typeof item.post_id === "string" && item.post_id.length <= 128));
    })
  );
}

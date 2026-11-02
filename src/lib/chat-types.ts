export type ChatReference = {
  source_id: string;
  citation_number: number | null;
  cited_text: string | null;
};

export type ChatReply = {
  answer: string;
  conversation_id: string;
  turn_number: number;
  references: ChatReference[];
};

export function isChatReply(value: unknown): value is ChatReply {
  if (!value || typeof value !== "object") return false;
  const reply = value as Record<string, unknown>;
  return (
    typeof reply.answer === "string" && reply.answer.trim().length > 0 &&
    typeof reply.conversation_id === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(reply.conversation_id) &&
    Number.isInteger(reply.turn_number) &&
    Array.isArray(reply.references) &&
    reply.references.every((ref: unknown) => {
      if (!ref || typeof ref !== "object") return false;
      const item = ref as Record<string, unknown>;
      return typeof item.source_id === "string" &&
        (item.citation_number === null || (Number.isInteger(item.citation_number) && Number(item.citation_number) > 0)) &&
        (item.cited_text === null || typeof item.cited_text === "string");
    })
  );
}

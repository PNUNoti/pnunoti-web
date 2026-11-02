import { isChatReply } from "../../../lib/chat-types";
import undici, { Agent } from "undici";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_BODY_BYTES = 16_384;
// Keep this transport local to NotebookLM. IPv6 family racing can discard
// slower IPv4 connections before the Cloudflare tunnel is reached.
const dispatcher = new Agent({
  connect: { family: 4, autoSelectFamily: false, timeout: 15_000 },
  connections: 2,
  pipelining: 1,
});

function error(message: string, status: number, retryAfter?: string | null) {
  return Response.json({ error: message }, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...(retryAfter && /^\d{1,5}$/.test(retryAfter) ? { "Retry-After": retryAfter } : {}),
    },
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return error("이 페이지에서 다시 질문해주세요.", 403);
  }

  const apiKey = process.env.NOTEBOOKLM_API_KEY;
  let upstream: URL;
  try {
    upstream = new URL("/chat", process.env.NOTEBOOKLM_API_URL);
    if (upstream.protocol !== "https:" || !apiKey || apiKey.length < 32) throw new Error();
  } catch {
    return error("채팅 연결을 준비 중이에요. 잠시 후 다시 이용해주세요.", 503);
  }

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
  if (!message || message.length > 4000 ||
    Object.keys(body).some((key) => !["message", "conversation_id"].includes(key)) ||
    (conversationId !== undefined && (typeof conversationId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(conversationId)))) {
    return error("질문은 1~4,000자로 입력해주세요.", 400);
  }

  try {
    const options: NonNullable<Parameters<typeof undici.fetch>[1]> = {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ message, ...(conversationId ? { conversation_id: conversationId } : {}) }),
      signal: AbortSignal.timeout(100_000),
      redirect: "error",
      dispatcher,
    };
    // Pair fetch with its own dispatcher. Node 26 bundles Undici 8, whose
    // native fetch handler contract is incompatible with an Undici 6 Agent.
    const response = await undici.fetch(upstream, options);
    if (!response.ok) {
      if (response.status === 429) return error("다른 질문에 답변 중이거나 사용량 한도에 도달했어요. 잠시 후 다시 시도해주세요.", 429, response.headers.get("retry-after"));
      if (response.status === 504) return error("답변에 시간이 오래 걸리고 있어요. 질문을 조금 구체적으로 바꿔주세요.", 504);
      if (response.status === 503) return error("지금은 답변을 가져올 수 없어요. 잠시 후 다시 시도하거나 질문의 범위를 좁혀주세요.", 503);
      return error("채팅 서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.", 502);
    }
    const reply: unknown = await response.json();
    if (!isChatReply(reply)) return error("답변을 읽지 못했어요. 다시 시도해주세요.", 502);
    return Response.json({
      answer: reply.answer,
      conversation_id: reply.conversation_id,
      turn_number: reply.turn_number,
      references: reply.references.map(({ source_id, citation_number, cited_text }) => ({ source_id, citation_number, cited_text })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    if (cause instanceof Error && ["TimeoutError", "AbortError"].includes(cause.name)) {
      return error("답변 시간이 초과됐어요. 잠시 후 다시 시도해주세요.", 504);
    }
    return error("채팅 서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.", 502);
  }
}

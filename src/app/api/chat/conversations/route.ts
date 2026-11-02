import { CHAT_REQUEST_ID } from "../../../../lib/chat-types";
import { chatSession } from "../../../../lib/chat-session";
import { chatError, chatUpstream, fetchChat, validChatOrigin } from "../../../../lib/notebooklm-transport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!validChatOrigin(request)) return chatError("이 페이지에서 다시 이용해주세요.", 403);
  const session = chatSession(request);
  if (!session) return chatError("대화를 먼저 불러와주세요.", 401);
  try {
    const config = chatUpstream("/chat/conversations");
    const response = await fetchChat(config.url, config.apiKey, { method: "POST", timeout: 15_000, session: session.value });
    const data = await response.json() as { conversation_id?: unknown };
    if (!response.ok || typeof data.conversation_id !== "string" || !CHAT_REQUEST_ID.test(data.conversation_id)) throw new Error();
    return Response.json({ conversation_id: data.conversation_id }, { headers: { "Cache-Control": "no-store" } });
  } catch { return chatError("새 대화를 시작하지 못했어요. 다시 시도해주세요.", 502); }
}

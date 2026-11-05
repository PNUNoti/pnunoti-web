import { appChatConnection } from "../../../../lib/chat-app-api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) { return appChatConnection(request, true); }

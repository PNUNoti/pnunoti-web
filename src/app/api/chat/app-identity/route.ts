import { appChatIdentity } from "../../../../lib/chat-app-api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) { return appChatIdentity(request); }
export async function DELETE(request: Request) { return appChatIdentity(request); }

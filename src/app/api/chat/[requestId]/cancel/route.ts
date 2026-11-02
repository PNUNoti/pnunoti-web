import { chatControl } from "../../../../../lib/notebooklm-transport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  return chatControl(request, (await context.params).requestId, "cancel");
}

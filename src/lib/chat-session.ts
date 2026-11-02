import { randomBytes } from "node:crypto";

const COOKIE = "pnunoti_chat_session";
const VALID_SESSION = /^[a-zA-Z0-9_-]{43}$/;

// An opaque browser credential; only its hash is stored by the chat backend.
export function chatSession(request: Request, create = false) {
  const value = request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (value && VALID_SESSION.test(value)) return { value, cookie: undefined };
  if (!create) return null;
  const session = randomBytes(32).toString("base64url");
  const secure = new URL(request.url).protocol === "https:";
  return { value: session, cookie: `${COOKIE}=${session}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure ? "; Secure" : ""}` };
}

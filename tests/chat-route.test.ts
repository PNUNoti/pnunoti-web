import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import undici, { Response as UpstreamResponse } from "undici";
import { GET, POST } from "../src/app/api/chat/route";
import { POST as newConversation } from "../src/app/api/chat/conversations/route";
import { GET as getStatus } from "../src/app/api/chat/[requestId]/status/route";
import { POST as cancelChat } from "../src/app/api/chat/[requestId]/cancel/route";

const originalFetch = undici.fetch;
const originalNativeFetch = globalThis.fetch;
const originalUrl = process.env.NOTEBOOKLM_API_URL;
const originalKey = process.env.NOTEBOOKLM_API_KEY;
const key = "test-credential-".repeat(4);
const requestId = "11111111-2222-4333-8444-555555555555";
const conversationId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const sessionCookie = "pnunoti_chat_session=" + "A".repeat(43);
const reply = { answer: "장학금 공지입니다. [1]", conversation_id: conversationId, turn_number: 1, references: [{ source_id: "source-1", citation_number: 1, cited_text: "신청 마감일" }], next_steps: [{ question: "신청 방법은?", type_code: 9 }] };
let calls = 0;

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://pnunoti.example/api/chat", { method: "POST", headers: { "Content-Type": "application/json", cookie: sessionCookie, ...headers }, body: JSON.stringify(body) });
}

beforeEach(() => {
  calls = 0;
  process.env.NOTEBOOKLM_API_URL = "https://chat.example";
  process.env.NOTEBOOKLM_API_KEY = key;
  // A Node runtime can bundle a newer Undici than our installed Agent.
  // Fail fast if the proxy accidentally pairs native fetch with that Agent.
  globalThis.fetch = async () => { throw new Error("Do not use native fetch with the installed Undici Agent"); };
  undici.fetch = async () => { calls++; return UpstreamResponse.json(reply); };
});
after(() => {
  undici.fetch = originalFetch;
  globalThis.fetch = originalNativeFetch;
  if (originalUrl === undefined) delete process.env.NOTEBOOKLM_API_URL; else process.env.NOTEBOOKLM_API_URL = originalUrl;
  if (originalKey === undefined) delete process.env.NOTEBOOKLM_API_KEY; else process.env.NOTEBOOKLM_API_KEY = originalKey;
});

test("uses matching Undici transport and preserves authenticated follow-ups and citations", async () => {
  undici.fetch = async (url, init) => {
    calls++;
    assert.equal(String(url), "https://chat.example/chat");
    assert.equal(new undici.Headers(init?.headers).get("authorization"), `Bearer ${key}`);
    assert.equal(new undici.Headers(init?.headers).get("cache-control"), "no-store");
    assert.deepEqual(JSON.parse(String(init?.body)), { message: "마감일은?", conversation_id: conversationId, request_id: requestId });
    assert.equal(new undici.Headers(init?.headers).get("x-chat-session"), "A".repeat(43));
    assert.equal(new undici.Headers(init?.headers).get("prefer"), "respond-async");
    assert.equal(init?.redirect, "error");
    assert.ok(init?.dispatcher instanceof undici.Agent);
    return UpstreamResponse.json({ ...reply, private_metadata: "do not forward" });
  };
  const response = await POST(request({ message: " 마감일은? ", conversation_id: conversationId, request_id: requestId }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), reply);
  assert.equal(calls, 1);
});

test("forwards only a one-use notification code, not a browser-supplied push target", async () => {
  undici.fetch = async (_url, options) => {
    assert.equal(JSON.parse(String(options?.body)).notification_ticket, "T".repeat(43));
    return UpstreamResponse.json(reply);
  };
  assert.equal((await POST(request({ message: "공지", request_id: requestId, notification_ticket: "T".repeat(43) }))).status, 200);
  for (const extra of [{ notification_ticket: "bad" }, { push_token: "ExpoPushToken[attacker-device]" }, { user_id: "forged" }]) {
    assert.equal((await POST(request({ message: "공지", ...extra }))).status, 400);
  }
});

test("notification history selects the exact answer and still requires a valid conversation", async () => {
  undici.fetch = async (url) => {
    assert.equal(String(url), `https://chat.example/chat/history?conversation_id=${conversationId}&request_id=${requestId}`);
    return UpstreamResponse.json({ conversation_id: conversationId, turns: [] });
  };
  const response = await GET(new Request(`https://pnunoti.example/api/chat?conversation_id=${conversationId}&request_id=${requestId}`, { headers: { cookie: sessionCookie } }));
  assert.equal(response.status, 200);
  assert.equal((await GET(new Request(`https://pnunoti.example/api/chat?request_id=${requestId}`))).status, 400);
});

test("missing server configuration returns a safe error before calling upstream", async () => {
  delete process.env.NOTEBOOKLM_API_KEY;
  const response = await POST(request({ message: "공지 알려줘" }));
  assert.equal(response.status, 503); assert.equal(calls, 0);
});

test("rejects cross-origin browser requests", async () => {
  const response = await POST(request({ message: "공지" }, { origin: "https://other.example" }));
  assert.equal(response.status, 403); assert.equal(calls, 0);
});

test("rejects invalid questions, notebook overrides, and arbitrary conversation ids", async () => {
  for (const body of [{ message: " " }, { message: "a".repeat(4001) }, { message: "공지", notebook_id: "other" }, { message: "공지", conversation_id: "../other" }, { message: "공지", request_id: "../other" }, null, []]) {
    assert.equal((await POST(request(body))).status, 400);
  }
  assert.equal(calls, 0);
});

test("bounds request bytes before upstream calls, including streamed bodies", async () => {
  const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("x".repeat(17_000))); controller.close(); } });
  const streamed = new Request("https://pnunoti.example/api/chat", { method: "POST", headers: { cookie: sessionCookie }, body, duplex: "half" } as RequestInit);
  assert.equal((await POST(streamed)).status, 413); assert.equal(calls, 0);
});

test("accepts a 4,000-character Korean question within the byte limit", async () => {
  assert.equal((await POST(request({ message: "가".repeat(4000) }))).status, 200);
});

test("preserves rate limits and retry timing without exposing upstream text", async () => {
  undici.fetch = async () => new UpstreamResponse("private upstream details", { status: 429, headers: { "Retry-After": "60" } });
  const response = await POST(request({ message: "공지" }));
  assert.equal(response.status, 429); assert.equal(response.headers.get("retry-after"), "60");
  assert.ok(!(await response.text()).includes("private upstream"));
});

test("handles Cloudflare non-JSON errors and malformed successful responses safely", async () => {
  undici.fetch = async () => new UpstreamResponse("error code: 502 private details", { status: 502 });
  let response = await POST(request({ message: "공지" }));
  assert.equal(response.status, 502); assert.ok(!(await response.text()).includes("private details"));
  undici.fetch = async () => UpstreamResponse.json({ answer: "missing conversation" });
  response = await POST(request({ message: "공지" }));
  assert.equal(response.status, 502);
});

test("returns a useful timeout response", async () => {
  undici.fetch = async () => { throw new DOMException("private timeout", "TimeoutError"); };
  assert.equal((await POST(request({ message: "공지" }))).status, 504);
});

const status = {
  request_id: requestId, phase: "generating", conversation_id: conversationId,
  generating: true, status_available: true, elapsed_seconds: 3.2,
  events: [{ phase: "requesting", elapsed_seconds: 1 }, { phase: "generating", elapsed_seconds: 3.2 }],
};
const context = { params: Promise.resolve({ requestId }) };

test("polls actual generation status through the authenticated transport without forwarding tokens", async () => {
  undici.fetch = async (url, init) => {
    assert.equal(String(url), `https://chat.example/chat/${requestId}/status`);
    assert.equal(init?.method, "GET");
    assert.equal(new undici.Headers(init?.headers).get("authorization"), `Bearer ${key}`);
    return UpstreamResponse.json({ ...status, token: "private-google-token", events: status.events.map((event) => ({ ...event, secret: "private" })) });
  };
  const response = await getStatus(new Request(`https://pnunoti.example/api/chat/${requestId}/status`, { headers: { cookie: sessionCookie } }), context);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), status);
});

test("forwards live tool progress and strips nested provider payloads", async () => {
  const progress = { step_id: "tool-1", label: "공지 본문을 확인하고 있어요", status: "running" };
  const live = { ...status, events: [{ ...status.events[0], progress }] };
  undici.fetch = async () => UpstreamResponse.json({ ...live, events: [{ ...live.events[0], progress: {
    ...progress, args: { fileId: "PRIVATE" }, response: "PRIVATE", thought: "PRIVATE",
  } }] });
  const response = await getStatus(new Request(`https://pnunoti.example/api/chat/${requestId}/status`, { headers: { cookie: sessionCookie } }), context);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), live);
});

test("cancels only the supplied request and preserves settling status", async () => {
  undici.fetch = async (url, init) => {
    assert.equal(String(url), `https://chat.example/chat/${requestId}/cancel`);
    assert.equal(init?.method, "POST");
    return UpstreamResponse.json({ ...status, phase: "cancelling" }, { status: 202 });
  };
  const response = await cancelChat(request({}), context);
  assert.equal(response.status, 202);
  assert.equal((await response.json()).phase, "cancelling");
});

test("control routes reject cross-origin requests and invalid ids before contacting Google", async () => {
  assert.equal((await cancelChat(request({}, { origin: "https://other.example" }), context)).status, 403);
  assert.equal((await getStatus(new Request("https://pnunoti.example/api/chat", { headers: { cookie: sessionCookie } }), { params: Promise.resolve({ requestId: "../../other" }) })).status, 400);
  assert.equal(calls, 0);
});

test("does not treat malformed or mismatched generation state as confirmation", async () => {
  undici.fetch = async () => UpstreamResponse.json({ ...status, request_id: "66666666-2222-4333-8444-555555555555" });
  assert.equal((await cancelChat(request({}), context)).status, 502);
  undici.fetch = async () => UpstreamResponse.json({ ...status, phase: "invented-reasoning" });
  assert.equal((await getStatus(new Request("https://pnunoti.example/api/chat", { headers: { cookie: sessionCookie } }), context)).status, 502);
});

test("preserves confirmed cancellation as a neutral outcome rather than a connection error", async () => {
  undici.fetch = async () => UpstreamResponse.json({ code: "cancelled", private_detail: "private" }, { status: 409 });
  const response = await POST(request({ message: "공지", request_id: requestId }));
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { code: "cancelled" });
});

test("issues a private persistent browser cookie before the first question", async () => {
  let forwarded = "";
  undici.fetch = async (url, init) => {
    assert.equal(String(url), "https://chat.example/chat/history");
    forwarded = new undici.Headers(init?.headers).get("x-chat-session") ?? "";
    assert.match(forwarded, /^[a-zA-Z0-9_-]{43}$/);
    return UpstreamResponse.json({ conversation_id: null, turns: [], private_field: "secret" });
  };
  const response = await GET(new Request("https://pnunoti.example/api/chat"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { conversation_id: null, turns: [] });
  assert.equal(response.headers.get("cache-control"), "no-store");
  const cookie = response.headers.get("set-cookie") ?? "";
  assert.ok(cookie.includes(`pnunoti_chat_session=${forwarded}`));
  for (const flag of ["HttpOnly", "SameSite=Lax", "Secure", "Max-Age=2592000"]) assert.ok(cookie.includes(flag));
});

test("uses the HttpOnly session cookie and ignores forged browser identity headers", async () => {
  undici.fetch = async (_url, init) => {
    assert.equal(new undici.Headers(init?.headers).get("x-chat-session"), "A".repeat(43));
    return UpstreamResponse.json({ conversation_id: null, turns: [] });
  };
  const response = await GET(new Request("http://localhost:3000/api/chat", { headers: { cookie: sessionCookie, "X-Chat-Session": "forged-user" } }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("set-cookie"), null);
});

test("requires a browser session for questions and controls", async () => {
  assert.equal((await POST(request({ message: "공지" }, { cookie: "" }))).status, 401);
  assert.equal((await getStatus(new Request("https://pnunoti.example/api/chat"), context)).status, 401);
  assert.equal((await cancelChat(request({}, { cookie: "" }), context)).status, 401);
  assert.equal(calls, 0);
});

test("accepts queued requests immediately so a long queue cannot hit a web request timeout", async () => {
  const accepted = { ...status, phase: "queued", generating: null, status_available: false, queue_position: 3 };
  undici.fetch = async () => UpstreamResponse.json({ ...accepted, private_field: "secret" }, { status: 202 });
  const response = await POST(request({ message: "공지", request_id: requestId }));
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), accepted);
});

test("projects final polled replies and history without exposing nested private fields", async () => {
  const completed = { ...status, phase: "completed", reply: { ...reply, private_field: "secret" } };
  undici.fetch = async () => UpstreamResponse.json(completed);
  const result = await getStatus(new Request("https://pnunoti.example/api/chat", { headers: { cookie: sessionCookie } }), context);
  const projected = await result.json();
  assert.deepEqual(projected.reply, reply);
  undici.fetch = async () => UpstreamResponse.json({ conversation_id: conversationId, turns: [{ id: requestId, question: "공지", status: completed, secret: "secret" }] });
  const history = await GET(new Request("https://pnunoti.example/api/chat", { headers: { cookie: sessionCookie } }));
  assert.equal(history.status, 200);
  assert.ok(!(await history.text()).includes("secret"));
});

test("post ids survive immediate replies, polled replies and restored chat history", async () => {
  const sourceReply = { ...reply, references: [{ ...reply.references[0], post_id: conversationId, title: "공지", url: "https://example.com/notice" }] };
  undici.fetch = async () => UpstreamResponse.json(sourceReply);
  assert.deepEqual(await (await POST(request({ message: "공지" }))).json(), sourceReply);
  const completed = { ...status, phase: "completed", reply: sourceReply };
  undici.fetch = async () => UpstreamResponse.json(completed);
  assert.equal((await (await getStatus(new Request("https://pnunoti.example/api/chat", { headers: { cookie: sessionCookie } }), context)).json()).reply.references[0].post_id, conversationId);
  undici.fetch = async () => UpstreamResponse.json({ conversation_id: conversationId, turns: [{ id: requestId, question: "공지", status: completed }] });
  const history = await GET(new Request("https://pnunoti.example/api/chat", { headers: { cookie: sessionCookie } }));
  assert.equal((await history.json()).turns[0].status.reply.references[0].post_id, conversationId);
});

test("creates a new owned conversation without forwarding arbitrary notebook ids", async () => {
  undici.fetch = async (url, init) => {
    assert.equal(String(url), "https://chat.example/chat/conversations");
    assert.equal(new undici.Headers(init?.headers).get("x-chat-session"), "A".repeat(43));
    assert.equal(init?.body, undefined);
    return UpstreamResponse.json({ conversation_id: conversationId, private_field: "secret" });
  };
  const response = await newConversation(request({ notebook_id: "ignored" }));
  assert.deepEqual(await response.json(), { conversation_id: conversationId });
});

test("accepts the real browser Host when Next normalizes the internal URL", async () => {
  const response = await POST(request({ message: "공지" }, { host: "127.0.0.1:3001", origin: "https://127.0.0.1:3001" }));
  assert.equal(response.status, 200);
  assert.equal((await POST(request({ message: "공지" }, { host: "pnunoti.example", origin: "https://evil.example", "x-forwarded-host": "evil.example" }))).status, 403);
});

test("a new browser checks history without loading a transcript or querying the backend", async () => {
  const response = await GET(new Request("https://pnunoti.example/api/chat?summary=true"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { conversation_id: null, has_history: false, revision: null });
  assert.equal(calls, 0);
  assert.ok(response.headers.get("set-cookie")?.includes("HttpOnly"));
});

test("existing cookies check actual history availability and expose only metadata", async () => {
  const summary = { conversation_id: conversationId, has_history: true, revision: "a".repeat(64) };
  undici.fetch = async (url, init) => {
    calls++;
    assert.equal(String(url), "https://chat.example/chat/history?summary=true");
    assert.equal(new undici.Headers(init?.headers).get("x-chat-session"), "A".repeat(43));
    return UpstreamResponse.json({ ...summary, turns: ["private transcript"] });
  };
  const request = new Request("https://pnunoti.example/api/chat?summary=true", { headers: { cookie: sessionCookie } });
  assert.deepEqual(await (await GET(request)).json(), summary);
  undici.fetch = async () => UpstreamResponse.json({ conversation_id: null, has_history: false, revision: null });
  assert.deepEqual(await (await GET(request)).json(), { conversation_id: null, has_history: false, revision: null });
});

test("loads only the explicitly selected previous conversation and preserves missing history", async () => {
  undici.fetch = async (url) => {
    assert.equal(String(url), `https://chat.example/chat/history?conversation_id=${conversationId}`);
    return UpstreamResponse.json({ conversation_id: conversationId, turns: [] });
  };
  const request = new Request(`https://pnunoti.example/api/chat?conversation_id=${conversationId}`, { headers: { cookie: sessionCookie } });
  assert.equal((await GET(request)).status, 200);
  undici.fetch = async () => UpstreamResponse.json({ detail: "not found" }, { status: 404 });
  assert.equal((await GET(request)).status, 404);
  assert.equal((await GET(new Request("https://pnunoti.example/api/chat?conversation_id=../other", { headers: { cookie: sessionCookie } }))).status, 400);
});

test("malformed availability cannot expose a resume action for a missing conversation", async () => {
  for (const invalid of [
    { conversation_id: null, has_history: true, revision: "a".repeat(64) },
    { conversation_id: conversationId, has_history: true, revision: null },
    { conversation_id: conversationId, has_history: false, revision: "a".repeat(64) },
  ]) {
    undici.fetch = async () => UpstreamResponse.json(invalid);
    assert.equal((await GET(new Request("https://pnunoti.example/api/chat?summary=true", { headers: { cookie: sessionCookie } }))).status, 502);
  }
});

test("forwards a versioned history discard only together with a new question", async () => {
  const discard = { discard_conversation_id: conversationId, discard_revision: "a".repeat(64) };
  undici.fetch = async (_url, init) => {
    assert.deepEqual(JSON.parse(String(init?.body)), { message: "새 질문", request_id: requestId, ...discard });
    return UpstreamResponse.json(reply);
  };
  assert.equal((await POST(request({ message: "새 질문", request_id: requestId, ...discard }))).status, 200);
  for (const body of [
    { message: "새 질문", discard_conversation_id: conversationId },
    { message: "새 질문", discard_revision: "a".repeat(64) },
    { message: "새 질문", ...discard, discard_revision: "invalid" },
    { message: "새 질문", ...discard, conversation_id: conversationId },
  ]) assert.equal((await POST(request(body))).status, 400);
});

test("passes the app user header for backend verification and exposes only confirmed notification admission", async () => {
  undici.fetch = async (_url, init) => {
    assert.equal(new undici.Headers(init?.headers).get("x-app-user-id"), conversationId);
    assert.deepEqual(JSON.parse(String(init?.body)), { message: "공지", request_id: requestId });
    return UpstreamResponse.json({ ...status, notification_enabled: true, private_target: "secret" }, { status: 202 });
  };
  const response = await POST(request({ message: "공지", request_id: requestId }, { "x-app-user-id": conversationId }));
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { ...status, notification_enabled: true });
  undici.fetch = async () => UpstreamResponse.json({ detail: "expired" }, { status: 401 });
  assert.equal((await POST(request({ message: "공지" }, { "x-app-user-id": conversationId }))).status, 401);
  assert.equal((await POST(request({ message: "공지" }, { "x-app-user-id": "forged" }))).status, 400);
});

test("allows HTTP loopback only during development, keeping production HTTPS requirements", async () => {
  const originalMode = process.env.NODE_ENV;
  try {
    Object.assign(process.env, { NODE_ENV: "development", NOTEBOOKLM_API_URL: "http://127.0.0.1:8082" });
    undici.fetch = async (url) => {
      assert.equal(String(url), "http://127.0.0.1:8082/chat");
      return UpstreamResponse.json(reply);
    };
    assert.equal((await POST(request({ message: "local question" }))).status, 200);
    for (const address of ["http://example.com", "http://localhost.evil.example", "http://127.0.0.1.evil.example", "https://user:secret@example.com"]) {
      process.env.NOTEBOOKLM_API_URL = address;
      assert.equal((await POST(request({ message: "blocked" }))).status, 503);
    }
    Object.assign(process.env, { NODE_ENV: "production", NOTEBOOKLM_API_URL: "http://127.0.0.1:8082" });
    assert.equal((await POST(request({ message: "blocked" }))).status, 503);
  } finally {
    if (originalMode === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
    else Object.assign(process.env, { NODE_ENV: originalMode });
  }
});

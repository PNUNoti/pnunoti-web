import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import undici from "undici";
import { appChatConnection } from "../src/lib/chat-app-api";
import { notificationRequest, requestAppPushTicket, restoreNotificationAnswer } from "../src/lib/chat-app-bridge";

const requestId = "11111111-2222-4333-8444-555555555555";
const conversationId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const ticket = "T".repeat(43);
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const oldFetch = undici.fetch;
const oldNativeFetch = globalThis.fetch;
const oldUrl = process.env.NOTEBOOKLM_API_URL;
const oldKey = process.env.NOTEBOOKLM_API_KEY;

afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow); else Reflect.deleteProperty(globalThis, "window");
  undici.fetch = oldFetch;
  globalThis.fetch = oldNativeFetch;
  if (oldUrl === undefined) delete process.env.NOTEBOOKLM_API_URL; else process.env.NOTEBOOKLM_API_URL = oldUrl;
  if (oldKey === undefined) delete process.env.NOTEBOOKLM_API_KEY; else process.env.NOTEBOOKLM_API_KEY = oldKey;
});

function app(handler: (message: Record<string, unknown>, target: EventTarget) => void) {
  const target = new EventTarget();
  const value = { __PNUNOTI_CHAT_PUSH__: 1, addEventListener: target.addEventListener.bind(target), removeEventListener: target.removeEventListener.bind(target),
    ReactNativeWebView: { postMessage: (message: string) => handler(JSON.parse(message), target) } };
  Object.defineProperty(globalThis, "window", { configurable: true, value });
  return value;
}

test("browser and older app versions skip the new bridge immediately", async () => {
  assert.equal(await requestAppPushTicket(requestId), null);
  const value = app(() => assert.fail("older app must not be called"));
  value.__PNUNOTI_CHAT_PUSH__ = 0;
  assert.equal(await requestAppPushTicket(requestId), null);
  assert.equal(notificationRequest(`https://example.com/chat?chat_request=${requestId}`), requestId);
  assert.equal(notificationRequest("https://example.com/chat?chat_request=unsafe"), null);
});

test("uses a correlated one-use code and ignores unrelated bridge replies", async () => {
  app((message, target) => {
    assert.equal(message.type, "pnunoti:chat-push-request");
    assert.equal(message.request_id, requestId);
    assert.equal(message.purpose, "notify");
    target.dispatchEvent(new CustomEvent("pnunoti:chat-push-response", { detail: { id: "unrelated", ticket: "X".repeat(43) } }));
    target.dispatchEvent(new CustomEvent("pnunoti:chat-push-response", { detail: { id: message.id, ticket } }));
  });
  assert.equal(await requestAppPushTicket(requestId), ticket);
});

test("a broken bridge, missing login, or timed-out app never blocks a normal chat", async () => {
  app(() => { throw new Error("app unavailable"); });
  assert.equal(await requestAppPushTicket(requestId), null);
  app((message, target) => target.dispatchEvent(new CustomEvent("pnunoti:chat-push-response", { detail: { id: message.id, ticket: null } })));
  assert.equal(await requestAppPushTicket(requestId), null);
  app(() => {});
  assert.equal(await requestAppPushTicket(requestId, "notify", 5), null);
});

test("notification click authorizes the exact conversation before loading its answer", async () => {
  app((message, target) => {
    assert.equal(message.purpose, "resume");
    target.dispatchEvent(new CustomEvent("pnunoti:chat-push-response", { detail: { id: message.id, ticket } }));
  });
  let calls = 0;
  const history = { conversation_id: conversationId, turns: [{ id: requestId, question: "question", status: {
    request_id: requestId, conversation_id: conversationId, phase: "completed", generating: false, status_available: false, elapsed_seconds: 100,
    events: [], reply: { answer: "saved answer", conversation_id: conversationId, turn_number: 1, references: [] },
  } }] };
  globalThis.fetch = async (input, options) => {
    calls++;
    if (calls === 1) {
      assert.equal(input, "/api/chat/app-resume");
      assert.deepEqual(JSON.parse(String(options?.body)), { request_id: requestId, ticket });
      return Response.json({ conversation_id: conversationId, request_id: requestId });
    }
    assert.equal(input, `/api/chat?conversation_id=${conversationId}&request_id=${requestId}`);
    return Response.json(history);
  };
  assert.deepEqual(await restoreNotificationAnswer(requestId), history);
  assert.equal(calls, 2);
});

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://pnunoti.example/api/chat/app-session", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
}

test("native login is forwarded privately and only a sanitized ticket returns to the app", async () => {
  process.env.NOTEBOOKLM_API_URL = "https://chat.example";
  process.env.NOTEBOOKLM_API_KEY = "K".repeat(48);
  const body = { request_id: requestId, push_token: "ExpoPushToken[test-device-token]", purpose: "notify" };
  undici.fetch = async (url, options) => {
    assert.equal(String(url), "https://chat.example/chat/app-session");
    const headers = new undici.Headers(options?.headers);
    assert.equal(headers.get("authorization"), "Bearer " + "K".repeat(48));
    assert.equal(headers.get("x-app-authorization"), "Bearer " + "A".repeat(40));
    assert.deepEqual(JSON.parse(String(options?.body)), body);
    return undici.Response.json({ ticket, private_token: "must not leak" });
  };
  const response = await appChatConnection(request(body, { authorization: "Bearer " + "A".repeat(40) }), false);
  assert.deepEqual(await response.json(), { ticket });
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("rejects missing app auth, forged fields, cross-origin requests, and oversized bodies before upstream", async () => {
  undici.fetch = async () => { assert.fail("must not reach backend"); };
  const body = { request_id: requestId, push_token: "ExpoPushToken[test-device-token]", purpose: "notify" };
  assert.equal((await appChatConnection(request(body), false)).status, 401);
  assert.equal((await appChatConnection(request({ ...body, user_id: "forged" }), false)).status, 400);
  assert.equal((await appChatConnection(request(body, { origin: "https://evil.example" }), false)).status, 403);
  assert.equal((await appChatConnection(request({ request_id: requestId, extra: "X".repeat(3000) }), false)).status, 400);
});

test("restoring a new webview cookie creates a session without exposing upstream private fields", async () => {
  process.env.NOTEBOOKLM_API_URL = "https://chat.example";
  process.env.NOTEBOOKLM_API_KEY = "K".repeat(48);
  undici.fetch = async (url, options) => {
    assert.equal(String(url), "https://chat.example/chat/app-resume");
    assert.match(new undici.Headers(options?.headers).get("x-chat-session")!, /^[A-Za-z0-9_-]{43}$/);
    return undici.Response.json({ request_id: requestId, conversation_id: conversationId, user_id: "private" });
  };
  const response = await appChatConnection(request({ request_id: requestId, ticket }), true);
  assert.deepEqual(await response.json(), { request_id: requestId, conversation_id: conversationId });
  assert.match(response.headers.get("set-cookie")!, /pnunoti_chat_session=.*HttpOnly.*Secure/);
});

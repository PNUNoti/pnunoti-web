import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import undici from "undici";
import { appChatConnection } from "../src/lib/chat-app-api";
import { connectAppUser, notificationRequest, requestAppPushTicket, restoreNotificationAnswer } from "../src/lib/chat-app-bridge";
import { replayAnalytics } from "../src/lib/amplitude";

const requestId = "11111111-2222-4333-8444-555555555555";
const conversationId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const ticket = "T".repeat(43);
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const oldFetch = undici.fetch;
const oldNativeFetch = globalThis.fetch;
const oldUrl = process.env.NOTEBOOKLM_API_URL;
const oldKey = process.env.NOTEBOOKLM_API_KEY;

afterEach(() => {
  mock.restoreAll();
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

test("initial page connection reuses the installed app login bridge and returns a verified user only", async () => {
  const identity = mock.method(replayAnalytics, "setAppUser", () => {});
  const { connectAppUser } = await import("../src/lib/chat-app-bridge");
  let bridges = 0;
  app((message, target) => {
    bridges++;
    assert.equal(message.purpose, "notify");
    target.dispatchEvent(new CustomEvent("pnunoti:chat-push-response", { detail: { id: message.id, ticket } }));
  });
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/chat/app-identity");
    assert.equal(JSON.parse(String(options?.body)).ticket, ticket);
    return Response.json({ user_id: conversationId, expires_at: Date.now() / 1000 + 3600 });
  };
  const user = await connectAppUser();
  assert.equal(user?.user_id, conversationId);
  assert.equal(user?.notifications_ready, true);
  assert.equal(bridges, 1);
  assert.deepEqual(identity.mock.calls.map((call) => call.arguments), [[conversationId]]);
});

test("new apps use a read-only identity proof; explicit notification connection still uses notify", async () => {
  const purposes: unknown[] = [];
  const value = app((message, target) => {
    purposes.push(message.purpose);
    target.dispatchEvent(new CustomEvent("pnunoti:chat-push-response", { detail: { id: message.id, ticket } }));
  });
  Object.assign(value, { __PNUNOTI_CHAT_IDENTITY__: 1 });
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/chat/app-identity");
    assert.equal(JSON.parse(String(options?.body)).ticket, ticket);
    return Response.json({ user_id: conversationId, expires_at: Date.now()/1000+3600 });
  };
  assert.equal((await connectAppUser())?.notifications_ready, false);
  assert.equal((await connectAppUser("notify"))?.notifications_ready, true);
  assert.deepEqual(purposes, ["identity", "notify"]);
});

for (const failure of ["missing-ticket", "http-error", "network-error"]) {
  test(`notification ${failure} rechecks identity without clearing a verified account`, async () => {
    const identity = mock.method(replayAnalytics, "setAppUser", () => {});
    const messages: Record<string, unknown>[] = [];
    const value = app((message, target) => {
      messages.push(message);
      target.dispatchEvent(new CustomEvent("pnunoti:chat-push-response", {
        detail: { id: message.id, ticket: failure === "missing-ticket" && message.purpose === "notify" ? null : ticket },
      }));
    });
    Object.assign(value, { __PNUNOTI_CHAT_IDENTITY__: 1 });
    const methods: string[] = [];
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "/api/chat/app-identity");
      assert.equal(options?.method, "POST");
      methods.push(options!.method!);
      const requestId = JSON.parse(String(options?.body)).request_id;
      const message = messages.find(message => message.request_id === requestId)!;
      assert.ok(message);
      if (message.purpose === "notify") {
        if (failure === "network-error") throw new Error("connection lost");
        return Response.json({ error: "notification binding unavailable" }, { status: 503 });
      }
      return Response.json({ user_id: conversationId, expires_at: Date.now()/1000+3600 });
    };
    const user = await connectAppUser("notify");
    assert.equal(user?.user_id, conversationId);
    assert.equal(user?.notifications_ready, false);
    assert.deepEqual(messages.map(message => message.purpose), ["notify", "identity"]);
    assert.notEqual(messages[0].request_id, messages[1].request_id);
    assert.equal(methods.length, failure === "missing-ticket" ? 1 : 2);
    assert.deepEqual(identity.mock.calls.map(call => call.arguments), [[conversationId]]);
  });
}

test("notification failure cannot keep a cached login when the independent identity check fails", async () => {
  const identity = mock.method(replayAnalytics, "setAppUser", () => {});
  const value = app((message, target) => target.dispatchEvent(new CustomEvent("pnunoti:chat-push-response", {
    detail: { id: message.id, ticket: message.purpose === "notify" ? null : ticket },
  })));
  Object.assign(value, { __PNUNOTI_CHAT_IDENTITY__: 1 });
  globalThis.fetch = async () => Response.json({ error: "login expired" }, { status: 401 });
  await assert.rejects(connectAppUser("notify"));
  assert.deepEqual(identity.mock.calls.map(call => call.arguments), [[null]]);
});

test("legacy notification failures never send an unsupported identity purpose", async () => {
  const purposes: unknown[] = [];
  app((message, target) => {
    purposes.push(message.purpose);
    target.dispatchEvent(new CustomEvent("pnunoti:chat-push-response", { detail: { id: message.id, ticket: null } }));
  });
  let clears = 0;
  globalThis.fetch = async (_url, options) => {
    assert.equal(options?.method, "DELETE");
    clears++;
    return new Response(null, { status: 204 });
  };
  assert.equal(await connectAppUser("notify"), null);
  assert.deepEqual(purposes, ["notify"]);
  assert.equal(clears, 1);
});

test("tokenless identity and resume are proxied with native login proof, while notify still requires a token", async () => {
  process.env.NOTEBOOKLM_API_URL = "https://chat.example";
  process.env.NOTEBOOKLM_API_KEY = "K".repeat(48);
  let calls = 0;
  undici.fetch = async (url, options) => {
    calls++;
    assert.equal(String(url), "https://chat.example/chat/app-session");
    assert.equal(new undici.Headers(options?.headers).get("x-app-authorization"), "Bearer "+"A".repeat(40));
    assert.equal(Object.hasOwn(JSON.parse(String(options?.body)), "push_token"), false);
    return undici.Response.json({ ticket, user_id: "private" });
  };
  const headers = { authorization: "Bearer "+"A".repeat(40) };
  for (const purpose of ["identity", "resume"]) {
    const response = await appChatConnection(request({ request_id: requestId, purpose }, headers), false);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ticket });
  }
  assert.equal((await appChatConnection(request({ request_id: requestId, purpose: "notify" }, headers), false)).status, 400);
  assert.equal((await appChatConnection(request({ request_id: requestId, purpose: "identity" }), false)).status, 401);
  assert.equal((await appChatConnection(request({ request_id: requestId, purpose: "identity", push_token: null }, headers), false)).status, 400);
  assert.equal(calls, 2);
});

test("missing login and failed server verification clear the analytics account", async () => {
  const { connectAppUser } = await import("../src/lib/chat-app-bridge");
  const identity = mock.method(replayAnalytics, "setAppUser", () => {});
  app((message, target) => target.dispatchEvent(new CustomEvent("pnunoti:chat-push-response", { detail: { id: message.id, ticket: null } })));
  globalThis.fetch = async (_url, options) => {
    assert.equal(options?.method, "DELETE");
    return new Response(null, { status: 204 });
  };
  assert.equal(await connectAppUser(), null);
  app((message, target) => target.dispatchEvent(new CustomEvent("pnunoti:chat-push-response", { detail: { id: message.id, ticket } })));
  for (const reply of [
    Response.json({ user_id: conversationId, expires_at: Date.now() / 1000 + 3600 }, { status: 401 }),
    Response.json({ user_id: conversationId, expires_at: 1 }),
    Response.json({ user_id: "forged", expires_at: Date.now() / 1000 + 3600 }),
  ]) {
    globalThis.fetch = async () => reply;
    await assert.rejects(connectAppUser());
  }
  globalThis.fetch = async () => { throw new Error("offline"); };
  await assert.rejects(connectAppUser());
  assert.deepEqual(identity.mock.calls.map((call) => call.arguments), Array.from({ length: 5 }, () => [null]));
});

test("identity binding requires a cookie and strips all upstream secrets", async () => {
  const { appChatIdentity } = await import("../src/lib/chat-app-api");
  process.env.NOTEBOOKLM_API_URL = "https://chat.example";
  process.env.NOTEBOOKLM_API_KEY = "K".repeat(48);
  assert.equal((await appChatIdentity(request({ request_id: requestId, ticket }))).status, 401);
  undici.fetch = async (url, options) => {
    assert.equal(String(url), "https://chat.example/chat/app-identity");
    assert.equal(new undici.Headers(options?.headers).get("x-chat-session"), "S".repeat(43));
    return undici.Response.json({ user_id: conversationId, expires_at: 1234, private_token: "secret" });
  };
  const response = await appChatIdentity(request({ request_id: requestId, ticket }, { cookie: "pnunoti_chat_session=" + "S".repeat(43) }));
  assert.deepEqual(await response.json(), { user_id: conversationId, expires_at: 1234 });
});

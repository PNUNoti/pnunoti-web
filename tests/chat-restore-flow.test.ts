import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { createElement, StrictMode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { useNoticeChat } from "../src/components/chat/use-notice-chat";
import type { UnseenChatRequest } from "../src/lib/chat-recovery";

const requestId = "11111111-2222-4333-8444-555555555555";
const conversationId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const userId = "aaaaaaaa-1111-4111-8111-111111111111";
const otherUser = "bbbbbbbb-2222-4222-8222-222222222222";
const ticket = "T".repeat(43);
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalFetch = globalThis.fetch;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

type Message = { id: string; request_id: string; purpose: "identity" | "notify" | "resume" };
type Call = { url: string; method: string; options?: RequestInit };
let renderer: ReactTestRenderer | undefined;
let chat: ReturnType<typeof useNoticeChat>;
let cleanupBridge: (() => void) | undefined;

afterEach(async () => {
  await act(async () => { renderer?.unmount(); });
  await act(async () => { cleanupBridge?.(); });
  renderer = undefined; cleanupBridge = undefined;
  globalThis.fetch = originalFetch;
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

function status(id = requestId, phase = "completed") {
  return { request_id: id, conversation_id: conversationId, phase, generating: phase === "generating", status_available: true,
    elapsed_seconds: 100, notification_enabled: true, events: [],
    ...(phase === "completed" ? { reply: { answer: "saved answer", conversation_id: conversationId, turn_number: 1, references: [] } } : {}) };
}

const history = { conversation_id: conversationId, turns: [{ id: requestId, question: "saved question", status: status() }] };
const remembered: UnseenChatRequest = { requestId, savedAt: Date.now()-20_000, question: "saved question", userId,
  accepted: true, notificationEnabled: true };

function setup(options: { notification?: boolean; legacy?: boolean; remembered?: UnseenChatRequest; user?: string;
  bridge?: (message: Message, reply: (message: Message, code?: string | null) => void) => void;
  fetch?: (call: Call) => Promise<Response> | Response } = {}) {
  const target = new EventTarget();
  const messages: Message[] = [];
  const calls: Call[] = [];
  const pending = new Set<Message>();
  const values = new Map<string,string>();
  if (options.remembered) values.set("pnunoti_chat_unseen_request", JSON.stringify(options.remembered));
  const location = new URL(`https://pnunoti.example/chat${options.notification ? `?chat_request=${requestId}` : ""}`);
  const reply = (message: Message, code: string | null = ticket) => {
    pending.delete(message);
    target.dispatchEvent(new CustomEvent("pnunoti:chat-push-response", { detail: { id: message.id, ticket: code } }));
  };
  const value = {
    __PNUNOTI_CHAT_PUSH__: 1, ...(!options.legacy ? { __PNUNOTI_CHAT_IDENTITY__: 1 } : {}),
    location, history: { state: null, replaceState: (_: unknown, __: string, url: URL) => { value.location = new URL(url); } },
    matchMedia: () => ({ matches: false }),
    localStorage: { getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, data: string) => { values.set(key, data); }, removeItem: (key: string) => { values.delete(key); } },
    addEventListener: target.addEventListener.bind(target), removeEventListener: target.removeEventListener.bind(target),
    ReactNativeWebView: { postMessage: (raw: string) => {
      const message = JSON.parse(raw) as Message;
      messages.push(message); pending.add(message);
      if (options.bridge) options.bridge(message, reply); else reply(message);
    } },
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value });
  globalThis.fetch = async (input, init) => {
    const call = { url: String(input), method: init?.method ?? "GET", options: init };
    calls.push(call);
    if (call.url === "/api/chat?summary=true") return Response.json({ has_history: false, conversation_id: null, revision: null });
    if (call.url === "/api/chat/app-identity") return Response.json(call.method === "DELETE" ? { cleared: true }
      : { user_id: options.user ?? userId, expires_at: Date.now()/1000+3600 });
    if (options.fetch) return options.fetch(call);
    if (call.url === "/api/chat/app-resume") return Response.json({ request_id: requestId, conversation_id: conversationId });
    if (call.url.startsWith("/api/chat?conversation_id=")) return Response.json(history);
    if (call.url.endsWith("/status")) return Response.json(status());
    assert.fail(`Unexpected request ${call.method} ${call.url}`);
  };
  cleanupBridge = () => { for (const message of [...pending]) reply(message); };
  return { calls, messages, reply, values, window: value };
}

function Probe() { chat = useNoticeChat(); return null; }
async function mount(strict = false) {
  await act(async () => { renderer = create(strict ? createElement(StrictMode, null, createElement(Probe)) : createElement(Probe)); });
}
function submissions(calls: Call[]) { return calls.filter(call => call.url === "/api/chat" && call.method === "POST"); }

test("a notification displays its answer before background identity connects, including on legacy apps", async () => {
  for (const legacy of [false, true]) {
    const fixture = setup({ notification: true, legacy, bridge(message, reply) {
      if (message.purpose === "resume") reply(message);
      // Simulate an indefinitely slow background identity/Expo connection.
    } });
    await mount();
    assert.equal(chat.initialized, true);
    assert.equal(chat.loadingError, null);
    assert.equal(chat.turns[0].reply?.answer, "saved answer");
    assert.deepEqual(fixture.messages.map(message => message.purpose), ["resume", legacy ? "notify" : "identity"]);
    assert.deepEqual(fixture.calls.map(call => call.url), ["/api/chat?summary=true", "/api/chat/app-resume",
      `/api/chat?conversation_id=${conversationId}&request_id=${requestId}`]);
    assert.equal(fixture.window.location.searchParams.has("chat_request"), false);
    await act(async () => { fixture.reply(fixture.messages[1]); });
    await act(async () => { renderer!.unmount(); });
    renderer = undefined;
  }
});

test("remembered accepted questions recover using identity only and never send the question again", async () => {
  const fixture = setup({ remembered });
  await mount();
  assert.equal(chat.initialized, true);
  assert.equal(chat.turns[0].reply?.answer, "saved answer");
  assert.deepEqual(fixture.messages.map(message => message.purpose), ["identity"]);
  assert.equal(submissions(fixture.calls).length, 0);
  assert.deepEqual(fixture.calls.map(call => call.url), ["/api/chat?summary=true", "/api/chat/app-identity",
    `/api/chat/${requestId}/status`, `/api/chat?conversation_id=${conversationId}&request_id=${requestId}`]);
});

test("a new cookie restores pending work with identity proof instead of regenerating it", async () => {
  let statusCalls = 0;
  const fixture = setup({ remembered, fetch(call) {
    if (call.url.endsWith("/status")) return ++statusCalls === 1 ? new Response(null, { status: 404 }) : Response.json(status());
    if (call.url === "/api/chat/app-resume") {
      assert.equal(new Headers(call.options?.headers).get("x-app-user-id"), userId);
      return Response.json({ request_id: requestId, conversation_id: conversationId });
    }
    return Response.json(history);
  } });
  await mount();
  assert.equal(chat.turns[0].reply?.answer, "saved answer");
  assert.equal(submissions(fixture.calls).length, 0);
  assert.deepEqual(fixture.messages.map(message => message.purpose), ["identity"]);
});

test("switching accounts never reads or resends the saved question as the new user", async () => {
  const fixture = setup({ remembered, user: otherUser });
  await mount();
  assert.equal(chat.initialized, true);
  assert.match(chat.turns[0].error!.message, /계정으로/);
  assert.equal(chat.turns[0].reply, undefined);
  assert.equal(submissions(fixture.calls).length, 0);
  assert.equal(fixture.calls.some(call => call.url.endsWith("/status") || call.url.startsWith("/api/chat?conversation_id=")), false);
  assert.deepEqual(JSON.parse(fixture.values.get("pnunoti_chat_unseen_request")!), remembered);
});

test("read-only identity cannot bypass notification preflight when submitting a new question", async () => {
  const fixture = setup({ bridge(message, reply) { if (message.purpose === "identity") reply(message); }, fetch(call) {
    if (call.url === "/api/chat") return Response.json(status(JSON.parse(String(call.options?.body)).request_id, "generating"), { status: 202 });
    return new Promise<Response>(() => {}); // Keep accepted work pending until unmount.
  } });
  await mount();
  assert.equal(chat.initialized, true);
  await act(async () => { chat.send("new question"); });
  assert.deepEqual(fixture.messages.map(message => message.purpose), ["identity", "notify"]);
  assert.equal(submissions(fixture.calls).length, 0);
  assert.equal(JSON.parse(fixture.values.get("pnunoti_chat_unseen_request")!).userId, null);
  await act(async () => { fixture.reply(fixture.messages[1]); });
  assert.equal(submissions(fixture.calls).length, 1);
  assert.equal(new Headers(submissions(fixture.calls)[0].options?.headers).get("x-app-user-id"), userId);
  assert.equal(chat.notificationEnabled, true);
  assert.equal(chat.busy, true);
});

test("notification permission failure keeps a new question anonymous with a visible warning", async () => {
  const fixture = setup({ bridge(message, reply) { reply(message, message.purpose === "notify" ? null : ticket); }, fetch(call) {
    assert.equal(call.url, "/api/chat");
    assert.equal(new Headers(call.options?.headers).has("x-app-user-id"), false);
    return Response.json(status().reply);
  } });
  await mount();
  await act(async () => { chat.send("question without push permission"); });
  assert.equal(submissions(fixture.calls).length, 1);
  assert.equal(chat.turns[0].reply?.answer, "saved answer");
  assert.match(chat.notificationWarning!, /완료 알림을 연결하지 못했어요/);
  assert.equal(fixture.calls.filter(call => call.url === "/api/chat/app-identity" && call.method === "DELETE").length, 1);
});

test("sending during background identity waits, then performs one notification connection", async () => {
  const fixture = setup({ bridge() {}, fetch() { return Response.json(status().reply); } });
  await mount();
  assert.equal(chat.initialized, true);
  await act(async () => { chat.send("first question"); });
  assert.deepEqual(fixture.messages.map(message => message.purpose), ["identity"]);
  assert.equal(submissions(fixture.calls).length, 0);
  await act(async () => { fixture.reply(fixture.messages[0]); });
  assert.deepEqual(fixture.messages.map(message => message.purpose), ["identity", "notify"]);
  assert.equal(submissions(fixture.calls).length, 0);
  await act(async () => { fixture.reply(fixture.messages[1]); });
  assert.equal(submissions(fixture.calls).length, 1);
  await act(async () => { chat.send("second question"); });
  assert.equal(submissions(fixture.calls).length, 2);
  assert.deepEqual(fixture.messages.map(message => message.purpose), ["identity", "notify"]);
});

test("Strict Mode does not repeat notification grants, identity connections or generation", async () => {
  const fixture = setup({ notification: true });
  await mount(true);
  assert.equal(chat.turns[0].reply?.answer, "saved answer");
  assert.equal(fixture.calls.filter(call => call.url === "/api/chat?summary=true").length, 1);
  assert.equal(fixture.calls.filter(call => call.url === "/api/chat/app-resume").length, 1);
  assert.deepEqual(fixture.messages.map(message => message.purpose), ["resume", "identity"]);
  assert.equal(submissions(fixture.calls).length, 0);
});

test("a rejected notification grant never fetches history and can be retried", async () => {
  let grants = 0;
  const fixture = setup({ notification: true, fetch(call) {
    if (call.url === "/api/chat/app-resume") return ++grants === 1 ? new Response(null, { status: 403 })
      : Response.json({ request_id: requestId, conversation_id: conversationId });
    return Response.json(history);
  } });
  await mount();
  assert.equal(chat.initialized, false);
  assert.match(chat.loadingError!, /알림의 답변/);
  assert.equal(fixture.calls.some(call => call.url.startsWith("/api/chat?conversation_id=")), false);
  assert.equal(fixture.window.location.searchParams.get("chat_request"), requestId);
  await act(async () => { await chat.retryLoad(); });
  assert.equal(chat.initialized, true);
  assert.equal(chat.turns[0].reply?.answer, "saved answer");
  assert.equal(submissions(fixture.calls).length, 0);
});

for (const permitted of [true, false]) {
  test(`an unacknowledged saved question reconnects notifications without changing its UUID (permission ${permitted})`, async () => {
    let posts = 0;
    const fixture = setup({ remembered: { ...remembered, accepted: false }, bridge(message, reply) {
      reply(message, message.purpose === "notify" && !permitted ? null : ticket);
    }, fetch(call) {
      if (call.url.endsWith("/status") || call.url === "/api/chat/app-resume") return new Response(null, { status: 404 });
      assert.equal(call.url, "/api/chat");
      posts++;
      assert.deepEqual(JSON.parse(String(call.options?.body)), { request_id: requestId, message: remembered.question });
      assert.equal(new Headers(call.options?.headers).get("x-app-user-id"), userId);
      return posts === 1 ? new Response(null, { status: 403 }) : Response.json(status(), { status: 202 });
    } });
    await mount();
    assert.deepEqual(fixture.messages.map(message => message.purpose), ["identity", "notify"]);
    assert.equal(posts, permitted ? 2 : 1);
    if (permitted) assert.equal(chat.turns[0].reply?.answer, "saved answer");
    else {
      assert.match(chat.turns[0].error!.message, /계정으로/);
      assert.equal(JSON.parse(fixture.values.get("pnunoti_chat_unseen_request")!).userId, userId);
    }
  });
}

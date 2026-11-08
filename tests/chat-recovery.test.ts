import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { forgetUnseenChatRequest, readUnseenChatRequest, recoverUnseenChatRequest, rememberUnseenChatRequest, type UnseenChatRequest } from "../src/lib/chat-recovery";

const requestId = "11111111-2222-4333-8444-555555555555";
const otherId = "11111111-2222-4333-8444-666666666666";
const conversationId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalFetch = globalThis.fetch;

afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow); else Reflect.deleteProperty(globalThis, "window");
  globalThis.fetch = originalFetch;
});

function storage() {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } } });
  return values;
}

function remembered(): UnseenChatRequest {
  return { requestId, savedAt: Date.now() - 20_000, notificationEnabled: true };
}

function status(phase = "generating") {
  return { request_id: requestId, conversation_id: conversationId, phase, generating: phase === "generating", status_available: true, elapsed_seconds: 45, events: [],
    ...(phase === "completed" ? { reply: { answer: "완료된 답변", conversation_id: conversationId, turn_number: 1, references: [] } } : {}) };
}

test("remembers only a request reference and notification capability across a new page instance", () => {
  const values = storage();
  const request = remembered();
  rememberUnseenChatRequest(request);
  assert.deepEqual(readUnseenChatRequest(), request);
  assert.deepEqual(Object.keys(JSON.parse([...values.values()][0])), ["requestId", "savedAt", "notificationEnabled"]);
});

test("an older answer acknowledgement cannot clear a newer request from another tab", () => {
  storage();
  rememberUnseenChatRequest({ ...remembered(), requestId: otherId });
  forgetUnseenChatRequest(requestId);
  assert.equal(readUnseenChatRequest()?.requestId, otherId);
  forgetUnseenChatRequest(otherId);
  assert.equal(readUnseenChatRequest(), null);
});

test("invalid, expired, and inaccessible browser storage never blocks chat", () => {
  const values = storage();
  for (const value of ["{", JSON.stringify({ ...remembered(), requestId: "unsafe" }), JSON.stringify({ ...remembered(), savedAt: 0 }), JSON.stringify({ ...remembered(), savedAt: Date.now() + 120_000 })]) {
    values.set("pnunoti_chat_unseen_request", value);
    assert.equal(readUnseenChatRequest(), null);
  }
  Object.defineProperty(globalThis, "window", { configurable: true, value: { get localStorage() { throw new Error("blocked"); } } });
  assert.equal(readUnseenChatRequest(), null);
  assert.doesNotThrow(() => rememberUnseenChatRequest(remembered()));
  assert.doesNotThrow(() => forgetUnseenChatRequest(requestId));
});

test("restores the exact waiting or completed request using GETs without resubmitting a question", async () => {
  for (const phase of ["generating", "completed", "failed", "cancelled"]) {
    const expected = { conversation_id: conversationId, turns: [{ id: requestId, question: "기다리던 질문", status: status(phase) }] };
    const urls: string[] = [];
    globalThis.fetch = async (resource, options) => {
      assert.equal(options?.method ?? "GET", "GET");
      urls.push(String(resource));
      return Response.json(urls.length === 1 ? status(phase) : expected);
    };
    assert.deepEqual(await recoverUnseenChatRequest(remembered()), expected);
    assert.deepEqual(urls, [`/api/chat/${requestId}/status`, `/api/chat?conversation_id=${conversationId}&request_id=${requestId}`]);
  }
});

test("rechecks a request that has not yet appeared after POST instead of treating the first 404 as deletion", async () => {
  let calls = 0;
  const history = { conversation_id: conversationId, turns: [{ id: requestId, question: "질문", status: status() }] };
  globalThis.fetch = async () => {
    calls++;
    return calls === 1 ? new Response(null, { status: 404 }) : Response.json(calls === 2 ? status() : history);
  };
  assert.deepEqual(await recoverUnseenChatRequest({ ...remembered(), savedAt: Date.now() }), history);
  assert.equal(calls, 3);
});

test("a missing or unauthorized request falls back without reading another conversation", async () => {
  for (const code of [401, 403, 404]) {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return new Response(null, { status: code }); };
    assert.equal(await recoverUnseenChatRequest(remembered()), null);
    assert.equal(calls, 1);
  }
});

test("temporary failures preserve the remembered request for another connection attempt", async () => {
  storage();
  const request = remembered();
  rememberUnseenChatRequest(request);
  for (const failure of [() => Promise.reject(new Error("offline")), () => Promise.resolve(Response.json({ error: "unavailable" }, { status: 503 }))]) {
    globalThis.fetch = failure;
    await assert.rejects(recoverUnseenChatRequest(request));
    assert.deepEqual(readUnseenChatRequest(), request);
  }
});

test("does not accept a mismatched request or history that omits the requested answer", async () => {
  globalThis.fetch = async () => Response.json({ ...status(), request_id: otherId });
  await assert.rejects(recoverUnseenChatRequest(remembered()));
  let calls = 0;
  globalThis.fetch = async () => Response.json(++calls === 1 ? status() : { conversation_id: conversationId, turns: [] });
  await assert.rejects(recoverUnseenChatRequest(remembered()));
});

test("persists a question and the original UUID before submission; retries keep the exact payload", async () => {
  const { submitRememberedQuestion } = await import("../src/lib/chat-recovery");
  storage();
  const request = { ...remembered(), question: "앱을 닫아도 남아야 하는 질문", userId: null, conversationId, accepted: false };
  assert.equal(rememberUnseenChatRequest(request), true);
  const bodies: unknown[] = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(readUnseenChatRequest()?.question, request.question);
    assert.equal(url, "/api/chat");
    assert.equal(new Headers(options?.headers).has("x-app-user-id"), false);
    bodies.push(JSON.parse(String(options?.body)));
    return Response.json({}, { status: 202 });
  };
  await submitRememberedQuestion(request, null);
  await submitRememberedQuestion(readUnseenChatRequest()!, null);
  assert.deepEqual(bodies, [
    { message: request.question, request_id: requestId, conversation_id: conversationId },
    { message: request.question, request_id: requestId, conversation_id: conversationId },
  ]);
});

test("an account change cannot replay another account's locally retained question", async () => {
  const { submitRememberedQuestion } = await import("../src/lib/chat-recovery");
  globalThis.fetch = async () => assert.fail("wrong account must not submit");
  assert.throws(() => submitRememberedQuestion({ ...remembered(), question: "private", userId: otherId }, requestId), /계정/);
});

test("an unverified app account is distinct from a verified different account and cannot submit", async () => {
  const { ChatConnectionError, submitRememberedQuestion } = await import("../src/lib/chat-recovery");
  globalThis.fetch = async () => assert.fail("unverified account must not submit");
  assert.throws(() => submitRememberedQuestion({ ...remembered(), question: "private", userId: otherId }, null),
    error => error instanceof ChatConnectionError && error.code === "unverified");
  assert.throws(() => submitRememberedQuestion({ ...remembered(), question: "private", userId: otherId }, requestId),
    error => error instanceof ChatConnectionError && error.code === "mismatch");
});

test("connecting an app account cannot turn a saved anonymous question into a push request", async () => {
  const { submitRememberedQuestion } = await import("../src/lib/chat-recovery");
  globalThis.fetch = async (_url, options) => {
    assert.equal(new Headers(options?.headers).has("x-app-user-id"), false);
    assert.equal(JSON.parse(String(options?.body)).request_id, requestId);
    return Response.json({});
  };
  await submitRememberedQuestion({ ...remembered(), question: "anonymous", userId: null }, otherId);
});

test("reports unavailable durable storage instead of claiming that the question is saved", () => {
  Object.defineProperty(globalThis, "window", { configurable: true, value: { get localStorage() { throw new Error("blocked"); } } });
  assert.equal(rememberUnseenChatRequest({ ...remembered(), question: "pending", userId: null }), false);
});

test("a new app cookie recovers an admitted request through the verified user without regenerating", async () => {
  const history = { conversation_id: conversationId, turns: [{ id: requestId, question: "question", status: status() }] };
  const methods: string[] = [];
  globalThis.fetch = async (url, options) => {
    methods.push(options?.method ?? "GET");
    if (methods.length === 1) return new Response(null, { status: 404 });
    if (methods.length === 2) {
      assert.equal(url, "/api/chat/app-resume");
      assert.equal(new Headers(options?.headers).get("x-app-user-id"), otherId);
      return Response.json({ conversation_id: conversationId, request_id: requestId });
    }
    return Response.json(methods.length === 3 ? status() : history);
  };
  assert.deepEqual(await recoverUnseenChatRequest({ ...remembered(), question: "question", userId: otherId }, otherId), history);
  assert.deepEqual(methods, ["GET", "POST", "GET", "GET"]);
});

test("local agent recovery storage cannot replay or remove the original backend's pending question", () => {
  const mode = process.env.NODE_ENV;
  const namespace = process.env.NEXT_PUBLIC_CHAT_STORAGE_NAMESPACE;
  try {
    storage();
    Object.assign(process.env, { NODE_ENV: "production", NEXT_PUBLIC_CHAT_STORAGE_NAMESPACE: "local-agent" });
    const previous = remembered();
    rememberUnseenChatRequest(previous);
    Object.assign(process.env, { NODE_ENV: "development" });
    assert.equal(readUnseenChatRequest(), null);
    const local = { ...remembered(), requestId: otherId };
    rememberUnseenChatRequest(local);
    assert.deepEqual(readUnseenChatRequest(), local);
    forgetUnseenChatRequest(otherId);
    Object.assign(process.env, { NODE_ENV: "production" });
    assert.deepEqual(readUnseenChatRequest(), previous);
  } finally {
    if (mode === undefined) Reflect.deleteProperty(process.env, "NODE_ENV"); else Object.assign(process.env, { NODE_ENV: mode });
    if (namespace === undefined) delete process.env.NEXT_PUBLIC_CHAT_STORAGE_NAMESPACE; else process.env.NEXT_PUBLIC_CHAT_STORAGE_NAMESPACE = namespace;
  }
});

import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import undici, { Response as UpstreamResponse } from "undici";
import { POST } from "../src/app/api/chat/route";

const originalFetch = undici.fetch;
const originalNativeFetch = globalThis.fetch;
const originalUrl = process.env.NOTEBOOKLM_API_URL;
const originalKey = process.env.NOTEBOOKLM_API_KEY;
const key = "test-credential-".repeat(4);
const reply = { answer: "장학금 공지입니다. [1]", conversation_id: "conversation-1", turn_number: 1, references: [{ source_id: "source-1", citation_number: 1, cited_text: "신청 마감일" }] };
let calls = 0;

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://pnunoti.example/api/chat", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
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
    assert.deepEqual(JSON.parse(String(init?.body)), { message: "마감일은?", conversation_id: "conversation-1" });
    assert.equal(init?.redirect, "error");
    assert.ok(init?.dispatcher instanceof undici.Agent);
    return UpstreamResponse.json({ ...reply, private_metadata: "do not forward" });
  };
  const response = await POST(request({ message: " 마감일은? ", conversation_id: "conversation-1" }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), reply);
  assert.equal(calls, 1);
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
  for (const body of [{ message: " " }, { message: "a".repeat(4001) }, { message: "공지", notebook_id: "other" }, { message: "공지", conversation_id: "../other" }, null, []]) {
    assert.equal((await POST(request(body))).status, 400);
  }
  assert.equal(calls, 0);
});

test("bounds request bytes before upstream calls, including streamed bodies", async () => {
  const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("x".repeat(17_000))); controller.close(); } });
  const streamed = new Request("https://pnunoti.example/api/chat", { method: "POST", body, duplex: "half" } as RequestInit);
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

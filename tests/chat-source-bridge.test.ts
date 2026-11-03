import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { isWebView, requestDeeplink } from "../src/app/utils/webview";
import { sourcePostPath, tryOpenSourceNotice } from "../src/lib/open-source-notice";
import type { SourceNotice } from "../src/lib/chat-citations";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const notice: SourceNotice = {
  key: "source", postId: "8746c041-f2c8-4a1f-ae26-e2c1b2ae30a1", title: "장학금 & 지원 안내",
  url: "https://example.com/notice?a=1&b=2#신청", excerpt: "인용문",
};

function browser(postMessage?: (message: string) => void) {
  const value = { ReactNativeWebView: postMessage ? { postMessage } : undefined } as Window;
  Object.defineProperty(globalThis, "window", { configurable: true, value });
  return value;
}

afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

test("normal browsers and server rendering keep the original link behavior", async () => {
  assert.equal(isWebView(), false);
  assert.equal(await requestDeeplink("/post"), false);
  browser();
  assert.equal(tryOpenSourceNotice(notice), null);
});

test("encodes the real post id, title and original URL in the existing post route", () => {
  const route = new URL(sourcePostPath(notice)!, "https://pnunoti.example");
  assert.equal(route.pathname, "/post");
  assert.equal(route.searchParams.get("postId"), notice.postId);
  assert.equal(route.searchParams.get("title"), notice.title);
  assert.equal(route.searchParams.get("url"), notice.url);
});

test("missing or invalid post ids and unsafe URLs never trigger the app bridge", () => {
  browser(() => { assert.fail("must keep the original link"); });
  for (const value of [{ ...notice, postId: null }, { ...notice, postId: "epub-source-id" }, { ...notice, url: "javascript:alert(1)" }]) {
    assert.equal(sourcePostPath(value), null);
    assert.equal(tryOpenSourceNotice(value), null);
  }
});

test("sends the existing DEEP_LINK message and waits for the app acknowledgement", async () => {
  const app = browser((message) => {
    assert.deepEqual(JSON.parse(message), { action: { type: "DEEP_LINK", payload: sourcePostPath(notice) } });
    app.onAppResponse?.({ action: "DEEP_LINK", success: true });
  });
  assert.equal(await tryOpenSourceNotice(notice), true);
  assert.equal(app.onAppResponse, undefined);
});

test("failed acknowledgements and bridge exceptions allow the original URL fallback", async () => {
  const app = browser(() => app.onAppResponse?.({ action: "DEEP_LINK", success: false }));
  assert.equal(await tryOpenSourceNotice(notice), false);
  app.ReactNativeWebView!.postMessage = () => { throw new Error("bridge unavailable"); };
  assert.equal(await tryOpenSourceNotice(notice), false);
  assert.equal(app.onAppResponse, undefined);
});

test("a silent bridge times out without treating an unrelated response as success", async () => {
  const app = browser(() => app.onAppResponse?.({ action: "SHARE", success: true }));
  assert.equal(await requestDeeplink("/post", 10), false);
  assert.equal(app.onAppResponse, undefined);
});

test("preserves existing app response callbacks and cleans up overlapping requests", async () => {
  const app = browser(() => {});
  let previousCalls = 0;
  const previous = () => { previousCalls++; };
  app.onAppResponse = previous;
  const first = requestDeeplink("/post?postId=first");
  const second = requestDeeplink("/post?postId=second");
  app.onAppResponse?.({ action: "DEEP_LINK", success: true });
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.equal(previousCalls, 1);
  assert.equal(app.onAppResponse, previous);
  assert.equal(await requestDeeplink("/post", 10), false);
  assert.equal(app.onAppResponse, previous);
});

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { observeChatViewport } from "../src/lib/chat-viewport";

const originals = ["window", "document"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

function browser(hasVisualViewport = true) {
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  const viewport = Object.assign(new EventTarget(), { height: 800, offsetTop: 0, scale: 1 });
  const appWindow = Object.assign(new EventTarget(), {
    innerHeight: 800,
    visualViewport: hasVisualViewport ? viewport : null,
    requestAnimationFrame(callback: FrameRequestCallback) { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame(id: number) { frames.delete(id); },
  });
  const appDocument = new EventTarget();
  const properties = new Map<string, string>();
  const shell = { style: {
    setProperty(name: string, value: string) { properties.set(name, value); },
    removeProperty(name: string) { properties.delete(name); },
  } } as unknown as HTMLElement;
  Object.defineProperty(globalThis, "window", { configurable: true, value: appWindow });
  Object.defineProperty(globalThis, "document", { configurable: true, value: appDocument });
  dispose = observeChatViewport(shell);
  return {
    viewport, appWindow, appDocument, frames, properties,
    flush() {
      const callbacks = [...frames.values()];
      frames.clear();
      for (const callback of callbacks) callback(0);
    },
    height: () => properties.get("--chat-viewport-height"),
    top: () => properties.get("--chat-viewport-top"),
  };
}

test("the first keyboard opening and subsequent openings track the visible height and iOS pan", () => {
  const page = browser();
  assert.equal(page.height(), "800px");
  for (const [height, offsetTop] of [[480, 80], [800, 0], [460, 20], [800, 0]]) {
    Object.assign(page.viewport, { height, offsetTop });
    page.appDocument.dispatchEvent(new Event("focusin"));
    page.viewport.dispatchEvent(new Event("resize"));
    page.viewport.dispatchEvent(new Event("scroll"));
    page.flush();
    assert.equal(page.height(), `${height}px`);
    assert.equal(page.top(), `${offsetTop}px`);
  }
});

test("a native WebView resize does not subtract the keyboard height twice", () => {
  const page = browser();
  page.appWindow.innerHeight = page.viewport.height = 480;
  page.appWindow.dispatchEvent(new Event("resize"));
  page.viewport.dispatchEvent(new Event("resize"));
  page.flush();
  assert.equal(page.height(), "480px");
  assert.equal(page.top(), "0px");
});

test("older WebViews without visualViewport still follow native window resizing", () => {
  const page = browser(false);
  page.appWindow.innerHeight = 450;
  page.appWindow.dispatchEvent(new Event("resize"));
  page.flush();
  assert.equal(page.height(), "450px");
});

test("pinch zoom and temporarily empty background viewports do not collapse the chat", () => {
  const page = browser();
  Object.assign(page.viewport, { height: 400, scale: 2, offsetTop: 100 });
  page.viewport.dispatchEvent(new Event("resize"));
  page.flush();
  assert.equal(page.height(), "800px");
  assert.equal(page.top(), "0px");
  Object.assign(page.viewport, { height: 0, scale: 1, offsetTop: 0 });
  page.viewport.dispatchEvent(new Event("resize"));
  page.flush();
  assert.equal(page.height(), "800px");
  page.viewport.height = 720;
  page.appWindow.dispatchEvent(new Event("pageshow"));
  page.flush();
  assert.equal(page.height(), "720px");
});

test("leaving chat removes viewport listeners, styles, and pending frames", () => {
  const page = browser();
  page.viewport.dispatchEvent(new Event("resize"));
  assert.equal(page.frames.size, 1);
  dispose?.();
  dispose = undefined;
  assert.equal(page.frames.size, 0);
  assert.equal(page.properties.size, 0);
  page.viewport.dispatchEvent(new Event("resize"));
  page.appWindow.dispatchEvent(new Event("resize"));
  page.appDocument.dispatchEvent(new Event("focusin"));
  assert.equal(page.frames.size, 0);
});

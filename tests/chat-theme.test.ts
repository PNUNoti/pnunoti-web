import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { runInNewContext } from "node:vm";
import { applyTheme, readThemePreference, readUrlTheme, SYSTEM_THEME_QUERY, THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from "../src/lib/theme";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
afterEach(() => {
  for (const [key, descriptor] of [["window", originalWindow], ["document", originalDocument]] as const) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

function bootstrap(saved: string | null, systemDark: boolean, blocked = false, search = "") {
  const root = { dataset: {} as Record<string, string>, style: { colorScheme: "" } };
  runInNewContext(THEME_INIT_SCRIPT, {
    URLSearchParams,
    window: {
      location: { search },
      localStorage: { getItem(key: string) {
        assert.equal(key, THEME_STORAGE_KEY);
        if (blocked) throw new Error("Storage unavailable");
        return saved;
      } },
      matchMedia(query: string) { assert.equal(query, SYSTEM_THEME_QUERY); return { matches: systemDark }; },
    },
    document: { documentElement: root },
  });
  assert.equal(root.style.colorScheme, root.dataset.theme);
  return root.dataset.theme;
}

test("saved light and dark choices override the opposite system theme before hydration", () => {
  assert.equal(bootstrap("light", true), "light");
  assert.equal(bootstrap("dark", false), "dark");
});

test("the app URL theme overrides saved and system themes before the first paint", () => {
  assert.equal(bootstrap("light", false, false, "?theme=dark&lang=ko"), "dark");
  assert.equal(bootstrap("dark", true, false, "?theme=light&lang=ko"), "light");
  assert.equal(bootstrap(null, false, true, "?theme=dark"), "dark");
  assert.equal(bootstrap("dark", false, false, "?theme=invalid"), "dark");
});

test("hydration reads the same URL theme without writing browser preferences", () => {
  for (const [search, expected] of [["?theme=dark", "dark"], ["?theme=light", "light"], ["?theme=other", null], ["", null]] as const) {
    Object.defineProperty(globalThis, "window", { configurable: true, value: {
      location: { search }, get localStorage() { throw new Error("Must not access saved preferences"); },
    } });
    assert.equal(readUrlTheme(), expected);
  }
});

test("the first visit follows the system when no theme was selected", () => {
  assert.equal(bootstrap(null, false), "light");
  assert.equal(bootstrap(null, true), "dark");
});

test("invalid theme preferences fall back to the system", () => {
  for (const saved of ["", "system", "DARK", "unexpected"]) {
    assert.equal(bootstrap(saved, false), "light");
    assert.equal(bootstrap(saved, true), "dark");
  }
});

test("blocked storage still permits a system theme on the first paint", () => {
  assert.equal(bootstrap(null, true, true), "dark");
  assert.equal(bootstrap(null, false, true), "light");
});

test("client preference reads reject invalid values and tolerate unavailable storage", () => {
  for (const [saved, expected] of [["light", "light"], ["dark", "dark"], ["other", null], [null, null]] as const) {
    Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: { getItem: () => saved } } });
    assert.equal(readThemePreference(), expected);
  }
  Object.defineProperty(globalThis, "window", { configurable: true, value: { get localStorage() { throw new Error("Blocked"); } } });
  assert.equal(readThemePreference(), null);
});

test("theme changes synchronize the root, native controls and both mobile browser bar colors", () => {
  const root = { dataset: {} as Record<string, string>, style: { colorScheme: "" } };
  const metas = [{ content: "#ffffff" }, { content: "#18171b" }];
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    documentElement: root,
    querySelectorAll(selector: string) { assert.equal(selector, 'meta[name="theme-color"]'); return metas; },
  } });
  for (const theme of ["dark", "light"] as const) {
    applyTheme(theme);
    assert.equal(root.dataset.theme, theme);
    assert.equal(root.style.colorScheme, theme);
    assert.ok(metas.every((meta) => meta.content === (theme === "dark" ? "#18171b" : "#ffffff")));
  }
});

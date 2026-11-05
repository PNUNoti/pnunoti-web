export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "pnunoti_theme";
export const SYSTEM_THEME_QUERY = "(prefers-color-scheme: dark)";

export function parseTheme(value: unknown): Theme | null {
  return value === "light" || value === "dark" ? value : null;
}

export function readThemePreference(): Theme | null {
  try { return parseTheme(window.localStorage.getItem(THEME_STORAGE_KEY)); }
  catch { return null; }
}

// The app passes its selected theme without changing the browser's saved choice.
export function readUrlTheme(): Theme | null {
  try { return parseTheme(new URLSearchParams(window.location.search).get("theme")); }
  catch { return null; }
}

export function syncThemeColor(theme: Theme) {
  const color = theme === "dark" ? "#18171b" : "#ffffff";
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    meta.content = color;
  });
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  syncThemeColor(theme);
}

// 첫 화면이 그려지기 전에 저장된 테마를 적용해 새로고침 시 색상이 깜빡이지 않게 한다.
export const THEME_INIT_SCRIPT = `(() => {
  let requested = null;
  try { requested = new URLSearchParams(window.location.search).get("theme"); } catch {}
  let saved = null;
  try { saved = window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)}); } catch {}
  const theme = requested === "light" || requested === "dark" ? requested
    : saved === "light" || saved === "dark" ? saved
    : window.matchMedia(${JSON.stringify(SYSTEM_THEME_QUERY)}).matches ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
})();`;

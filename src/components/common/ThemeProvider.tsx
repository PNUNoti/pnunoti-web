"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { applyTheme, readThemePreference, readUrlTheme, syncThemeColor, SYSTEM_THEME_QUERY, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

type ThemeContextValue = { theme: Theme; ready: boolean; toggleTheme: () => void };
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [ready, setReady] = useState(false);
  const preference = useRef<Theme | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const system = window.matchMedia(SYSTEM_THEME_QUERY);
    preference.current = readUrlTheme() ?? readThemePreference();

    function update() {
      const next = preference.current ?? (system.matches ? "dark" : "light");
      applyTheme(next);
      setTheme(next);
      setReady(true);
    }
    function onSystemChange() { if (preference.current === null) update(); }
    function onStorage(event: StorageEvent) {
      if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
      preference.current = readUrlTheme() ?? readThemePreference();
      update();
    }

    update();
    system.addEventListener("change", onSystemChange);
    window.addEventListener("storage", onStorage);
    return () => {
      system.removeEventListener("change", onSystemChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Next.js가 페이지 이동 시 바꿔 넣는 브라우저 상단 바 색도 선택한 테마에 맞춘다.
  useEffect(() => { if (ready) syncThemeColor(theme); }, [pathname, theme, ready]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    preference.current = next;
    applyTheme(next);
    setTheme(next);
    try { window.localStorage.setItem(THEME_STORAGE_KEY, next); } catch {}
  }

  return <ThemeContext.Provider value={{ theme, ready, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}

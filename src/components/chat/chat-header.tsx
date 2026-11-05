"use client";

import Link from "next/link";
import { type MouseEventHandler } from "react";
import { Moon, Sun } from "lucide-react";
import { isWebView } from "@/app/utils/webview";
import PnuNotiLogo from "@/components/common/PnuNotiLogo";
import { useTheme } from "@/components/common/ThemeProvider";
import { AuroraIcon } from "./aurora-icon";

const focusRing = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tds-blue";

export function ChatHeader({ onRestart }: { onRestart: MouseEventHandler<HTMLAnchorElement> }) {
  const { theme, ready, toggleTheme } = useTheme();
  const themeLabel = ready ? theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환" : "테마 전환";

  return (
    <header className="shrink-0">
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-4 px-5">
        <Link href="/chat" onClick={onRestart} aria-label="공지 AI 처음 화면으로" className={`-mx-1.5 flex items-center gap-0.5 rounded-lg px-1.5 py-1 transition active:scale-95 ${focusRing}`}>
          <PnuNotiLogo className="h-[22px] w-auto" />
          <AuroraIcon className="size-7" />
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={toggleTheme} disabled={!ready} aria-label={themeLabel} title={themeLabel} className={`inline-flex size-8 items-center justify-center rounded-full text-tds-grey-600 transition hover:bg-tds-grey-100 active:scale-95 ${focusRing}`}>
            <Sun size={18} aria-hidden="true" className="hidden dark:block" />
            <Moon size={18} aria-hidden="true" className="dark:hidden" />
          </button>
          {/* 앱에서는 브릿지를 확인하기 전에도 다운로드 버튼이 깜빡이지 않게 한다. */}
          {ready && !isWebView() && (
            <Link href="/" className={`inline-flex h-8 shrink-0 items-center justify-center rounded-full bg-tds-blue-50 px-3.5 text-[13px] font-semibold text-tds-blue transition hover:bg-[color-mix(in_srgb,var(--tds-blue-50),var(--tds-blue)_8%)] active:scale-95 ${focusRing}`}>
              다운로드
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

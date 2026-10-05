"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import AndroidDownloadNotice from "./AndroidDownloadNotice";

interface AndroidDownloadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  source: "hero" | "cta";
}

/** 닫히는 모션(sheet-down 0.26s)이 끝난 뒤에 언마운트시키기 위한 대기 시간 */
const EXIT_DURATION_MS = 260;

export default function AndroidDownloadDialog({
  isOpen,
  onClose,
  source,
}: AndroidDownloadDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const exitTimerRef = useRef<number | null>(null);
  const titleId = useId();
  const [isClosing, setIsClosing] = useState(false);

  const requestClose = useCallback(() => {
    if (exitTimerRef.current !== null) return;

    setIsClosing(true);
    exitTimerRef.current = window.setTimeout(() => {
      exitTimerRef.current = null;
      setIsClosing(false);
      onClose();
    }, EXIT_DURATION_MS);
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();

      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
    };
  }, [isOpen, requestClose]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center bg-tds-grey-900/55 p-0 sm:items-center sm:p-6 ${
        isClosing ? "animate-dim-out" : "animate-dim-in"
      }`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative max-h-[90dvh] w-full overflow-y-auto rounded-t-[20px] bg-white px-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-7 shadow-[0_-8px_32px_rgba(25,31,40,0.12)] outline-none sm:max-w-[400px] sm:rounded-[24px] sm:pb-5 sm:shadow-[0_12px_40px_rgba(25,31,40,0.16)] ${
          isClosing
            ? "animate-sheet-down sm:animate-pop-out"
            : "animate-sheet-up sm:animate-pop-in"
        }`}
      >
        <button
          type="button"
          onClick={requestClose}
          aria-label="Android 앱 설치 안내 닫기"
          className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full text-tds-grey-500 transition active:scale-95 hover:bg-tds-grey-100 hover:text-tds-grey-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tds-blue"
        >
          <X aria-hidden="true" className="size-[22px]" strokeWidth={2.2} />
        </button>

        <AndroidDownloadNotice source={source} titleId={titleId} />
      </div>
    </div>
  );
}

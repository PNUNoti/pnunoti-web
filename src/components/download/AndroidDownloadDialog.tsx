"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import AndroidDownloadNotice from "./AndroidDownloadNotice";

interface AndroidDownloadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  source: "hero" | "cta";
}

export default function AndroidDownloadDialog({
  isOpen,
  onClose,
  source,
}: AndroidDownloadDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-white px-6 pb-8 pt-10 shadow-2xl outline-none sm:max-w-md sm:rounded-3xl sm:px-8"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Android 다운로드 안내 닫기"
          className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <X aria-hidden="true" className="size-5" />
        </button>

        <AndroidDownloadNotice source={source} titleId={titleId} />
      </div>
    </div>
  );
}

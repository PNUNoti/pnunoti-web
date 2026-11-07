"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PLAY_STORE_AVAILABLE, PLAY_STORE_URL } from "@/constants/urls";
import { trackAnalytics as track } from "@/app/utils/analytics";
import AndroidDownloadDialog from "./AndroidDownloadDialog";

// Only this entry point consumes the query, so hero and CTA never open two sheets.
export default function AndroidDownloadEntry() {
  const requested = useSearchParams().get("download") === "android";
  const [isOpen, setIsOpen] = useState(false);
  const handled = useRef(false);

  useEffect(() => {
    if (!requested) {
      handled.current = false;
      setIsOpen(false);
      return;
    }
    if (handled.current) return;
    handled.current = true;
    if (PLAY_STORE_AVAILABLE) {
      track("store_link_clicked", { store: "google-play", source: "qr" });
      window.location.replace(PLAY_STORE_URL);
      return;
    }
    track("android_download_interest", { source: "qr" });
    setIsOpen(true);
  }, [requested]);

  const close = useCallback(() => {
    setIsOpen(false);
    const url = new URL(window.location.href);
    if (url.searchParams.get("download") !== "android") return;
    url.searchParams.delete("download");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  return <AndroidDownloadDialog isOpen={isOpen} onClose={close} source="qr" />;
}

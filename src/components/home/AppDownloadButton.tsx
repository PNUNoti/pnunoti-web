"use client";

import AndroidDownloadDialog from "@/components/download/AndroidDownloadDialog";
import StoreQrDialog from "@/components/download/StoreQrDialog";
import { PLAY_STORE_AVAILABLE } from "@/constants/urls";
import { downloadQrUrl, isMobileDownloadDevice, type AppStore } from "@/lib/app-download";
import { isWebView } from "@/app/utils/webview";
import { trackAnalytics as track } from "@/app/utils/analytics";
import Image from "next/image";
import type { StaticImageData } from "next/image";
import Link from "next/link";
import { useCallback, useRef, useState, type MouseEvent } from "react";

type DownloadButtonSource = "hero" | "cta";

interface AppDownloadButtonProps {
  href: string;
  imageSrc: StaticImageData;
  altText: string;
  store: AppStore;
  source: DownloadButtonSource;
}

export default function AppDownloadButton({
  href,
  imageSrc,
  altText,
  store,
  source,
}: AppDownloadButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const trigger = useRef<HTMLElement | null>(null);
  const isPlayStoreUnavailable =
    store === "google-play" && !PLAY_STORE_AVAILABLE;

  const closeDialog = useCallback(() => setIsDialogOpen(false), []);
  const closeQr = useCallback(() => setIsQrOpen(false), []);

  function handleClick(event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    if (!isWebView() && !isMobileDownloadDevice(navigator.userAgent, navigator.maxTouchPoints)) {
      event.preventDefault();
      trigger.current = event.currentTarget;
      setQrUrl(downloadQrUrl(store, href, window.location.origin));
      setIsQrOpen(true);
      track("store_qr_opened", { store, source });
      return;
    }
    if (isPlayStoreUnavailable) {
      track("android_download_interest", { source });
      setIsDialogOpen(true);
    } else {
      track("store_link_clicked", { store, source });
    }
  }

  return (
    <>
      {isPlayStoreUnavailable ? (
        <button
          type="button"
          onClick={handleClick}
          aria-haspopup="dialog"
          className="group rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-tds-blue"
        >
          <Image
            src={imageSrc}
            alt={altText}
            className="max-w-72 h-auto w-full transition group-hover:opacity-90"
          />
        </button>
      ) : (
        <Link href={href} onClick={handleClick}>
          <Image src={imageSrc} alt={altText} className="max-w-72 h-auto w-full" />
        </Link>
      )}
      <StoreQrDialog isOpen={isQrOpen} onClose={closeQr} store={store} url={qrUrl} triggerRef={trigger} />
      {isPlayStoreUnavailable && (
        <AndroidDownloadDialog
          isOpen={isDialogOpen}
          onClose={closeDialog}
          source={source}
        />
      )}
    </>
  );
}

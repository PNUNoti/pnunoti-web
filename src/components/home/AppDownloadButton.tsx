"use client";

import AndroidDownloadDialog from "@/components/download/AndroidDownloadDialog";
import { PLAY_STORE_AVAILABLE } from "@/constants/urls";
import { track } from "@vercel/analytics";
import Image from "next/image";
import type { StaticImageData } from "next/image";
import Link from "next/link";
import { useCallback, useState } from "react";

type Store = "app-store" | "google-play";
type DownloadButtonSource = "hero" | "cta";

interface AppDownloadButtonProps {
  href: string;
  imageSrc: StaticImageData;
  altText: string;
  store: Store;
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
  const isPlayStoreUnavailable =
    store === "google-play" && !PLAY_STORE_AVAILABLE;

  const closeDialog = useCallback(() => setIsDialogOpen(false), []);

  if (isPlayStoreUnavailable) {
    return (
      <>
        <button
          type="button"
          onClick={() => {
            track("android_download_interest", { source });
            setIsDialogOpen(true);
          }}
          aria-haspopup="dialog"
          className="group rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
        >
          <Image
            src={imageSrc}
            alt={altText}
            className="max-w-72 h-auto w-full opacity-75 transition group-hover:opacity-90"
          />
        </button>

        <AndroidDownloadDialog
          isOpen={isDialogOpen}
          onClose={closeDialog}
          source={source}
        />
      </>
    );
  }

  return (
    <Link href={href}>
      <Image
        src={imageSrc}
        alt={altText}
        className="max-w-72 h-auto w-full"
      />
    </Link>
  );
}

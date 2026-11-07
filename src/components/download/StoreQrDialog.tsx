"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ArrowUpRight, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { RefObject } from "react";
import type { AppStore } from "@/lib/app-download";
import { PLAY_STORE_AVAILABLE } from "@/constants/urls";

interface StoreQrDialogProps {
  isOpen: boolean;
  onClose: () => void;
  store: AppStore;
  url: string;
  triggerRef: RefObject<HTMLElement | null>;
}

export default function StoreQrDialog({ isOpen, onClose, store, url, triggerRef }: StoreQrDialogProps) {
  const isApk = store === "google-play" && !PLAY_STORE_AVAILABLE;
  const destination = store === "app-store" ? "App Store" : isApk ? "Android 설치 안내" : "Google Play";

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-[#191f28]/55 transition-opacity duration-200 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 motion-reduce:transition-none dark:bg-black/70" />
        <Dialog.Popup finalFocus={triggerRef} className="fixed top-1/2 left-1/2 z-50 w-[calc(100%_-_3rem)] max-w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-[24px] bg-background px-6 pt-8 pb-5 text-center text-tds-grey-900 shadow-[0_12px_40px_rgba(25,31,40,0.16)] outline-none transition-[opacity,scale] duration-200 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 motion-reduce:transition-none">
          <Dialog.Close aria-label="설치 QR 코드 닫기" className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full text-tds-grey-500 transition hover:bg-tds-grey-100 hover:text-tds-grey-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tds-blue">
            <X size={20} aria-hidden="true" />
          </Dialog.Close>
          <Dialog.Title className="text-[22px] leading-[1.4] font-bold tracking-[-0.02em]">휴대폰으로 설치하기</Dialog.Title>
          <Dialog.Description className="mt-2 text-[15px] leading-[1.6] tracking-[-0.01em] text-tds-grey-600">
            휴대폰 카메라로 QR 코드를 스캔해주세요.
          </Dialog.Description>
          <div className="mx-auto mt-6 w-fit max-w-full rounded-[20px] border border-tds-grey-100 bg-white p-2">
            <QRCodeSVG value={url} size={224} level="M" marginSize={4} title={`${destination} 연결 QR 코드`} aria-label={`${destination} 연결 QR 코드`} className="h-auto max-w-full" />
          </div>
          <p className="mt-4 text-[14px] font-semibold text-tds-grey-700">{destination}</p>
          {isApk && <p className="mt-1 text-[13px] leading-[1.5] text-tds-grey-500">설치 안내에 따라 APK 파일을 받아주세요.</p>}
          <a href={url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex h-10 items-center justify-center gap-1 rounded-[10px] px-3 text-[13px] text-tds-grey-500 transition hover:bg-tds-grey-50 hover:text-tds-grey-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tds-blue">
            {destination} 열기 <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

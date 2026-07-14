"use client";

import { KAKAO_CHANNEL_URL } from "@/constants/urls";
import { track } from "@vercel/analytics";
import { MessageCircle } from "lucide-react";
import Link from "next/link";

interface AndroidDownloadNoticeProps {
  source: "hero" | "cta" | "invite";
  titleId?: string;
  showHomeLink?: boolean;
}

export default function AndroidDownloadNotice({
  source,
  titleId,
  showHomeLink = false,
}: AndroidDownloadNoticeProps) {
  const handleContactClick = () => {
    track("android_kakao_contact_click", { source });
  };

  return (
    <div className="flex flex-col items-center text-center">
      <h1
        id={titleId}
        className="text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl"
      >
        Android 다운로드 안내
      </h1>

      <p className="mt-3 text-sm leading-6 text-gray-600 sm:text-base">
        현재 PNU Noti의 Google Play 재출시를 준비하고 있어요.
        <br />
        카카오톡 채널을 통해 문의해 주시면 사용하실 수 있도록 안내해
        드릴게요.
      </p>

      {KAKAO_CHANNEL_URL ? (
        <a
          href={KAKAO_CHANNEL_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleContactClick}
          className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#FEE500] px-5 py-3 text-sm font-bold text-[#191919] transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#191919]"
        >
          <MessageCircle aria-hidden="true" className="size-5 fill-current" />
          카카오톡 채널로 문의하기
        </a>
      ) : (
        <div className="mt-6 w-full rounded-xl bg-gray-100 px-5 py-3 text-sm font-semibold text-gray-500">
          카카오톡 문의 링크 준비 중
        </div>
      )}

      {showHomeLink && (
        <Link
          href="/"
          className="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl px-5 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          랜딩페이지로 돌아가기
        </Link>
      )}
    </div>
  );
}

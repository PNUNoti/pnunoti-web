"use client";

import { APK_DOWNLOAD_URL, KAKAO_CHANNEL_URL } from "@/constants/urls";
import { cn } from "@/app/utils/classname";
import { track } from "@vercel/analytics";
import { ArrowDownToLine } from "lucide-react";
import Link from "next/link";

interface AndroidDownloadNoticeProps {
  source: "hero" | "cta" | "invite";
  titleId?: string;
  showHomeLink?: boolean;
}

const INSTALL_STEPS = [
  "다운로드한 파일을 열어주세요.",
  "“출처를 알 수 없는 앱” 설치 허용을 요청하면 허용해 주세요.",
  "Play Protect 경고가 떠도 “무시하고 설치”를 누르면 설치가 완료돼요.",
];

export default function AndroidDownloadNotice({
  source,
  titleId,
  showHomeLink = false,
}: AndroidDownloadNoticeProps) {
  const handleDownloadClick = () => {
    track("android_apk_download_click", { source });
  };

  const handleContactClick = () => {
    track("android_kakao_contact_click", { source });
  };

  return (
    <div className="flex flex-col">
      <h1
        id={titleId}
        className={cn(
          "text-[20px] font-bold leading-[1.4] tracking-[-0.02em] text-tds-grey-900 sm:text-[22px]",
          // 모달에서는 우측 상단 닫기 버튼과 겹치지 않도록 여백 확보
          titleId && "pr-10",
        )}
      >
        안드로이드 앱 설치
      </h1>

      <p className="mt-2 text-[15px] leading-[1.6] tracking-[-0.01em] text-tds-grey-700">
        현재 안드로이드는 설치 파일(APK)을 직접 내려받아 설치하는 방식만
        지원해요.
      </p>

      <div className="mt-5 rounded-2xl bg-tds-grey-50 px-4 py-4">
        <ol className="mt-3 flex flex-col gap-2.5">
          {INSTALL_STEPS.map((step, index) => (
            <li key={step} className="flex items-start gap-2.5">
              <span
                aria-hidden="true"
                className="mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full bg-tds-grey-200 text-[11px] font-bold text-tds-grey-600"
              >
                {index + 1}
              </span>
              <span className="text-[14px] leading-[1.55] tracking-[-0.01em] text-tds-grey-700">
                {step}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <a
        href={APK_DOWNLOAD_URL}
        onClick={handleDownloadClick}
        className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-[14px] bg-tds-blue text-[17px] font-semibold tracking-[-0.01em] text-white transition duration-150 hover:bg-tds-blue-hover active:scale-[0.985] active:bg-tds-blue-active focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tds-blue"
      >
        다운로드
      </a>

      {KAKAO_CHANNEL_URL && (
        <a
          href={KAKAO_CHANNEL_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleContactClick}
          className="flex h-11 w-full items-center justify-center rounded-[14px] text-[14px] tracking-[-0.01em] text-tds-grey-500 transition hover:bg-tds-grey-50 hover:text-tds-grey-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tds-blue"
        >
          설치가 안 되나요? 카카오톡 채널로 문의하기
        </a>
      )}

      {showHomeLink && (
        <Link
          href="/"
          className="flex h-11 w-full items-center justify-center rounded-[14px] text-[14px] font-semibold tracking-[-0.01em] text-tds-grey-500 transition hover:bg-tds-grey-50 hover:text-tds-grey-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tds-blue"
        >
          랜딩페이지로 돌아가기
        </Link>
      )}
    </div>
  );
}

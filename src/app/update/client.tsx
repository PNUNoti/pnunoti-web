"use client";

import { cn } from "@/app/utils/classname";
import { APK_DOWNLOAD_URL, KAKAO_CHANNEL_URL } from "@/constants/urls";
import { track } from "@vercel/analytics";
import { ArrowDownToLine } from "lucide-react";
import SlideUp from "@/components/common/animation/SlideUp";
import type { Lang } from "@/app/utils/lang";

// 공통 SlideUp(1s)보다 빠르게: 이 페이지에서만 애니메이션 시간을 줄인다
const FAST = "[animation-duration:450ms]!";

const COPY = {
  ko: {
    title: "새 버전이 나왔어요",
    subtitle: "아래 순서대로 업데이트해 주세요",
    step1Title: "설치 파일 받기",
    step1Description: "아래 다운로드 버튼을 눌러주세요",
    step2Title: "다운로드한 파일 열기",
    step2Description: "“출처를 알 수 없는 앱” 설치 허용을 요청하면 허용해 주세요",
    step3Title: "업데이트 누르기",
    step3Description: "설치가 안 되면 기존 앱을 삭제한 뒤 다시 설치해 주세요",
    download: "다운로드",
    contact: "업데이트가 안 되나요? 카카오톡 채널로 문의하기",
  },
  en: {
    title: "A new version is available",
    subtitle: "Follow the steps below to update",
    step1Title: "Get the installer",
    step1Description: "Tap the download button below",
    step2Title: "Open the downloaded file",
    step2Description: "If asked, allow installing apps from this source",
    step3Title: "Tap Update",
    step3Description:
      "If it won't install, delete the current app and install again",
    download: "Download",
    contact: "Having trouble? Contact us on KakaoTalk",
  },
};

interface Props {
  isDark: boolean;
  lang: Lang;
}

export function UpdateClient({ isDark, lang }: Props) {
  const copy = COPY[lang];

  return (
    <div
      className={cn(
        "min-h-screen p-4",
        isDark
          ? "bg-pnu-dark-background text-pnu-dark-text-primary"
          : "bg-pnu-light-background text-pnu-light-text-primary"
      )}
    >
      <div className="max-w-md mx-auto">
        <header className="flex flex-col gap-1 font-bold my-10 text-2xl">
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </header>

        {/* 단계 1: 설치 파일 받기 */}
        <SlideUp delay={0} className={FAST}>
          <UpdateStep
            isDark={isDark}
            number={1}
            title={copy.step1Title}
            description={copy.step1Description}
          />
        </SlideUp>

        {/* 단계 2: 파일 열기 */}
        <SlideUp delay={80} className={FAST}>
          <UpdateStep
            isDark={isDark}
            number={2}
            title={copy.step2Title}
            description={copy.step2Description}
          />
        </SlideUp>

        {/* 단계 3: 업데이트 */}
        <SlideUp delay={160} className={FAST}>
          <UpdateStep
            isDark={isDark}
            number={3}
            title={copy.step3Title}
            description={copy.step3Description}
          />
        </SlideUp>

        {/* 다운로드 버튼 */}
        <SlideUp delay={240} className={FAST}>
          <a
            href={APK_DOWNLOAD_URL}
            onClick={() =>
              track("android_apk_download_click", { source: "app-update" })
            }
            className="flex items-center justify-center gap-2 w-full h-14 rounded-xl bg-pnu-light-primary text-white text-lg font-semibold transition-all active:scale-[0.98] hover:brightness-110"
          >
            <ArrowDownToLine className="size-5" />
            {copy.download}
          </a>
        </SlideUp>

        <SlideUp delay={320} className={FAST}>
          <a
            href={KAKAO_CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              track("android_kakao_contact_click", { source: "app-update" })
            }
            className={cn(
              "block text-center text-sm underline underline-offset-4 py-4 mt-2",
              isDark
                ? "text-pnu-dark-text-secondary"
                : "text-pnu-light-text-secondary"
            )}
          >
            {copy.contact}
          </a>
        </SlideUp>
      </div>
    </div>
  );
}

/* ============================================
   하위 컴포넌트
   ============================================ */

interface UpdateStepProps {
  isDark: boolean;
  number: number;
  title: string;
  description: string;
  children?: React.ReactNode;
}

function UpdateStep({
  isDark,
  number,
  title,
  description,
  children,
}: UpdateStepProps) {
  return (
    <section className="space-y-4 mb-8">
      <div className="flex gap-4 items-center">
        <NumberCircle number={number} />
        <div>
          <p className="text-lg font-bold">{title}</p>
          <p
            className={cn(
              isDark
                ? "text-pnu-dark-text-secondary"
                : "text-pnu-light-text-secondary"
            )}
          >
            {description}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

function NumberCircle({ number }: { number: number }) {
  return (
    <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-pnu-dark-primary/10 text-pnu-light-primary text-lg font-bold shrink-0">
      {number}
    </div>
  );
}

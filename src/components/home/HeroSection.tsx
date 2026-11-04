import Image from "next/image";
import Link from "next/link";
import AppDownloadButton from "./AppDownloadButton";
import {
  APP_SCREEN_1,
  DOWNLOAD_ON_APP_STORE,
  DOWNLOAD_ON_PLAY_STORE,
} from "@/constants/images";
import SlideUp from "../common/animation/SlideUp";
import PnuNotiLogo from "../common/PnuNotiLogo";
import { AuroraIcon } from "../chat/aurora-icon";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/constants/urls";

// 가운데 정렬·강조 단어·설명 문구 없이, 원래 문구를 왼쪽 정렬 제목으로 두고 실제 앱 화면을 바로 보여준다.
export default function HeroSection() {
  return (
    <section className="mx-auto w-full max-w-3xl px-3 sm:px-0">
      <PnuNotiLogo alt="PNU Noti" className="h-7 w-auto sm:h-8" />
      <h1 className="mt-8 text-[28px] leading-[1.35] font-semibold tracking-[-0.03em] text-tds-grey-900 sm:mt-10 sm:text-[48px]">
        매번 확인하기
        <br className="sm:hidden" /> 번거로운 공지사항,
        <br />
        이제 알림으로 받아보세요
      </h1>
      {/* 폰에서는 스토어 배지 아래, 넓은 화면에서는 옆에 AI 채팅 버튼을 둔다. 높이는 배지(약 54px)에 맞춘다. */}
      <div className="mt-8 flex max-w-[360px] flex-col gap-3 sm:mt-10 sm:max-w-none sm:flex-row">
        <div className="flex w-full max-w-[360px] gap-2">
          <AppDownloadButton
            href={PLAY_STORE_URL}
            imageSrc={DOWNLOAD_ON_PLAY_STORE}
            altText="Google Play에서 다운로드"
            store="google-play"
            source="hero"
          />
          <AppDownloadButton
            href={APP_STORE_URL}
            imageSrc={DOWNLOAD_ON_APP_STORE}
            altText="App Store에서 다운로드"
            store="app-store"
            source="hero"
          />
        </div>
        <Link
          href="/chat"
          className="relative flex h-[54px] shrink-0 items-center justify-center gap-2 home-ai-button rounded-[10px] px-5 text-white transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-tds-blue"
        >
          <span aria-hidden="true" className="home-ai-glow" />
          <span aria-hidden="true" className="home-ai-aurora" />
          <AuroraIcon animated className="size-6" />
          <span className="home-ai-label">PNU Noti AI</span>
          {/* 버튼 아래에 붙는 말풍선. 폰에서도 보이도록 항상 띄워 둔다 */}
          <span className="pointer-events-none absolute top-full left-1/2 z-10 mt-2.5 -translate-x-1/2 animate-tooltip rounded-lg bg-tds-grey-900 px-3 py-2 text-[13px] leading-none font-medium whitespace-nowrap text-background shadow-[0_4px_16px_rgba(25,31,40,0.16)]">
            <span aria-hidden="true" className="absolute -top-1 left-1/2 size-2.5 -translate-x-1/2 rotate-45 rounded-[2px] bg-tds-grey-900" />
            딱 맞는 공지를 AI가 찾아드려요
          </span>
        </Link>
      </div>
      <SlideUp className="mt-16">
        <Image
          src={APP_SCREEN_1}
          alt="앱 화면 미리보기"
          className="h-auto w-full"
        />
      </SlideUp>
    </section>
  );
}

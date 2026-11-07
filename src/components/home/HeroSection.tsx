import Image from "next/image";
import HomeActions from "./HomeActions";
import { APP_SCREEN_1 } from "@/constants/images";
import SlideUp from "../common/animation/SlideUp";
import PnuNotiLogo from "../common/PnuNotiLogo";

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
      <HomeActions source="hero" className="mt-8 sm:mt-10" />
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

import Image from "next/image";
import AppDownloadButton from "./AppDownloadButton";
import {
  APP_SCREEN_1,
  DOWNLOAD_ON_APP_STORE,
  DOWNLOAD_ON_PLAY_STORE,
  PNU_NOTI_LOGO,
} from "@/constants/images";
import SlideUp from "../common/animation/SlideUp";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/constants/urls";

export default function HeroSection() {
  return (
    <section className="flex flex-col items-center sm:gap-12 gap-8">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-blue-600 sm:text-4xl text-2xl font-bold">
          부산대 공지사항 알리미
        </h1>
        <Image
          src={PNU_NOTI_LOGO}
          alt="PNU Noti 로고"
          className="max-w-3xl h-full w-full px-8"
          width={1000}
          height={1000}
        />
      </div>
      <div className="flex flex-col gap-2 w-full">
        <p className="sm:text-2xl text-lg font-bold text-white bg-black rounded-2xl px-4 py-6 text-center">
          매번 확인하기 번거로운 <span className="text-blue-600">공지사항</span>
          <br />
          이제 <span className="text-blue-600">알림</span>으로 받아보세요!
        </p>
        <div className="flex gap-2 mx-auto">
          <AppDownloadButton
            href={PLAY_STORE_URL}
            imageSrc={DOWNLOAD_ON_PLAY_STORE}
            altText="Google Play에서 다운로드"
          />
          <AppDownloadButton
            href={APP_STORE_URL}
            imageSrc={DOWNLOAD_ON_APP_STORE}
            altText="App Store에서 다운로드"
          />
        </div>
      </div>
      <SlideUp>
        <Image
          src={APP_SCREEN_1}
          alt="앱 화면 미리보기"
          className="max-w-3xl h-full w-full"
          width={1000}
          height={1000}
        />
      </SlideUp>
    </section>
  );
}

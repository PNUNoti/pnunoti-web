import {
  DOWNLOAD_ON_APP_STORE,
  DOWNLOAD_ON_PLAY_STORE,
} from "@/constants/images";
import AppDownloadButton from "./AppDownloadButton";

import { APP_STORE_URL, PLAY_STORE_URL } from "@/constants/urls";

export default function CallToAction() {
  return (
    <div className="bg-white sm:p-10 p-4">
      <div className="flex flex-col gap-4 bg-black rounded-2xl py-10 sm:px-28 px-10">
        <p className="sm:text-4xl text-2xl text-white font-bold">
          부산대 공지사항 알리미 <br />
          <span className="text-blue-600">PNU Noti</span>의 첫 사용자가
          되어보세요!
        </p>
        <p className="sm:text-lg text-sm text-white">
          아래 버튼을 클릭하시면 해당 스토어로 이동합니다.
        </p>
        <div className="flex flex-col gap-2">
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
    </div>
  );
}

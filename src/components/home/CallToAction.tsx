import {
  DOWNLOAD_ON_APP_STORE,
  DOWNLOAD_ON_PLAY_STORE,
} from "@/constants/images";
import Container from "@/components/common/Container";
import AppDownloadButton from "./AppDownloadButton";

import { APP_STORE_URL, PLAY_STORE_URL } from "@/constants/urls";

// 마지막 다운로드 안내도 히어로와 같은 왼쪽 정렬 폭에 맞춘다.
export default function CallToAction() {
  return (
    <Container>
      <section className="mx-auto max-w-3xl px-3 py-20 sm:px-0 sm:py-28">
        <h2 className="text-[24px] leading-[1.4] font-semibold tracking-[-0.02em] text-tds-grey-900 sm:text-[30px]">
          부산대 공지사항 알리미,
          <br />
          PNU Noti의 첫 사용자가 되어보세요
        </h2>
        <div className="mt-8 flex max-w-[360px] gap-2">
          <AppDownloadButton
            href={PLAY_STORE_URL}
            imageSrc={DOWNLOAD_ON_PLAY_STORE}
            altText="Google Play에서 다운로드"
            store="google-play"
            source="cta"
          />
          <AppDownloadButton
            href={APP_STORE_URL}
            imageSrc={DOWNLOAD_ON_APP_STORE}
            altText="App Store에서 다운로드"
            store="app-store"
            source="cta"
          />
        </div>
      </section>
    </Container>
  );
}

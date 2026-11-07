import Container from "@/components/common/Container";
import HomeActions from "./HomeActions";

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
        <HomeActions source="cta" className="mt-8" />
      </section>
    </Container>
  );
}

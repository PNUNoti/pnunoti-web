import type { Viewport } from "next";
import Container from "@/components/common/Container";
import HeroSection from "@/components/home/HeroSection";
import FeatureSection from "@/components/home/FeatureSection";
import CallToAction from "@/components/home/CallToAction";
import { APP_SCREEN_2, APP_SCREEN_3, APP_SCREEN_4 } from "@/constants/images";

// 모바일 브라우저 상단 바 색을 화면 바탕과 맞춘다.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#18171b" },
  ],
};

export default function Home() {
  return (
    <div className="bg-background pt-14 sm:pt-24">
      <Container>
        <HeroSection />
      </Container>

      {/* 기능 소개 영역: 히어로와 같은 폭·왼쪽 정렬, 연회색 띠로만 구분한다 */}
      <div className="bg-tds-grey-50 py-20 sm:py-28">
        <Container>
          <div className="mx-auto flex max-w-3xl flex-col gap-20 px-3 sm:gap-28 sm:px-0">
            <FeatureSection
              title="공지사항 알림"
              headline="이제 공지사항 놓치지 마세요"
              description={
                "PNU Noti와 함께라면 매번 공지사항 홈페이지를 확인할 필요가 없어요.\n중요한 공지사항을 놓치지 않도록 게시물이 업로드되면 알려드릴게요."
              }
              image={APP_SCREEN_2}
            />
            <FeatureSection
              title="스크랩"
              headline="중요한 공지, 한 곳에 모아두세요"
              description={
                "필요한 공지사항을 스크랩해 언제든지 확인할 수 있어요.\n중요한 공지는 저장해두고 나중에 다시 찾아보세요."
              }
              image={APP_SCREEN_3}
            />
            <FeatureSection
              title="100여 개 교내 게시판"
              headline={"흩어져 있는 교내 게시판,\n한 번에 확인하세요"}
              description={
                "흩어져 있는 교내 공지사항을 이제 앱 하나에서 확인할 수 있어요.\n학사, 장학금, 행사 등 원하는 정보를 한눈에 확인하세요."
              }
              image={APP_SCREEN_4}
            />
          </div>
        </Container>
      </div>

      {/* CTA 영역 */}
      <CallToAction />
    </div>
  );
}

import Container from "@/components/common/Container";
import SlideUp from "@/components/common/animation/SlideUp";
import HeroSection from "@/components/home/HeroSection";
import FeatureSection from "@/components/home/FeatureSection";
import CallToAction from "@/components/home/CallToAction";
import { APP_SCREEN_2, APP_SCREEN_3, APP_SCREEN_4 } from "@/constants/images";

export default function Home() {
  return (
    <div className="bg-gradient-to-b from-blue-200 to-blue-400 pt-24">
      <Container>
        <HeroSection />
      </Container>

      {/* 기능 소개 영역 */}
      <div className="bg-black text-white py-20 rounded-t-3xl">
        <SlideUp className="text-center">
          <h2 className="sm:text-4xl text-2xl font-bold">
            <span className="text-blue-600">PNU Noti</span> 앱 다운로드 하고
            <br />
            공지사항 알림을 받아보세요
          </h2>
        </SlideUp>
        <div className="mt-16 flex flex-col items-center gap-10">
          <FeatureSection
            title="공지사항 알림"
            headline={"이제 공지사항 놓치지 마세요!"}
            description={
              "PNU Noti와 함께라면 매번 공지사항 홈페이지를 확인할 필요가 없어요!\n중요한 공지사항을 놓치지 않도록 게시물이 업로드되면 알려드릴게요"
            }
            image={APP_SCREEN_2}
          />
          <FeatureSection
            title="스크랩"
            headline={"중요한 공지, 한 곳에 모아두세요!"}
            description={
              "필요한 공지사항을 스크랩해 언제든지 확인할 수 있어요.\n중요한 공지는 저장해두고 나중에 다시 찾아보세요."
            }
            image={APP_SCREEN_3}
            reverse
          />
          <FeatureSection
            title="100여개 이상의 교내 게시판"
            headline={"흩어져 있는 교내 게시판,\n한 번에 확인하세요!"}
            description={
              "흩어져 있는 교내 공지사항을 이제 앱 하나에서 확인할 수 있어요.\n학사, 장학금, 행사 등 원하는 정보를 한 눈에 확인하세요."
            }
            image={APP_SCREEN_4}
          />
        </div>
      </div>

      {/* CTA 영역 */}
      <CallToAction />
    </div>
  );
}

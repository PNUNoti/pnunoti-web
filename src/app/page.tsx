import Container from "@/components/common/Container";
import SlideUp from "@/components/common/animation/SlideUp";
import CallToAction from "@/components/home/CallToAction";

import HeroSection from "@/components/home/HeroSection";
// import FeatureSection from "@/components/home/FeatureSection";

// import AppScreen2 from "/public/images/app_screen_2.png";
// import AppScreen3 from "/public/images/app_screen_3.png";
// import AppScreen4 from "/public/images/app_screen_4.png";

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
            <span className="text-blue-600">뉴젯</span>과 함께 뉴스레터를 읽고
            <br />
            지식을 쌓아보세요!
          </h2>
        </SlideUp>
        {/* <div className="mt-16 flex flex-col items-center gap-10">
          <FeatureSection
            title="나만의 뉴스레터 캘린더"
            headline={"하루하루 쌓아가는\n뉴스레터 기록!"}
            description={
              "뉴스레터 꾸준히 읽기가 어렵다고 생각했나요?\n읽기만 하면 자동으로 뉴스레터가 캘린더에 기록돼요!\n뱃지를 모으고, 캘린더를 채우며 즐겁게 뉴스레터를 소비해요."
            }
            image={AppScreen2}
          />
          <FeatureSection
            title="뉴스레터만을 위한 공간"
            headline={"복잡한 메일함은 이제 그만!"}
            description={
              "뉴스레터 구독 전용 메일을 통해 메일함과 분리된 환경에서\n뉴스레터를 읽고 관리하세요!\n뉴스레터에 최적화된 환경에서 뉴스레터를 소비해요."
            }
            image={AppScreen3}
            reverse
          />
          <FeatureSection
            title="관심분야의 뉴스레터 추천"
            headline={"나에게 딱 맞는\n뉴스레터 추천!"}
            description={
              "어떤 뉴스레터가 재미있을지 고민하시나요?\n관심분야의 뉴스레터를 추천 받고 손쉽게 구독하세요!\n뉴젯에는 100개 이상의 뉴스레터가 모여 있어요."
            }
            image={AppScreen4}
          />
        </div> */}
      </div>

      {/* CTA 영역 */}
      <CallToAction />
    </div>
  );
}

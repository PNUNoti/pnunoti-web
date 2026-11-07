import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import SlideUp from "../common/animation/SlideUp";
import BetaBadge from "../common/BetaBadge";

// 채팅 답변의 출처 번호 배지와 같은 모양
function Citation({ number }: { number: number }) {
  return <span className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-tds-grey-100 px-1.5 align-[1px] text-[11px] leading-none font-semibold text-tds-grey-600">{number}</span>;
}

// 다른 기능 소개와 같은 틀(파란 라벨·제목·두 문장 설명). 오른쪽에는 앱 화면 대신
// 실제 채팅 화면의 요소(질문 말풍선, 출처 번호가 붙은 답변, 출처 칩)를 그대로 줄여 보여준다.
export default function AiFeatureSection() {
  return (
    <section aria-labelledby="home-ai-title" className="grid items-center gap-8 sm:grid-cols-2 sm:gap-12">
      <SlideUp>
        <p className="flex items-center gap-1.5 text-[15px] font-semibold text-tds-blue">PNU Noti AI<BetaBadge /></p>
        <h2 id="home-ai-title" className="mt-3 text-[24px] leading-[1.4] font-semibold tracking-[-0.02em] text-balance text-tds-grey-900 sm:text-[30px]">
          필요한 공지,
          <br />
          이제 질문으로 찾아보세요
        </h2>
        <p className="mt-4 text-[16px] leading-[1.7] text-tds-grey-700">
          궁금한 내용을 물어보면 여러 게시판의 공지를 찾아 신청 조건과 마감일을 정리해드려요.
          <br />
          답변의 출처를 눌러 원문도 바로 확인할 수 있어요.
        </p>
        <Link href="/chat" className="mt-5 inline-flex min-h-11 items-center gap-0.5 rounded-lg text-[15px] font-semibold text-tds-blue transition hover:text-tds-blue-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-tds-blue">
          AI에게 물어보기<ChevronRight size={18} aria-hidden="true" />
        </Link>
      </SlideUp>
      <SlideUp>
        <div aria-hidden="true" className="rounded-[24px] bg-background p-5 sm:p-6">
          <p className="ml-auto w-fit max-w-[85%] rounded-[20px] bg-tds-blue px-4 py-2.5 text-[15px] leading-[1.6] text-white">
            소득 구간 제한 없는 장학금 있어?
          </p>
          <p className="mt-6 text-[15px] leading-[1.75] text-tds-grey-800">
            성적우수 장학금은 소득 구간과 관계없이 직전 학기 성적으로 선발해요<Citation number={1} />. 신청은 공지된 기간에 학생지원시스템에서 할 수 있어요<Citation number={2} />.
          </p>
          <span className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-full bg-tds-grey-100 px-2.5 text-[13px] font-medium text-tds-grey-600">
            <FileText size={14} />출처 2개
          </span>
        </div>
      </SlideUp>
    </section>
  );
}

"use client";

import Card from "@/components/common/Card";
import { cn } from "@/app/utils/classname";
import { deeplinkTo } from "@/app/utils/webview";
import { ChevronRight } from "lucide-react";
import SlideUp from "@/components/common/animation/SlideUp";
import type { Lang } from "@/app/utils/lang";

const BOARD_IDS = {
  university: "1846cad0-51dc-4e76-a31e-2111fd3f0aa4",
  studentSupport: "5caa12f8-4682-4e1d-a2f8-18901c2675fc",
  scholarship: "9e27bbc7-74d7-40f2-b5b2-e57053d5cff3",
  departmentRoot: "e8aa25ac-c7c8-475b-b296-756ad9078886",
};

const COPY = {
  ko: {
    title: "꼭 구독해야 하는 게시판",
    subtitle: "추천 공지사항을 확인해 보세요",
    section1Title: "대학공지/학생지원시스템 공지",
    section1Description: "교내 행사, 공모전 정보를 확인할 수 있어요",
    section2Title: "교내 장학공지",
    section2Description: "교내 장학금 관련 소식을 받아보세요",
    section3Title: "학과 공지사항",
    section3Description: "학과별 일정, 행사 공지사항을 확인할 수 있어요",
    university: { title: "대학공지", description: "공지사항" },
    studentSupport: { title: "학생지원시스템공지", description: "학생지원시스템" },
    scholarship: { title: "장학공지", description: "학생지원시스템" },
    department: { title: "학과/학부", description: "학과 게시판 찾아보기" },
  },
  en: {
    title: "Boards you should subscribe to",
    subtitle: "Check out our recommended notices",
    section1Title: "University & Student Support notices",
    section1Description: "Campus events and competitions",
    section2Title: "Scholarship notices",
    section2Description: "Get news about on-campus scholarships",
    section3Title: "Department notices",
    section3Description: "Schedules and events from your department",
    university: { title: "University Notices", description: "Notices" },
    studentSupport: {
      title: "Student Support System Notices",
      description: "Student Support System",
    },
    scholarship: {
      title: "Scholarship Notices",
      description: "Student Support System",
    },
    department: {
      title: "Departments",
      description: "Find your department's board",
    },
  },
};

interface Props {
  isDark: boolean;
  lang: Lang;
}

export function BoardRecommendClient({ isDark, lang }: Props) {
  const copy = COPY[lang];

  return (
    <div
      className={cn(
        "min-h-screen p-4",
        isDark
          ? "bg-pnu-dark-background text-pnu-dark-text-primary"
          : "bg-pnu-light-background text-pnu-light-text-primary"
      )}
    >
      <div className="max-w-md mx-auto">
        <header className="flex flex-col gap-1 font-bold my-10 text-2xl">
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </header>

        {/* 섹션 1: 대학공지/학생지원시스템 공지 */}
        <SlideUp delay={0}>
          <RecommendSection
            isDark={isDark}
            number={1}
            title={copy.section1Title}
            description={copy.section1Description}
          >
            <BoardListItem
              isDark={isDark}
              title={copy.university.title}
              description={copy.university.description}
              onClick={() =>
                deeplinkTo(
                  `/board/${BOARD_IDS.university}?title=${copy.university.title}`
                )
              }
            />
            <BoardListItem
              isDark={isDark}
              title={copy.studentSupport.title}
              description={copy.studentSupport.description}
              onClick={() =>
                deeplinkTo(
                  `/board/${BOARD_IDS.studentSupport}?title=${copy.studentSupport.title}`
                )
              }
            />
          </RecommendSection>
        </SlideUp>

        {/* 섹션 2: 교내 장학공지 */}
        <SlideUp delay={300}>
          <RecommendSection
            isDark={isDark}
            number={2}
            title={copy.section2Title}
            description={copy.section2Description}
          >
            <BoardListItem
              isDark={isDark}
              title={copy.scholarship.title}
              description={copy.scholarship.description}
              onClick={() =>
                deeplinkTo(
                  `/board/${BOARD_IDS.scholarship}?title=${copy.scholarship.title}`
                )
              }
            />
          </RecommendSection>
        </SlideUp>

        {/* 섹션 3: 학과 공지사항 */}
        <SlideUp delay={600}>
          <RecommendSection
            isDark={isDark}
            number={3}
            title={copy.section3Title}
            description={copy.section3Description}
          >
            <BoardListItem
              isDark={isDark}
              title={copy.department.title}
              description={copy.department.description}
              onClick={() =>
                deeplinkTo(
                  `/subscription/${BOARD_IDS.departmentRoot}?title=${copy.department.title}`
                )
              }
            />
          </RecommendSection>
        </SlideUp>
      </div>
    </div>
  );
}

/* ============================================
   하위 컴포넌트
   ============================================ */

interface RecommendSectionProps {
  isDark: boolean;
  number: number;
  title: string;
  description: string;
  children: React.ReactNode;
}

function RecommendSection({
  isDark,
  number,
  title,
  description,
  children,
}: RecommendSectionProps) {
  return (
    <section className="space-y-4 mb-8">
      <div className="flex gap-4 items-center">
        <NumberCircle number={number} />
        <div>
          <p className="text-lg font-bold">{title}</p>
          <p
            className={cn(
              isDark
                ? "text-pnu-dark-text-secondary"
                : "text-pnu-light-text-secondary"
            )}
          >
            {description}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

function NumberCircle({ number }: { number: number }) {
  return (
    <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-pnu-dark-primary/10 text-pnu-light-primary text-lg font-bold shrink-0">
      {number}
    </div>
  );
}

interface BoardListItemProps {
  isDark: boolean;
  title: string;
  description: string;
  onClick: () => void;
}

function BoardListItem({
  isDark,
  title,
  description,
  onClick,
}: BoardListItemProps) {
  return (
    <Card
      className={cn(
        "flex items-center justify-between w-full p-4 rounded-xl text-left transition-all active:scale-[0.98]",
        isDark
          ? "bg-pnu-dark-surface hover:brightness-110"
          : "bg-pnu-light-surface hover:brightness-95"
      )}
      onClick={onClick}
    >
      <div>
        <p className="font-semibold">{title}</p>
        <p
          className={cn(
            "text-sm",
            isDark
              ? "text-pnu-dark-text-secondary"
              : "text-pnu-light-text-secondary"
          )}
        >
          {description}
        </p>
      </div>
      <ChevronRight />
    </Card>
  );
}

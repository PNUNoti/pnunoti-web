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
  internationalStudent: "53d45a44-afd5-437b-a6ba-4997fc1814b6",
};

interface RecommendBoard {
  title: string;
  description: string;
  // 앱 딥링크. ?title= 은 앱 화면 제목이 되므로 항상 DB의 게시판 이름을 쓴다.
  path: string;
}

interface RecommendSectionContent {
  title: string;
  description: string;
  boards: RecommendBoard[];
}

interface PageContent {
  title: string;
  subtitle: string;
  sections: RecommendSectionContent[];
}

const CONTENT: Record<Lang, PageContent> = {
  ko: {
    title: "꼭 구독해야 하는 게시판",
    subtitle: "추천 공지사항을 확인해 보세요",
    sections: [
      {
        title: "대학공지/학생지원시스템 공지",
        description: "교내 행사, 공모전 정보를 확인할 수 있어요",
        boards: [
          {
            title: "대학공지",
            description: "공지사항",
            path: `/board/${BOARD_IDS.university}?title=대학공지`,
          },
          {
            title: "학생지원시스템공지",
            description: "학생지원시스템",
            path: `/board/${BOARD_IDS.studentSupport}?title=학생지원시스템공지`,
          },
        ],
      },
      {
        title: "교내 장학공지",
        description: "교내 장학금 관련 소식을 받아보세요",
        boards: [
          {
            title: "장학공지",
            description: "학생지원시스템",
            path: `/board/${BOARD_IDS.scholarship}?title=장학공지`,
          },
        ],
      },
      {
        title: "학과 공지사항",
        description: "학과별 일정, 행사 공지사항을 확인할 수 있어요",
        boards: [
          {
            title: "학과/학부",
            description: "학과 게시판 찾아보기",
            path: `/subscription/${BOARD_IDS.departmentRoot}?title=학과/학부`,
          },
        ],
      },
    ],
  },
  // 영어 사용자는 대부분 외국인 유학생이라 유학생에게 필요한 게시판 위주로 추천한다.
  // 장학공지는 국가장학금 등 내국인 대상 공지가 대부분이라 제외했다.
  // (유학생 장학금은 Notice for International student에 올라온다)
  en: {
    title: "Recommended boards for international students",
    subtitle: "Start with these boards",
    sections: [
      {
        title: "International student notices",
        description:
          "Courses, residence cards, events and scholarships for international students",
        boards: [
          {
            title: "Notice for International student",
            description: "Office of International Affairs",
            path: `/board/${BOARD_IDS.internationalStudent}?title=Notice for International student`,
          },
        ],
      },
      {
        title: "Your department notices",
        description: "Schedules and events from your department",
        boards: [
          {
            title: "Find your department",
            description: "학과/학부",
            path: `/subscription/${BOARD_IDS.departmentRoot}?title=학과/학부`,
          },
        ],
      },
      {
        title: "University-wide notices",
        description: "Official PNU announcements, mostly in Korean",
        boards: [
          {
            title: "University Notices",
            description: "대학공지",
            path: `/board/${BOARD_IDS.university}?title=대학공지`,
          },
          {
            title: "Student Support System Notices",
            description: "학생지원시스템공지",
            path: `/board/${BOARD_IDS.studentSupport}?title=학생지원시스템공지`,
          },
        ],
      },
    ],
  },
};

interface Props {
  isDark: boolean;
  lang: Lang;
}

export function BoardRecommendClient({ isDark, lang }: Props) {
  const content = CONTENT[lang];

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
          <h1>{content.title}</h1>
          <p>{content.subtitle}</p>
        </header>

        {content.sections.map((section, index) => (
          <SlideUp key={section.title} delay={index * 300}>
            <RecommendSection
              isDark={isDark}
              number={index + 1}
              title={section.title}
              description={section.description}
            >
              {section.boards.map((board) => (
                <BoardListItem
                  key={board.path}
                  isDark={isDark}
                  title={board.title}
                  description={board.description}
                  onClick={() => deeplinkTo(board.path)}
                />
              ))}
            </RecommendSection>
          </SlideUp>
        ))}
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

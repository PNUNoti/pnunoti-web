"use client";

import Card from "@/components/common/Card";
import { cn } from "@/app/utils/classname";
import { ChevronRight } from "lucide-react";

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
    onAppResponse?: (result: {
      success: boolean;
      action?: string;
      error?: string;
    }) => void;
  }
}

interface Props {
  isDark: boolean;
}

export function BoardRecommendClient({ isDark }: Props) {
  const deeplinkTo = (path: string) => {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          action: {
            type: "DEEP_LINK",
            payload: path,
          },
        })
      );
    }
  };

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
        <header className="flex flex-col gap-1 font-bold my-10 text-xl">
          <h1>꼭 구독해야 하는 게시판</h1>
          <p>추천 게시판을 확인해 보세요</p>
        </header>

        {/* 섹션 1: 대학공지/학생지원시스템 공지 */}
        <RecommendSection
          isDark={isDark}
          number={1}
          title="대학공지/학생지원시스템 공지"
          description="교내 행사, 공모전 정보를 확인할 수 있어요"
        >
          <BoardListItem
            isDark={isDark}
            title="대학공지"
            description="공지사항"
            onClick={() =>
              deeplinkTo(
                "/board/1846cad0-51dc-4e76-a31e-2111fd3f0aa4?title=대학공지"
              )
            }
          />
          <BoardListItem
            isDark={isDark}
            title="학생지원시스템공지"
            description="학생지원시스템"
            onClick={() =>
              deeplinkTo(
                "/board/5caa12f8-4682-4e1d-a2f8-18901c2675fc?title=학생지원시스템공지"
              )
            }
          />
        </RecommendSection>

        {/* 섹션 2: 교내 장학공지 */}
        <RecommendSection
          isDark={isDark}
          number={2}
          title="교내 장학공지"
          description="교내 장학금 관련 소식을 받아보세요"
        >
          <BoardListItem
            isDark={isDark}
            title="장학공지"
            description="학생지원시스템"
            onClick={() =>
              deeplinkTo(
                "/board/9e27bbc7-74d7-40f2-b5b2-e57053d5cff3?title=장학공지"
              )
            }
          />
        </RecommendSection>

        {/* 섹션 3: 학과 공지사항 */}
        <RecommendSection
          isDark={isDark}
          number={3}
          title="학과 공지사항"
          description="학과별 일정, 행사 공지사항을 확인할 수 있어요"
        >
          <BoardListItem
            isDark={isDark}
            title="학과/학부"
            description="내 학과 게시판 구독하러 가기"
            onClick={() =>
              deeplinkTo(
                "/subscription/e8aa25ac-c7c8-475b-b296-756ad9078886?title=학과/학부"
              )
            }
          />
        </RecommendSection>
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

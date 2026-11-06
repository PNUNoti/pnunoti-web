"use client";

import React from "react";
import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import { Trace, TraceCollapsible, TraceCollapsibleContent, TraceCollapsibleTrigger, TraceIcon, TraceLine, TraceTitle } from "@/components/ui/trace";
import { chatProgressTimeline, type ChatEvent } from "@/lib/chat-types";

// 확인 과정: 실제 단계와 에이전트 설명 문장을 나온 순서대로 한 목록에 접어 둔다.
// 대기 화면 본문에는 메인 문구와 보조 안내만 두고, 자세한 과정은 여기서 펼쳐 본다.
export function ChatProgressTrace({ events, settled = false }: { events: ChatEvent[]; settled?: boolean }) {
  const items = chatProgressTimeline(events);
  if (!items.length) return null;
  return (
    <Trace className="my-3" aria-label="답변 확인 과정">
      <TraceCollapsible>
        <TraceCollapsibleTrigger className="text-[13px]">확인 과정</TraceCollapsibleTrigger>
        <TraceCollapsibleContent className="space-y-2.5 border-tds-grey-200">
          {items.map((item) => {
            if (item.kind === "narration") {
              return (
                <TraceLine key={item.step_id} className="items-start text-[13px] leading-[1.6]">
                  <TraceIcon className="mt-[3px]"><span className="size-1 rounded-full bg-current" /></TraceIcon>
                  <TraceTitle className="overflow-visible text-wrap whitespace-pre-wrap text-tds-grey-600">{item.label}</TraceTitle>
                </TraceLine>
              );
            }
            const running = item.status === "running" && !settled;
            return (
              <TraceLine key={item.step_id} status={item.status === "failed" ? "error" : running ? "running" : undefined} className="items-start text-[13px] leading-[1.6]">
                <TraceIcon className="mt-[3px]">
                  {item.status === "failed" ? <CircleAlert /> : running ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : item.status === "completed" ? <Check /> : <span className="size-1 rounded-full bg-current" />}
                </TraceIcon>
                <TraceTitle className="overflow-visible text-wrap whitespace-normal">{item.label}</TraceTitle>
                <span className="sr-only">{item.status === "failed" ? "실패" : running ? "진행 중" : item.status === "completed" ? "완료" : "중단"}</span>
              </TraceLine>
            );
          })}
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  );
}

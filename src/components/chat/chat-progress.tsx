"use client";

import React from "react";
import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import { Trace, TraceCollapsible, TraceCollapsibleContent, TraceCollapsibleTrigger, TraceIcon, TraceLine, TraceTitle } from "@/components/ui/trace";
import { chatProgressTimeline, type ChatEvent } from "@/lib/chat-types";

const summaryLabel = /^확인(?:한|된)\s+내용을\s+정리하고\s+있어요[.!…]*$/;
const isSummaryLabel = (label: string) => summaryLabel.test(label.trim());

// 설명 문장은 도구 단계와 중복되므로 제외하고, 끝난 요청의 미완료 단계도 숨긴다.
export function chatTraceItems(events: ChatEvent[], settled = false) {
  return chatProgressTimeline(events).filter(item => item.kind !== "narration" && !isSummaryLabel(item.label) && !(settled && item.status === "running"));
}

// 서버 문구(설명 문장·단계 이름)는 길 수 있어, 메인 한 줄에는 첫 문장만 쓰고 길면 줄인다.
function brief(text: string) {
  const first = text.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? text;
  return first.length > 60 ? first.slice(0, 59).trimEnd() + "…" : first;
}

// 대기 화면 메인 한 줄: 가장 최근에 들어온 신호를 유지한다.
// 도구가 끝나도 고정 문구로 돌아가지 않고, 끝난 일에 이어지는 문구를 보여준다.
// 진행 정보가 전혀 없으면 null을 돌려주고, 화면은 경과 시간 문구를 쓴다.
export function chatActivityLabel(events: ChatEvent[]): string | null {
  const last = events.findLast((event) => event.progress && !isSummaryLabel(event.progress.label))?.progress;
  if (!last) return null;
  if (last.kind === "narration" || last.status === "running") return brief(last.label);
  if (/검색|찾/.test(last.label)) return "찾은 공지를 살펴보고 있어요";
  if (/본문|읽/.test(last.label)) return "읽은 내용을 정리하고 있어요";
  return brief(last.label);
}

// 확인 과정: 실제 작업 단계만 나온 순서대로 한 목록에 접어 둔다.
// 대기 화면 본문에는 메인 문구와 보조 안내만 두고, 자세한 과정은 여기서 펼쳐 본다.
export function ChatProgressTrace({ events, settled = false }: { events: ChatEvent[]; settled?: boolean }) {
  const items = chatTraceItems(events, settled);
  if (!items.length) return null;
  return (
    <Trace className="my-3" aria-label="답변 확인 과정">
      <TraceCollapsible>
        <TraceCollapsibleTrigger className="text-[13px]">확인 과정</TraceCollapsibleTrigger>
        <TraceCollapsibleContent className="space-y-2.5 border-tds-grey-200">
          {items.map((item) => {
            const running = item.status === "running";
            return (
              <TraceLine key={item.step_id} status={item.status === "failed" ? "error" : running ? "running" : undefined} className="items-start text-[13px] leading-[1.6]">
                <TraceIcon className="mt-[3px]">
                  {item.status === "failed" ? <CircleAlert /> : running ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : <Check />}
                </TraceIcon>
                <TraceTitle className="overflow-visible text-wrap whitespace-normal">{item.label}</TraceTitle>
                <span className="sr-only">{item.status === "failed" ? "실패" : running ? "진행 중" : "완료"}</span>
              </TraceLine>
            );
          })}
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  );
}

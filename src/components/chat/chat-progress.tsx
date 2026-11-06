"use client";

import React from "react";
import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import { Trace, TraceCollapsible, TraceCollapsibleContent, TraceCollapsibleTrigger, TraceIcon, TraceLine, TraceTitle } from "@/components/ui/trace";
import { chatProgressSteps, type ChatEvent } from "@/lib/chat-types";

export function ChatProgressTrace({ events, settled = false }: { events: ChatEvent[]; settled?: boolean }) {
  const steps = chatProgressSteps(events);
  if (!steps.length) return null;
  return (
    <Trace className="my-3" aria-label="답변 확인 과정">
      <TraceCollapsible>
        <TraceCollapsibleTrigger className="text-[13px]">확인 과정</TraceCollapsibleTrigger>
        <TraceCollapsibleContent className="space-y-2.5 border-tds-grey-200">
          {steps.map((step) => {
            const running = step.status === "running" && !settled;
            return (
              <TraceLine key={step.step_id} status={step.status === "failed" ? "error" : running ? "running" : undefined} className="items-start text-[13px] leading-[1.6]">
                <TraceIcon className="mt-[3px]">
                  {step.status === "failed" ? <CircleAlert /> : running ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : step.status === "completed" ? <Check /> : <span className="size-1 rounded-full bg-current" />}
                </TraceIcon>
                <TraceTitle className="overflow-visible text-wrap whitespace-normal">{step.label}</TraceTitle>
                <span className="sr-only">{step.status === "failed" ? "실패" : running ? "진행 중" : step.status === "completed" ? "완료" : "중단"}</span>
              </TraceLine>
            );
          })}
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  );
}

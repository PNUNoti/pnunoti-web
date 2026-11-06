"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowUp, ArrowUpRight, CircleAlert, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Message, MessageContent } from "@/components/ui/message";
import {
  MessageScroller, MessageScrollerButton, MessageScrollerContent,
  MessageScrollerItem, MessageScrollerProvider, MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { chatProgressSteps, type ChatReply, type ChatStatus } from "@/lib/chat-types";
import { AnswerWithSources } from "./answer-with-sources";
import { ChatHeader } from "./chat-header";
import { ChatProgressTrace } from "./chat-progress";

import { useNoticeChat, type ChatFailure } from "./use-notice-chat";

// NotebookLM에 넣은 공지 데이터의 게시판 수. 첫 화면 안내 문구에 표시된다.
const BOARD_COUNT = 131;

// 카테고리를 고르면 아래 질문이 바뀐다. 화면에 보이는 문장이 그대로 전송된다.
const categories = [
  { label: "장학", questions: [
    "지금 신청 가능한 생활비 장학금의 지원 금액과 마감일 알려줘",
    "현재 모집 중인 장학금 중 소득구간 제한이 없는 게 있어?",
    "현재 모집 중인 교내 근로장학생의 근무 시간과 장소를 비교해줘",
  ] },
  { label: "학사", questions: [
    "앞으로 2주 안에 마감되는 수강 관련 신청 일정 알려줘",
    "휴학생이 다음 학기에 복학하려면 언제, 어떻게 신청해야 해?",
    "이번 학기 수강취소 신청 기한과 신청 방법 알려줘",
  ] },
  { label: "교류·해외", questions: [
    "현재 모집 중인 교환학생 프로그램의 어학 기준과 마감일 알려줘",
    "지금 어학 성적 없이 지원할 수 있는 해외 프로그램이 있어?",
    "현재 모집 중인 해외 파견 중 참가비를 지원해 주는 프로그램 추천해줘",
  ] },
  { label: "취업·대외활동", questions: [
    "지금 신청 가능한 채용설명회의 기업명·일시·장소 알려줘",
    "현재 모집 중인 현장실습의 지원 학년과 신청 마감일 알려줘",
    "이번 달 마감인 공모전 중 전공 제한 없이 참여할 수 있는 건 뭐야?",
  ] },
  { label: "행사·봉사", questions: [
    "이번 주에 참여할 수 있는 교내 행사의 일시와 장소 알려줘",
    "지금 신청 가능한 봉사활동 중 봉사시간을 인정해 주는 것 알려줘",
    "이번 달에 무료로 참여할 수 있는 교내 문화행사 추천해줘",
  ] },
];

// 실제 진행 정보가 없는 공급자에서만 사용하는 기존 대기 안내 문구.
// 최근 처리 시간은 중간값 약 1분이고, 길면 2분을 넘거나 150초 무렵 시간 초과된다.
// 그래서 단계는 1분에 걸쳐 나누고, 그 뒤로는 늦어지는 상황을 솔직하게 말한다.
const pendingSteps = [
  { after: 0, text: "질문을 읽고 있어요" },
  { after: 5, text: `${BOARD_COUNT}개 게시판에서 관련 공지를 찾고 있어요` },
  { after: 12, text: "관련 있는 공지를 고르고 있어요" },
  { after: 20, text: "공지 본문과 첨부 이미지를 살펴보고 있어요" },
  { after: 30, text: "일정과 신청 조건을 확인하고 있어요" },
  { after: 40, text: "근거가 될 문장을 고르고 있어요" },
  { after: 50, text: "답변을 정리하고 있어요" },
  { after: 65, text: "확인할 공지가 많아 조금 더 걸리고 있어요" },
  { after: 90, text: "답변이 늦어지고 있어요. 길면 2분 넘게 걸릴 수 있어요" },
  { after: 130, text: "답변이 많이 늦어지고 있어요. 곧 결과를 알려드릴게요" },
];
const pendingHintInterval = 6;

const focusRing = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tds-blue";
const enter = (delay: number): CSSProperties => ({ animationDelay: `${delay}ms` });

function Pending({ status, stopping, error, notificationEnabled }: { status: ChatStatus | null; stopping: boolean; error: string | null; notificationEnabled: boolean }) {
  const [seconds, setSeconds] = useState(() => Math.floor(status?.elapsed_seconds ?? 0));
  useEffect(() => {
    const startedAt = Date.now();
    const initialSeconds = Math.floor(status?.elapsed_seconds ?? 0);
    const timer = setInterval(() => setSeconds(initialSeconds + Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);
  let step = pendingSteps[0];
  for (const candidate of pendingSteps) if (seconds >= candidate.after) step = candidate;
  const progress = status?.status_available ? chatProgressSteps(status.events) : [];
  const latest = progress.at(-1);
  const label = stopping ? "답변 요청을 중지하고 있어요" : !status ? "질문을 서버에 전송하고 있어요" : status.phase === "queued" ? `질문을 받았어요. 대기 순서 ${status.queue_position ?? 1}번이에요` : status.phase === "receiving" || status.phase === "completed" ? "답변을 마무리하고 있어요" : latest ? latest.status === "running" ? latest.label : "확인한 내용을 바탕으로 답변을 준비하고 있어요" : step.text;
  const hints = !status ? ["접수 확인 전이에요. 잠시만 기다려주세요."] : [
    "보통 1~2분 정도 걸려요",
    notificationEnabled ? "답변이 준비되면 알림으로 알려드려요. 잠시 나갔다 오셔도 돼요." : "PNU Noti 앱에 로그인하고 질문하면, 답변 완료 알림을 받을 수 있어요.",
  ];
  const hintIndex = Math.floor(seconds / pendingHintInterval) % hints.length;
  return (
    <div className="chat-enter text-[15px] leading-[1.6] font-medium">
      <span key={label} role="status" className="chat-step">
        <span className="chat-shimmer">{label}</span>
        <span className="chat-dots text-tds-grey-500" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span>
      </span>
      {progress.length > 0 && <ChatProgressTrace events={status!.events} />}
      {!stopping && (
        <div data-slot="chat-pending-hints" className="chat-enter mt-1 grid text-[13px] font-normal text-tds-grey-500">
          {/* 두 문구가 같은 칸을 차지해, 교대할 때 영역의 높이를 유지한다. */}
          {hints.map((hint, index) => (
            <p key={index} aria-hidden={index !== hintIndex} className={`col-start-1 row-start-1 transition-opacity duration-300 ${index === hintIndex ? "opacity-100" : "opacity-0"}`}>{hint}</p>
          ))}
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-[13px] font-normal text-tds-grey-600">{error}</p>}
    </div>
  );
}

function FollowUpQuestions({ reply, busy, onPick }: { reply: ChatReply; busy: boolean; onPick: (question: string) => void }) {
  if (!reply.next_steps?.length) return null;
  return (
    <section aria-label="추천 질문" className="mt-5 flex flex-col items-start gap-2">
      <p className="text-[12px] font-medium text-tds-grey-500">이어서 물어보세요</p>
      {reply.next_steps.map(({ question }) => (
        <Button key={question} variant="outline" disabled={busy} onClick={() => onPick(question)} className="h-auto max-w-full justify-start gap-2 rounded-xl border-tds-grey-200 px-3 py-2.5 text-left text-[14px] leading-[1.5] font-normal whitespace-normal text-tds-grey-700 hover:bg-tds-grey-50">
          <span className="min-w-0">{question}</span><ArrowUpRight className="size-3.5 shrink-0 text-tds-grey-400" />
        </Button>
      ))}
    </section>
  );
}

function Failure({ error, busy, onRetry, onEdit }: { error: ChatFailure; busy: boolean; onRetry: () => void; onEdit: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const wait = error.retryAt ? Math.max(0, Math.ceil((error.retryAt - now) / 1000)) : 0;
  useEffect(() => {
    const retryAt = error.retryAt;
    if (!retryAt) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= retryAt) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [error.retryAt]);
  return (
    <div role="alert" className="chat-enter rounded-2xl bg-tds-grey-50 p-4">
      <p className="flex gap-2 text-[15px] leading-[1.6] text-tds-grey-800"><CircleAlert className="mt-[3px] size-[18px] shrink-0 text-destructive" />{error.message}</p>
      <div className="mt-3 flex gap-2 pl-[26px]">
        <button type="button" disabled={busy || wait > 0} onClick={onRetry} className={`h-9 rounded-[10px] bg-tds-blue-50 px-3.5 text-[14px] font-semibold text-tds-blue tabular-nums transition hover:bg-[color-mix(in_srgb,var(--tds-blue-50),var(--tds-blue)_8%)] active:scale-95 disabled:pointer-events-none disabled:opacity-50 ${focusRing}`}>
          {wait > 0 ? `${wait >= 60 ? `${Math.ceil(wait / 60)}분` : `${wait}초`} 후 다시 시도` : "다시 시도"}
        </button>
        <button type="button" onClick={onEdit} className={`h-9 rounded-[10px] bg-tds-grey-100 px-3.5 text-[14px] font-semibold text-tds-grey-700 transition hover:bg-tds-grey-200 active:scale-95 ${focusRing}`}>질문 수정</button>
      </div>
    </div>
  );
}

// 대화 전 첫 화면: 가운데는 제목, 아래(입력창 바로 위)는 카테고리별 질문.
// 메시지 스크롤러의 앵커 여백이 남지 않도록 스크롤러 밖에서 렌더링한다.
function Welcome({ onPick, onResume, hasPrevious = false, ready = true, connectionError }: { onPick: (question: string) => void; onResume?: () => void; hasPrevious?: boolean; ready?: boolean; connectionError?: ReactNode }) {
  const [active, setActive] = useState(0);
  const [switched, setSwitched] = useState(false);
  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col gap-8 px-5 pt-6 pb-4">
      <section aria-labelledby="chat-intro" className="relative isolate flex min-h-[320px] flex-1 translate-y-6 flex-col items-center justify-center text-center">
        <div aria-hidden="true" className="chat-aurora"><i /><i /><i /></div>
        {/* 위아래 여백을 같게 두고, 아래 여백 안에 버튼 자리를 미리 확보한다. */}
        <div className="relative w-full py-12">
          <h1 id="chat-intro" className="chat-enter text-[28px] leading-[1.35] tracking-[-0.02em] text-balance text-tds-grey-900" style={enter(60)}>부산대 공지, AI에게 물어보세요</h1>
          <div className="chat-enter mt-3 flex flex-col gap-1 text-[13px] leading-[1.6] text-balance text-tds-grey-500" style={enter(100)}>
            <p>부산대학교 {BOARD_COUNT}개 게시판 데이터로 답변해요.</p>
            <p>AI는 실수할 수 있어요. 원문 공지를 꼭 확인하세요.</p>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex h-12 items-start justify-center pt-3">
            {hasPrevious && <button type="button" onClick={onResume} disabled={!ready} className={`chat-resume-enter rounded-md px-2 py-1 text-[13px] font-medium text-tds-grey-600 underline decoration-tds-grey-300 underline-offset-4 transition hover:text-tds-blue hover:decoration-tds-blue active:scale-95 disabled:opacity-50 ${focusRing}`}>이전 대화 이어하기</button>}
          </div>
        </div>
      </section>
      <section aria-label="질문 예시" className="relative">
        {connectionError && <div className="absolute inset-x-0 bottom-full">{connectionError}</div>}
        <div className="chat-enter chat-tabs -mx-5 -my-1 flex gap-2 overflow-x-auto px-5 py-1" style={enter(120)}>
          {categories.map(({ label }, index) => (
            <button key={label} type="button" aria-pressed={index === active} onClick={() => { setActive(index); setSwitched(true); }} className={`h-9 shrink-0 rounded-full px-3.5 text-[14px] font-semibold tracking-[-0.01em] transition active:scale-95 ${index === active ? "bg-tds-grey-900 text-background" : "bg-tds-grey-100 text-tds-grey-700 hover:bg-tds-grey-200"} ${focusRing}`}>{label}</button>
          ))}
        </div>
        <ul key={active} className="chat-enter mt-3 overflow-hidden rounded-2xl border border-tds-grey-200" style={enter(switched ? 0 : 180)}>
          {categories[active].questions.map((question) => (
            <li key={question} className="border-t border-tds-grey-100 first:border-t-0">
              <button type="button" onClick={() => onPick(question)} className={`flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] leading-[1.5] tracking-[-0.01em] text-tds-grey-800 transition hover:bg-tds-grey-50 active:bg-tds-grey-100 ${focusRing} focus-visible:outline-offset-[-2px]`}>
                <span className="min-w-0 flex-1">{question}</span>
                <ArrowUpRight className="size-4 shrink-0 text-tds-grey-400" strokeWidth={2.2} />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div role="status" aria-label="이전 대화를 불러오는 중" aria-busy="true" className="chat-enter mx-auto flex max-w-2xl flex-col gap-10 px-5 pt-6 pb-8">
      <span className="sr-only">이전 대화를 불러오고 있어요.</span>
      {[0, 1, 2].map((index) => (
        <div key={index} aria-hidden="true" className="flex flex-col gap-6" style={{ opacity: 1 - index * 0.2 }}>
          <div className="chat-history-skeleton ml-auto h-12 w-[62%] rounded-[20px]" />
          <div className="flex flex-col gap-3 py-1">
            <div className="chat-history-skeleton h-4 w-2/5 rounded-md" />
            <div className="chat-history-skeleton h-4 w-full rounded-md" />
            <div className="chat-history-skeleton h-4 w-[92%] rounded-md" />
            <div className="chat-history-skeleton h-4 w-3/4 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

// 백그라운드에서 수신했거나 스크롤 밖에 있는 결과는 아직 확인한 것으로 처리하지 않는다.
function ChatResult({ turnId, onVisible, children }: { turnId: string; onVisible: (turnId: string) => void; children: ReactNode }) {
  const result = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = result.current;
    if (!element) return;
    const viewport = element.closest('[data-slot="message-scroller-viewport"]');
    let inView = false;
    let reported = false;
    let frame = 0;
    const report = () => {
      cancelAnimationFrame(frame);
      if (reported || !inView || document.visibilityState !== "visible") return;
      frame = requestAnimationFrame(() => {
        if (!inView || document.visibilityState !== "visible") return;
        if (getComputedStyle(element).visibility === "hidden" || (viewport && getComputedStyle(viewport).visibility === "hidden")) {
          report();
          return;
        }
        reported = true;
        onVisible(turnId);
      });
    };
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; report(); }, { root: viewport });
    observer.observe(element);
    document.addEventListener("visibilitychange", report);
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", report);
    };
  }, [turnId, onVisible]);
  return <div ref={result}>{children}</div>;
}

export function NoticeChat() {
  const { turns, text, setText, pendingId, status, stopping, controlError, notificationEnabled, notificationWarning, initialized, loadingError, hasPrevious, resuming,
    input, form, composing, busy, ask, send, edit, stopAnswer, restart, retryLoad, resumePrevious, acknowledgeResult } = useNoticeChat();
  const connectionError = loadingError ? (
    <div role="alert" className="mx-auto mb-3 flex max-w-2xl items-center gap-2 text-[13px] text-tds-grey-600">
      <p>{loadingError}</p>
      <button type="button" onClick={() => void retryLoad()} disabled={!initialized && resuming} className={`shrink-0 rounded-md px-2 py-1 font-semibold text-tds-blue ${focusRing}`}>다시 연결</button>
    </div>
  ) : null;

  return (
    <main className="chat-shell relative isolate flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-tds-grey-900">
      <ChatHeader onRestart={restart} />

      {resuming ? (
        <div className="chat-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain"><HistorySkeleton /></div>
      ) : turns.length === 0 ? (
        <div className="chat-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
          <Welcome onPick={(question) => send(question)} onResume={() => void resumePrevious()} hasPrevious={hasPrevious} ready={initialized} connectionError={connectionError} />
        </div>
      ) : (
        <MessageScrollerProvider>
          <MessageScroller className="flex-1">
            <MessageScrollerViewport aria-label="공지 AI 대화" className="chat-scroll">
              <MessageScrollerContent className="mx-auto max-w-2xl gap-10 px-5 pt-6 pb-8">
                {turns.map((turn) => (
                  <MessageScrollerItem key={turn.id} messageId={turn.id} scrollAnchor>
                    <Message align="end">
                      <Bubble align="end" className="chat-enter max-w-[85%]">
                        <BubbleContent className="rounded-[20px] px-4 py-2.5 text-[16px] leading-[1.6] tracking-[-0.01em] whitespace-pre-wrap">{turn.question}</BubbleContent>
                      </Bubble>
                    </Message>
                    <Message className="mt-6">
                      <MessageContent className="gap-0">
                        {turn.reply || turn.error || turn.cancelled ? (
                          <ChatResult turnId={turn.id} onVisible={acknowledgeResult}>
                            {turn.events && <ChatProgressTrace events={turn.events} settled />}
                            {turn.reply ? (
                              <div className="chat-enter">
                                <AnswerWithSources reply={turn.reply} />
                                {turn.id === turns.at(-1)?.id && <FollowUpQuestions reply={turn.reply} busy={busy} onPick={send} />}
                              </div>
                            ) : turn.error ? (
                              <Failure error={turn.error} busy={busy} onRetry={() => void ask(turn.id, turn.question)} onEdit={() => edit(turn)} />
                            ) : <p role="status" className="text-[14px] text-tds-grey-500">답변 받기를 중지했어요.</p>}
                          </ChatResult>
                        )
                        : pendingId === turn.id ? <Pending status={status} stopping={stopping} error={controlError} notificationEnabled={notificationEnabled} /> : null}
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                ))}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton aria-label="최신 메시지로 이동" size="icon" className="rounded-full border-tds-grey-200 bg-background text-tds-grey-700 shadow-[0_2px_10px_rgba(0,0,0,0.08)] hover:bg-tds-grey-50" />
          </MessageScroller>
        </MessageScrollerProvider>
      )}

      <div className="shrink-0 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {notificationWarning && <p role="status" className="mx-auto mb-2 max-w-2xl text-[13px] text-tds-grey-500">{notificationWarning}</p>}
        {turns.length > 0 && connectionError}
        <form ref={form} className="mx-auto max-w-2xl" onSubmit={(event) => { event.preventDefault(); send(); }}>
          <InputGroup className="chat-composer items-end rounded-[26px] bg-tds-grey-100 has-[[data-slot=input-group-control]:focus-visible]:border-transparent has-[[data-slot=input-group-control]:focus-visible]:ring-0">
            <label htmlFor="chat-question" className="sr-only">공지에 대해 질문하기</label>
            <InputGroupTextarea ref={input} id="chat-question" value={text} disabled={!initialized} maxLength={4000} rows={1} placeholder="어떤 공지가 궁금하세요?" className="max-h-40 min-h-[52px] py-3.5 pr-1 pl-5 text-[16px] leading-6 text-tds-grey-900 placeholder:text-tds-grey-500 md:text-[16px]" onChange={(event) => setText(event.target.value)} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !composing.current && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); form.current?.requestSubmit(); }
            }} />
            <InputGroupAddon align="inline-end" className="cursor-default py-2 pr-2">
              {text.length > 3500 && <span className="text-[12px] font-normal tabular-nums text-tds-grey-500">{text.length}/4000</span>}
              {busy ? (
                <InputGroupButton type="button" variant="default" size="icon-sm" onClick={() => void stopAnswer()} disabled={stopping} aria-label={stopping ? "답변 요청 중지 중" : "답변 받기 중지"} className="size-9 rounded-full bg-tds-grey-900 text-background hover:bg-tds-grey-700 active:scale-95 disabled:opacity-50"><Square className="size-3.5 fill-current" /></InputGroupButton>
              ) : (
                <InputGroupButton type="submit" variant="default" size="icon-sm" className="size-9 rounded-full bg-tds-blue text-white hover:bg-tds-blue-hover active:scale-95 disabled:bg-tds-grey-300 disabled:opacity-100 [&_svg:not([class*='size-'])]:size-5" disabled={!initialized || !text.trim()} aria-label="질문 보내기"><ArrowUp strokeWidth={2.5} /></InputGroupButton>
              )}
            </InputGroupAddon>
          </InputGroup>
        </form>
      </div>
    </main>
  );
}

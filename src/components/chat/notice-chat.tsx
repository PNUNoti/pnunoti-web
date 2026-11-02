"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, ArrowUpRight, Check, ChevronDown, CircleAlert, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Message, MessageContent } from "@/components/ui/message";
import {
  MessageScroller, MessageScrollerButton, MessageScrollerContent,
  MessageScrollerItem, MessageScrollerProvider, MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { PNU_NOTI_LOGO } from "@/constants/images";
import { isChatReply, type ChatReference, type ChatReply } from "@/lib/chat-types";
import { SparkleIcon } from "./sparkle-icon";

type ChatFailure = { message: string; retryAt?: number };
type Turn = { id: string; question: string; reply?: ChatReply; error?: ChatFailure };

class ChatError extends Error {
  retryAt?: number;
  constructor(message: string, retryAt?: number) { super(message); this.retryAt = retryAt; }
}

// NotebookLM에 넣은 공지 데이터의 게시판 수. 첫 화면 안내 문구에 표시된다.
const BOARD_COUNT = 131;

// 카테고리를 고르면 아래 질문이 바뀐다. 화면에 보이는 문장이 그대로 전송된다.
const categories = [
  { label: "장학", questions: ["장학금 신청 조건이랑 마감일 알려줘", "지금 신청할 수 있는 교내 장학금 있어?", "국가장학금 관련 공지 정리해줘"] },
  { label: "학사", questions: ["곧 마감되는 학사 일정 알려줘", "휴학·복학 신청 기간 알려줘", "졸업 요건 관련 공지 있어?"] },
  { label: "교류·해외", questions: ["해외 파견·교류 프로그램 모집 있어?", "교환학생 지원 자격이랑 일정 알려줘", "어학연수 지원 프로그램 있어?"] },
  { label: "취업·대외활동", questions: ["참여할 만한 공모전·대외활동 정리해줘", "인턴십이나 채용 공지 있어?", "취업 특강이나 설명회 일정 알려줘"] },
  { label: "행사·봉사", questions: ["지금 지원할 수 있는 봉사활동 알려줘", "이번 주 교내 행사 뭐 있어?", "봉사시간 인정되는 활동 있어?"] },
];

// 서버는 진행 단계를 보내지 않으므로, 이 서비스가 실제로 하는 일을 경과 시간에 맞춰 차례로 보여준다.
// 특정 결과나 숫자(예: "3건 찾았어요")는 지어내지 않는다. 답변은 보통 30~45초 걸린다.
const pendingSteps = [
  { after: 0, text: "질문을 읽고 있어요" },
  { after: 3, text: "질문의 핵심을 파악하고 있어요" },
  { after: 6, text: `${BOARD_COUNT}개 게시판에서 관련 공지를 찾고 있어요` },
  { after: 10, text: "질문과 관련 있는 공지를 고르고 있어요" },
  { after: 14, text: "공지 본문을 살펴보고 있어요" },
  { after: 18, text: "첨부 이미지 속 내용도 확인하고 있어요" },
  { after: 22, text: "일정과 신청 조건을 확인하고 있어요" },
  { after: 26, text: "필요한 내용을 모으고 있어요" },
  { after: 30, text: "근거가 될 문장을 고르고 있어요" },
  { after: 34, text: "공지 내용을 바탕으로 답변을 정리하고 있어요" },
  { after: 39, text: "이해하기 쉽게 다듬고 있어요" },
  { after: 46, text: "거의 다 됐어요. 조금만 기다려 주세요" },
  { after: 60, text: "답변 준비가 평소보다 길어지고 있어요. 조금만 더 기다려 주세요" },
];

const focusRing = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tds-blue";
const enter = (delay: number): CSSProperties => ({ animationDelay: `${delay}ms` });

function fallbackError(status: number) {
  if (status === 429) return "질문이 몰리고 있어요. 잠시 후 다시 시도해주세요.";
  if (status === 504) return "답변 시간이 초과됐어요. 질문을 조금 더 구체적으로 바꿔 보세요.";
  return "답변을 가져오지 못했어요. 잠시 후 다시 시도해주세요.";
}

// 본문의 [1], [1, 2] 같은 인용 표기를 작은 배지로 바꾼다. 코드 블록의 텍스트는 건드리지 않는다.
type MarkdownNode = { type: string; value?: string; children?: MarkdownNode[]; data?: Record<string, unknown> };
const CITATION = /\[(\d+(?:\s*[,\-–~]\s*\d+)*)\]/g;
function remarkCitations() {
  const walk = (node: MarkdownNode) => {
    if (!node.children) return;
    node.children = node.children.flatMap((child) => {
      if (child.type !== "text" || !child.value) { walk(child); return [child]; }
      const parts: MarkdownNode[] = [];
      let last = 0;
      for (const match of child.value.matchAll(CITATION)) {
        // 배지만 다음 줄로 떨어지지 않도록 바로 앞 단어와 한 덩어리로 묶는다.
        const before = child.value.slice(last, match.index);
        const word = before.match(/(\S+)(\s*)$/);
        const head = word ? before.slice(0, word.index) : before;
        if (head) parts.push({ type: "text", value: head });
        const badge = { type: "element", tagName: "sup", properties: { className: ["chat-citation"] }, children: [{ type: "text", value: match[1] }] };
        parts.push({ type: "citation", children: [], data: { hName: "span", hProperties: { className: ["chat-cite-wrap"] }, hChildren: word ? [{ type: "text", value: word[1] + word[2] }, badge] : [badge] } });
        last = match.index + match[0].length;
      }
      if (!parts.length) return [child];
      if (last < child.value.length) parts.push({ type: "text", value: child.value.slice(last) });
      return parts;
    });
  };
  return (tree: unknown) => walk(tree as MarkdownNode);
}

function Answer({ answer }: { answer: string }) {
  return (
    <div className="chat-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkCitations]} urlTransform={(url) => /^(https?:\/\/|#)/i.test(url) ? url : ""} components={{
        a: ({ href, children }) => href ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
        img: () => null,
        table: ({ children }) => <div className="chat-table"><table>{children}</table></div>,
      }}>{answer}</ReactMarkdown>
    </div>
  );
}

function CopyAnswer({ answer }: { answer: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(answer);
      setCopied(true); setFailed(false);
    } catch { setFailed(true); }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { setCopied(false); setFailed(false); }, 2000);
  }
  return (
    <>
      <Button variant="ghost" size="icon" aria-label={copied ? "답변 복사 완료" : "답변 복사"} onClick={copy} className="rounded-full text-tds-grey-500 hover:bg-tds-grey-100 hover:text-tds-grey-700 active:scale-95 [&_svg:not([class*='size-'])]:size-[18px]">
        {copied ? <Check className="chat-pop text-tds-blue" /> : <Copy />}
      </Button>
      <span role="status" className={failed ? "chat-enter text-[13px] text-tds-grey-500" : "sr-only"}>{failed ? "복사하지 못했어요" : copied ? "복사했어요" : ""}</span>
    </>
  );
}

function AnswerActions({ reply }: { reply: ChatReply }) {
  const { references } = reply;
  return (
    <Collapsible className="mt-3">
      <div className="flex items-center gap-1">
        {references.length > 0 && (
          <CollapsibleTrigger className={`group/sources flex h-8 items-center gap-0.5 rounded-full bg-tds-grey-100 pr-2 pl-3 text-[13px] font-semibold text-tds-grey-700 transition hover:bg-tds-grey-200 active:scale-95 ${focusRing}`}>
            출처 {references.length}
            <ChevronDown className="size-4 text-tds-grey-500 transition-transform group-aria-expanded/sources:rotate-180" strokeWidth={2.2} />
          </CollapsibleTrigger>
        )}
        <CopyAnswer answer={reply.answer} />
      </div>
      {references.length > 0 && (
        <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0">
          <Sources references={references} />
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

function Sources({ references }: { references: ChatReference[] }) {
  return (
    <ul className="mt-2 flex flex-col gap-3 rounded-2xl bg-tds-grey-50 p-4">
      {references.map((reference, index) => (
        <li key={`${reference.source_id}-${index}`} className="flex items-start gap-2.5">
          <span className="mt-[3px] flex size-[18px] shrink-0 items-center justify-center rounded-full bg-tds-grey-200 text-[11px] font-bold text-tds-grey-600">{reference.citation_number ?? index + 1}</span>
          <p className="min-w-0 whitespace-pre-wrap break-words text-[14px] leading-[1.6] text-tds-grey-700">{reference.cited_text?.trim() || "답변에서 참조한 공지 자료예요."}</p>
        </li>
      ))}
    </ul>
  );
}

function Pending() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);
  let step = pendingSteps[0];
  for (const candidate of pendingSteps) if (seconds >= candidate.after) step = candidate;
  // 경과 초는 보여주지 않는다. 숫자가 늘면 진행 내용보다 기다린 시간에 눈이 간다.
  return (
    <div role="status" className="chat-enter text-[15px] leading-[1.6] font-medium">
      <span key={step.text} className="chat-step">
        <span className="chat-shimmer">{step.text}</span>
        <span className="chat-dots text-tds-grey-500" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span>
      </span>
    </div>
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
        <button type="button" disabled={busy || wait > 0} onClick={onRetry} className={`h-9 rounded-[10px] bg-tds-blue-50 px-3.5 text-[14px] font-semibold text-tds-blue tabular-nums transition hover:bg-[#d6e8ff] active:scale-95 disabled:pointer-events-none disabled:opacity-50 ${focusRing}`}>
          {wait > 0 ? `${wait >= 60 ? `${Math.ceil(wait / 60)}분` : `${wait}초`} 후 다시 시도` : "다시 시도"}
        </button>
        <button type="button" onClick={onEdit} className={`h-9 rounded-[10px] bg-tds-grey-100 px-3.5 text-[14px] font-semibold text-tds-grey-700 transition hover:bg-tds-grey-200 active:scale-95 ${focusRing}`}>질문 수정</button>
      </div>
    </div>
  );
}

// 대화 전 첫 화면: 가운데는 사각별과 제목, 아래(입력창 바로 위)는 카테고리별 질문.
// 메시지 스크롤러의 앵커 여백이 남지 않도록 스크롤러 밖에서 렌더링한다.
function Welcome({ onPick }: { onPick: (question: string) => void }) {
  const [active, setActive] = useState(0);
  const [switched, setSwitched] = useState(false);
  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col gap-8 px-5 pt-6 pb-4">
      <section aria-labelledby="chat-intro" className="flex flex-1 flex-col items-center justify-center text-center">
        <SparkleIcon animated glow className="chat-enter size-[72px]" />
        <h1 id="chat-intro" className="chat-enter mt-5 text-[24px] leading-[1.4] font-bold tracking-[-0.02em] text-tds-grey-900" style={enter(60)}>부산대 공지, AI에게 물어보세요</h1>
        <div className="chat-enter mt-3 flex flex-col gap-1 text-[13px] leading-[1.6] text-balance text-tds-grey-500" style={enter(100)}>
          <p>부산대학교 {BOARD_COUNT}개 게시판 데이터로 답변해요.</p>
          <p>AI는 실수할 수 있어요. 원문 공지를 꼭 확인하세요.</p>
        </div>
      </section>
      <section aria-label="질문 예시">
        <div className="chat-enter chat-tabs -mx-5 -my-1 flex gap-2 overflow-x-auto px-5 py-1" style={enter(120)}>
          {categories.map(({ label }, index) => (
            <button key={label} type="button" aria-pressed={index === active} onClick={() => { setActive(index); setSwitched(true); }} className={`h-9 shrink-0 rounded-full px-3.5 text-[14px] font-semibold tracking-[-0.01em] transition active:scale-95 ${index === active ? "bg-tds-grey-900 text-white" : "bg-tds-grey-100 text-tds-grey-700 hover:bg-tds-grey-200"} ${focusRing}`}>{label}</button>
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

export function NoticeChat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const conversationId = useRef<string | undefined>(undefined);
  const activeRequest = useRef<AbortController | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const composing = useRef(false);
  const busy = pendingId !== null;

  useEffect(() => () => activeRequest.current?.abort(), []);

  async function ask(id: string, question: string) {
    if (activeRequest.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setPendingId(id);
    setTurns((current) => current.map((turn) => turn.id === id ? { ...turn, error: undefined } : turn));
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, conversation_id: conversationId.current }),
        signal: controller.signal,
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error : fallbackError(response.status);
        const retryAfter = Number(response.headers.get("retry-after"));
        throw new ChatError(message, response.status === 429 && retryAfter > 0 ? Date.now() + retryAfter * 1000 : undefined);
      }
      if (!isChatReply(data)) throw new Error("답변을 읽지 못했어요. 다시 시도해주세요.");
      conversationId.current = data.conversation_id;
      setTurns((current) => current.map((turn) => turn.id === id ? { ...turn, reply: data, error: undefined } : turn));
    } catch (cause) {
      if (!controller.signal.aborted) {
        // fetch 자체가 실패하면 TypeError("Failed to fetch")라서 원문 대신 안내 문구를 보여준다.
        const error: ChatFailure = cause instanceof Error && !(cause instanceof TypeError)
          ? { message: cause.message, retryAt: cause instanceof ChatError ? cause.retryAt : undefined }
          : { message: navigator.onLine ? "연결을 확인하고 다시 시도해주세요." : "인터넷 연결이 끊겼어요. 연결되면 다시 시도해주세요." };
        setTurns((current) => current.map((turn) => turn.id === id ? { ...turn, error } : turn));
      }
    } finally {
      if (!controller.signal.aborted) { activeRequest.current = null; setPendingId(null); }
    }
  }

  function send(question = text) {
    const value = question.trim();
    if (!value || value.length > 4000 || activeRequest.current) return;
    const id = crypto.randomUUID();
    setTurns((current) => [...current, { id, question: value }]);
    setText("");
    void ask(id, value);
    input.current?.focus();
  }

  // 실패한 질문을 대화에서 빼고 입력창으로 돌려보내 고쳐 쓸 수 있게 한다.
  function edit(turn: Turn) {
    setTurns((current) => current.filter(({ id }) => id !== turn.id));
    setText(turn.question);
    input.current?.focus();
  }

  // 헤더로 /chat에 다시 오면 같은 경로라 페이지가 새로 그려지지 않으므로 대화를 직접 비워 첫 화면으로 돌린다.
  function restart(event: MouseEvent) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    activeRequest.current?.abort();
    activeRequest.current = null;
    conversationId.current = undefined;
    setPendingId(null);
    setTurns([]);
  }

  return (
    <main className="chat-shell flex h-dvh min-h-0 flex-col overflow-hidden bg-white text-tds-grey-900">
      <header className="shrink-0">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-5">
          <Link href="/chat" onClick={restart} aria-label="공지 AI 처음 화면으로" className={`-mx-1.5 flex items-center gap-0.5 rounded-lg px-1.5 py-1 transition active:scale-95 ${focusRing}`}>
            <Image src={PNU_NOTI_LOGO} alt="" priority className="h-[22px] w-auto" />
            <SparkleIcon animated className="size-7" />
          </Link>
        </div>
      </header>

      {turns.length === 0 ? (
        <div className="chat-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <Welcome onPick={(question) => send(question)} />
        </div>
      ) : (
        <MessageScrollerProvider autoScroll>
          <MessageScroller className="isolate flex-1">
            <div aria-hidden="true" data-pending={busy || undefined} className="chat-watermark pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
              <SparkleIcon animated glow className="size-[min(64vw,280px)]" />
            </div>
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
                        {turn.reply ? (
                          <div className="chat-enter">
                            <Answer answer={turn.reply.answer} />
                            <AnswerActions reply={turn.reply} />
                          </div>
                        ) : turn.error ? (
                          <Failure error={turn.error} busy={busy} onRetry={() => void ask(turn.id, turn.question)} onEdit={() => edit(turn)} />
                        ) : pendingId === turn.id ? <Pending /> : null}
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                ))}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton aria-label="최신 메시지로 이동" size="icon" className="rounded-full border-tds-grey-200 bg-white text-tds-grey-700 shadow-[0_2px_10px_rgba(0,0,0,0.08)] hover:bg-tds-grey-50" />
          </MessageScroller>
        </MessageScrollerProvider>
      )}

      <div className="shrink-0 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <form ref={form} className="mx-auto max-w-2xl" onSubmit={(event) => { event.preventDefault(); send(); }}>
          <InputGroup className="chat-composer items-end rounded-[26px] bg-tds-grey-100 has-[[data-slot=input-group-control]:focus-visible]:border-transparent has-[[data-slot=input-group-control]:focus-visible]:ring-0">
            <label htmlFor="chat-question" className="sr-only">공지에 대해 질문하기</label>
            <InputGroupTextarea ref={input} id="chat-question" value={text} maxLength={4000} rows={1} placeholder="어떤 공지가 궁금하세요?" className="max-h-40 min-h-[52px] py-3.5 pr-1 pl-5 text-[16px] leading-6 text-tds-grey-900 placeholder:text-tds-grey-500 md:text-[16px]" onChange={(event) => setText(event.target.value)} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !composing.current && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); form.current?.requestSubmit(); }
            }} />
            <InputGroupAddon align="inline-end" className="cursor-default py-2 pr-2">
              {text.length > 3500 && <span className="text-[12px] font-normal tabular-nums text-tds-grey-500">{text.length}/4000</span>}
              <InputGroupButton type="submit" variant="default" size="icon-sm" className="size-9 rounded-full bg-tds-blue text-white hover:bg-tds-blue-hover active:scale-95 disabled:bg-tds-grey-300 disabled:opacity-100 [&_svg:not([class*='size-'])]:size-5" disabled={busy || !text.trim()} aria-label="질문 보내기"><ArrowUp strokeWidth={2.5} /></InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>
      </div>
    </main>
  );
}

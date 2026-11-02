"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Popover } from "@base-ui/react/popover";
import { ArrowLeft, Check, ChevronDown, ChevronRight, Copy, FileText, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { groupChatSources, remarkCitations, type ChatSource } from "@/lib/chat-citations";
import type { ChatReply } from "@/lib/chat-types";

const focusRing = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tds-blue";
const mobileQuery = "(max-width: 639px)";
const subscribeToViewport = (callback: () => void) => {
  const query = window.matchMedia(mobileQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
};
const isMobileViewport = () => window.matchMedia(mobileQuery).matches;
const serverViewport = () => false;

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

function SourceQuote({ quote }: { quote: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const text = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const element = text.current;
    if (!element || expanded) return;
    const measure = () => setOverflowing(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [quote, expanded]);

  return (
    <>
      <blockquote className="chat-source-quote"><p ref={text} className={expanded ? undefined : "chat-source-quote-collapsed"}>{quote}</p></blockquote>
      {overflowing && (
        <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className={`mt-3 flex items-center gap-1 rounded-md px-1 py-1.5 text-[13px] font-medium text-tds-grey-600 hover:text-tds-blue ${focusRing}`}>
          {expanded ? "접기" : "더 보기"}<ChevronDown size={14} className={expanded ? "rotate-180" : ""} />
        </button>
      )}
    </>
  );
}

function SourcePanel({ sources, initialKey, mobile }: { sources: ChatSource[]; initialKey: string | null; mobile: boolean }) {
  const [selectedKey, setSelectedKey] = useState(initialKey);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousKey = useRef(initialKey);
  const selected = sources.find((source) => source.key === selectedKey);
  const Title = mobile ? Dialog.Title : Popover.Title;
  const Close = mobile ? Dialog.Close : Popover.Close;
  const Description = mobile ? Dialog.Description : Popover.Description;
  const quote = selected?.excerpts.join("\n\n") ?? "";

  useEffect(() => {
    if (previousKey.current !== selectedKey) {
      heading.current?.focus({ preventScroll: true });
      previousKey.current = selectedKey;
    }
  }, [selectedKey]);

  function select(key: string | null) {
    setSelectedKey(key);
  }

  return (
    <>
      <div className="chat-source-header">
        {selected && sources.length > 1 && (
          <button type="button" aria-label="전체 출처 보기" onClick={() => select(null)} className={`chat-source-icon ${focusRing}`}><ArrowLeft size={18} /></button>
        )}
        <div className="min-w-0 flex-1">
          <Title ref={heading} tabIndex={-1} className="text-[16px] leading-6 font-semibold text-tds-grey-900 outline-none">
            {selected ? selected.citationNumber === null ? "참고 자료" : `출처 ${selected.citationNumber}` : `출처 ${sources.length}개`}
          </Title>
          <Description className="mt-0.5 text-[13px] leading-5 text-tds-grey-500">
            {selected ? "답변의 근거가 된 공지 내용이에요." : "궁금한 출처를 선택해 근거를 확인하세요."}
          </Description>
        </div>
        <Close aria-label="출처 닫기" className={`chat-source-icon ${focusRing}`}><X size={18} /></Close>
      </div>
      <div key={selectedKey ?? "all"} className="chat-source-body">
        {selected ? (
          quote ? <SourceQuote key={selected.key} quote={quote} />
            : <p className="py-4 text-[14px] leading-6 text-tds-grey-600">이 출처에는 인용문이 제공되지 않았어요.</p>
        ) : (
          <ul className="chat-source-list">
            {sources.map((source) => (
              <li key={source.key}>
                <button type="button" onClick={() => select(source.key)} className={`chat-source-row ${focusRing}`}>
                  <span aria-hidden="true" className="chat-source-number">{source.citationNumber ?? <FileText size={14} />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="mb-1 block text-[13px] font-semibold text-tds-grey-800">{source.citationNumber === null ? "참고 자료" : `출처 ${source.citationNumber}`}</span>
                    <span className="line-clamp-2 text-[13px] leading-[1.6] text-tds-grey-600">{source.excerpts[0]?.replace(/\s+/g, " ") || "인용문이 제공되지 않은 자료예요."}</span>
                  </span>
                  <ChevronRight size={16} className="mt-1 shrink-0 text-tds-grey-400" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export function AnswerWithSources({ reply }: { reply: ChatReply }) {
  const mobile = useSyncExternalStore(subscribeToViewport, isMobileViewport, serverViewport);
  const sources = useMemo(() => groupChatSources(reply.references), [reply.references]);
  const numbers = useMemo(() => sources.flatMap((source) => source.citationNumber === null ? [] : [source.citationNumber]), [sources]);
  const Root = mobile ? Dialog.Root<string | null> : Popover.Root<string | null>;
  const Trigger = mobile ? Dialog.Trigger<string | null> : Popover.Trigger<string | null>;
  // Keep trigger components mounted when the popup's active payload changes.
  // Recreating the markdown renderers would unregister and register every trigger.
  const markdown = useMemo(() => (
    <div className="chat-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm, [remarkCitations, { numbers }]]} urlTransform={(url) => /^(https?:\/\/|#)/i.test(url) ? url : ""} components={{
        a: ({ href, children }) => href ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
        img: () => null,
        table: ({ children }) => <div className="chat-table"><table>{children}</table></div>,
        sup: ({ node, children }) => {
          const number = Number(node?.properties["data-citation"]);
          if (!numbers.includes(number)) return <sup>{children}</sup>;
          return <Trigger payload={`citation:${number}`} aria-label={`출처 ${number} 보기`} className={`chat-citation ${focusRing}`}>{children}</Trigger>;
        },
      }}>{reply.answer}</ReactMarkdown>
    </div>
  ), [reply.answer, numbers, Trigger]);

  return (
    <Root>
      {({ payload }) => (
        <>
          {markdown}
          <div className="mt-3 flex items-center gap-1">
            {sources.length > 0 && (
              <Trigger payload={null} aria-label={`전체 출처 ${sources.length}개 보기`} className={`chat-sources-trigger ${focusRing}`}>
                <FileText size={14} /><span>출처 {sources.length}개</span><ChevronDown size={14} />
              </Trigger>
            )}
            <CopyAnswer answer={reply.answer} />
          </div>
          {mobile ? (
            <Dialog.Portal>
              <Dialog.Backdrop className="chat-source-backdrop" />
              <Dialog.Popup className="chat-source-surface chat-source-sheet">
                <div aria-hidden="true" className="chat-source-handle" />
                <SourcePanel key={payload ?? "all"} sources={sources} initialKey={payload ?? null} mobile />
              </Dialog.Popup>
            </Dialog.Portal>
          ) : (
            <Popover.Portal>
              <Popover.Positioner side="bottom" align="start" sideOffset={8} collisionPadding={16} className="chat-source-positioner">
                <Popover.Popup className="chat-source-surface chat-source-popover">
                  <SourcePanel key={payload ?? "all"} sources={sources} initialKey={payload ?? null} mobile={false} />
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          )}
        </>
      )}
    </Root>
  );
}

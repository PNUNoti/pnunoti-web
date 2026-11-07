"use client";

import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Drawer } from "@base-ui/react/drawer";
import { Popover } from "@base-ui/react/popover";
import { ArrowLeft, Check, ChevronDown, ChevronRight, Copy, ExternalLink, FileText, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { groupChatSources, remarkCitations, type ChatSource, type SourceNotice } from "@/lib/chat-citations";
import { safeSourceUrl, type ChatReply } from "@/lib/chat-types";
import { tryOpenSourceNotice } from "@/lib/open-source-notice";

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

function SourceOriginalLink({ notice, className, children, onOpenOriginal }: { notice: SourceNotice; className: string; children: React.ReactNode; onOpenOriginal?: () => void }) {
  const pending = useRef(false);
  const url = safeSourceUrl(notice.url);
  if (!url) return null;
  function open(event: React.MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (pending.current) { event.preventDefault(); return; }
    onOpenOriginal?.();
    const result = tryOpenSourceNotice(notice);
    if (!result) return;
    event.preventDefault();
    pending.current = true;
    void result.then((opened) => {
      // Delayed window.open can be blocked. Navigate directly on bridge failure.
      if (!opened) window.location.assign(url!);
    }).finally(() => { pending.current = false; });
  }
  return <a href={url} target="_blank" rel="noopener noreferrer" onClick={open} aria-label={`${notice.title || "공지"} 원문 보기`} className={className}>{children}</a>;
}

// inlineLink가 false면 원문 보기 버튼을 카드 대신 시트 아래쪽(SourcePanel)에 둔다.
export function SourceNoticeCard({ notice, inlineLink = true, onOpenOriginal }: { notice: SourceNotice; inlineLink?: boolean; onOpenOriginal?: () => void }) {
  const url = safeSourceUrl(notice.url);
  return (
    <article className="chat-source-notice">
      <h3 className="text-[15px] leading-6 font-semibold break-keep text-tds-grey-900">{notice.title || "공지 출처"}</h3>
      {url ? inlineLink && (
        <SourceOriginalLink notice={notice} onOpenOriginal={onOpenOriginal} className={`chat-source-original ${focusRing}`}>
          원문 보기<ExternalLink size={14} aria-hidden="true" />
        </SourceOriginalLink>
      ) : <p className="mt-2 text-[12px] text-tds-grey-500">원문 링크를 확인하지 못했어요.</p>}
      {notice.excerpt ? <blockquote className="chat-source-quote mt-3"><p>{notice.excerpt}</p></blockquote>
        : <p className="mt-3 text-[13px] leading-6 text-tds-grey-500">인용문이 제공되지 않았어요.</p>}
    </article>
  );
}

function SourcePanel({ sources, initialKey, mobile, onOpenOriginal }: { sources: ChatSource[]; initialKey: string | null; mobile: boolean; onOpenOriginal: () => void }) {
  const [selectedKey, setSelectedKey] = useState(initialKey);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousKey = useRef(initialKey);
  const selected = sources.find((source) => source.key === selectedKey);
  const Title = mobile ? Drawer.Title : Popover.Title;
  const Close = mobile ? Drawer.Close : Popover.Close;
  const Description = mobile ? Drawer.Description : Popover.Description;
  // 모바일 하단 시트에서는 원문 보기를 엄지가 닿는 아래쪽에 큰 버튼으로 고정한다.
  const links = mobile && selected ? selected.notices.flatMap((notice) => {
    const url = safeSourceUrl(notice.url);
    return url ? [{ notice, url }] : [];
  }) : [];

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
          selected.notices.map((notice) => <SourceNoticeCard key={notice.key} notice={notice} inlineLink={!mobile} onOpenOriginal={onOpenOriginal} />)
        ) : (
          <ul className="chat-source-list">
            {sources.map((source) => (
              <li key={source.key}>
                <button type="button" onClick={() => select(source.key)} className={`chat-source-row ${focusRing}`}>
                  <span aria-hidden="true" className="chat-source-number">{source.citationNumber ?? <FileText size={14} />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="mb-1 line-clamp-2 text-[13px] font-semibold text-tds-grey-800">{source.notices[0]?.title || (source.citationNumber === null ? "참고 자료" : `출처 ${source.citationNumber}`)}</span>
                    <span className="line-clamp-2 text-[13px] leading-[1.6] text-tds-grey-600">{source.notices[0]?.excerpt || "인용문이 제공되지 않은 자료예요."}</span>
                  </span>
                  <ChevronRight size={16} className="mt-1 shrink-0 text-tds-grey-400" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {links.length > 0 && (
        <div className="chat-source-actions">
          {links.map(({ notice }, index) => (
            <SourceOriginalLink key={notice.key} notice={notice} onOpenOriginal={onOpenOriginal} className={`chat-source-cta ${index > 0 ? "chat-source-cta-secondary" : ""} ${focusRing}`}>
              <span className="min-w-0 truncate">{links.length > 1 ? notice.title || "원문 보기" : "원문 보기"}</span><ExternalLink size={18} aria-hidden="true" className="shrink-0" />
            </SourceOriginalLink>
          ))}
        </div>
      )}
    </>
  );
}

export function AnswerWithSources({ reply }: { reply: ChatReply }) {
  const mobile = useSyncExternalStore(subscribeToViewport, isMobileViewport, serverViewport);
  const actions = useRef<Drawer.Root.Actions | Popover.Root.Actions>(null);
  function closeForNavigation() {
    actions.current?.close();
    // Finish closing before the app covers or suspends this WebView, so an
    // interrupted exit transition cannot leave an empty drawer on return.
    actions.current?.unmount();
  }
  const sources = useMemo(() => groupChatSources(reply.references), [reply.references]);
  const numbers = useMemo(() => sources.flatMap((source) => source.citationNumber === null ? [] : [source.citationNumber]), [sources]);
  const Root = mobile ? Drawer.Root<string | null> : Popover.Root<string | null>;
  const Trigger = mobile ? Drawer.Trigger<string | null> : Popover.Trigger<string | null>;
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
    <Root actionsRef={actions}>
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
            <Drawer.Portal>
              <Drawer.Backdrop className="chat-source-backdrop" />
              <Drawer.Viewport className="chat-source-viewport">
                <Drawer.Popup className="chat-source-surface chat-source-sheet">
                  <div aria-hidden="true" className="chat-source-handle" />
                  <Drawer.Content className="chat-source-content">
                    <SourcePanel key={payload ?? "all"} sources={sources} initialKey={payload ?? null} mobile onOpenOriginal={closeForNavigation} />
                  </Drawer.Content>
                </Drawer.Popup>
              </Drawer.Viewport>
            </Drawer.Portal>
          ) : (
            <Popover.Portal>
              <Popover.Positioner side="bottom" align="start" sideOffset={8} collisionPadding={16} className="chat-source-positioner">
                <Popover.Popup className="chat-source-surface chat-source-popover">
                  <SourcePanel key={payload ?? "all"} sources={sources} initialKey={payload ?? null} mobile={false} onOpenOriginal={closeForNavigation} />
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          )}
        </>
      )}
    </Root>
  );
}

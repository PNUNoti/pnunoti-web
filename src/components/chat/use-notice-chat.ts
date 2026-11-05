"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { isChatHistory, isChatHistoryAvailability, isChatReply, isChatStatus, type ChatHistoryAvailability, type ChatReply, type ChatStatus } from "@/lib/chat-types";

export type ChatFailure = { message: string; retryAt?: number };
type Turn = { id: string; question: string; reply?: ChatReply; error?: ChatFailure; cancelled?: boolean };
type ActiveChat = {
  turnId: string; requestId: string; controller: AbortController; pollController: AbortController;
  timer?: ReturnType<typeof setTimeout>; stopping: boolean; started: number;
};

export function useNoticeChat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [status, setStatus] = useState<ChatStatus | null>(null);
  const [stopping, setStopping] = useState(false);
  const [controlError, setControlError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [resuming, setResuming] = useState(false);
  const previousConversation = useRef<{ id: string; revision: string } | null>(null);
  const restoring = useRef(false);
  const resumeError = useRef(false);
  const conversationId = useRef<string | undefined>(undefined);
  const activeRequest = useRef<ActiveChat | null>(null);
  const bootstrap = useRef<Promise<ChatHistoryAvailability> | null>(null);
  const loadSequence = useRef(0);
  const mounted = useRef(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const composing = useRef(false);
  const busy = pendingId !== null;

  useEffect(() => {
    mounted.current = true;
    void initialize();
    return () => {
      mounted.current = false;
      loadSequence.current++;
      const active = activeRequest.current;
      if (!active) return;
      // Accepted work survives refresh/navigation and is recovered from SQLite.
      active.controller.abort(); active.pollController.abort(); clearTimeout(active.timer);
      activeRequest.current = null;
    };
  }, []);

  function active(turnId: string, requestId: string): ActiveChat {
    return { turnId, requestId, controller: new AbortController(), pollController: new AbortController(), stopping: false, started: Date.now() };
  }

  function finish(item: ActiveChat) {
    if (activeRequest.current !== item) return;
    activeRequest.current = null;
    item.controller.abort(); item.pollController.abort(); clearTimeout(item.timer);
    setPendingId(null); setStopping(false); setControlError(null);
  }

  function clearPrevious() {
    previousConversation.current = null;
    setHasPrevious(false);
  }

  function applyStatus(item: ActiveChat, data: ChatStatus) {
    if (activeRequest.current !== item) return true;
    setStatus(data); setControlError(null);
    if (data.conversation_id) { conversationId.current = data.conversation_id; clearPrevious(); }
    if (data.phase === "completed") {
      if (data.reply) {
        setTurns((current) => current.map((turn) => turn.id === item.turnId ? { ...turn, reply: data.reply, error: undefined } : turn));
      } else {
        setTurns((current) => current.map((turn) => turn.id === item.turnId ? { ...turn, error: { message: "답변을 읽지 못했어요. 다시 질문해주세요." } } : turn));
      }
      finish(item); return true;
    }
    if (data.phase === "cancelled") {
      setTurns((current) => current.map((turn) => turn.id === item.turnId ? { ...turn, cancelled: true, error: undefined } : turn));
      finish(item); return true;
    }
    if (data.phase === "failed") {
      // 시간 초과는 특정 시간대에 질문이 몰릴 때 주로 생기므로 그 상황을 그대로 알린다.
      const timedOut = data.error?.status === 504 || data.error?.status === 408;
      const error: ChatFailure = { message: timedOut ? "지금 질문이 몰려 답변이 늦어요. 잠시 후 다시 시도해 주세요."
        : data.error?.message ?? "답변을 가져오지 못했어요. 다시 질문해주세요.",
        retryAt: data.error?.retry_after ? Date.now() + data.error.retry_after * 1000 : undefined };
      setTurns((current) => current.map((turn) => turn.id === item.turnId ? { ...turn, error } : turn));
      finish(item); return true;
    }
    return false;
  }

  function startPolling(item: ActiveChat) {
    async function poll() {
      if (activeRequest.current !== item) return;
      try {
        const response = await fetch(`/api/chat/${item.requestId}/status`, { cache: "no-store", signal: AbortSignal.any([item.pollController.signal, AbortSignal.timeout(20_000)]) });
        const data: unknown = await response.json().catch(() => null);
        if (activeRequest.current !== item) return;
        if (response.ok && isChatStatus(data) && data.request_id === item.requestId) {
          if (applyStatus(item, data)) return;
        } else if (response.status === 404 && Date.now() - item.started > 15_000) {
          throw new Error("missing-request");
        } else if (response.status !== 404) setControlError("연결을 다시 확인하고 있어요. 접수된 질문은 계속 처리돼요.");
      } catch (cause) {
        if (activeRequest.current !== item || item.pollController.signal.aborted) return;
        if ((cause instanceof Error && cause.message === "missing-request") || Date.now() - item.started > 420_000) {
          setTurns((current) => current.map((turn) => turn.id === item.turnId ? { ...turn, error: { message: "요청 상태를 확인하지 못했어요. 새로고침해서 대화를 다시 불러와주세요." } } : turn));
          finish(item); return;
        }
        setControlError("연결을 다시 확인하고 있어요. 접수된 질문은 계속 처리돼요.");
      }
      if (activeRequest.current === item) item.timer = setTimeout(() => void poll(), 2500);
    }
    void poll();
  }

  async function initialize() {
    if (activeRequest.current || restoring.current) return;
    const sequence = ++loadSequence.current;
    setLoadingError(null); setInitialized(false);
    resumeError.current = false;
    // Share the first GET across Strict Mode effects, so the browser gets one cookie.
    bootstrap.current ??= fetch("/api/chat?summary=true", { cache: "no-store", signal: AbortSignal.timeout(20_000) }).then(async (response) => {
      const data: unknown = await response.json();
      if (!response.ok || !isChatHistoryAvailability(data)) throw new Error();
      return data;
    });
    try {
      const data = await bootstrap.current;
      if (!mounted.current || sequence !== loadSequence.current) return;
      conversationId.current = undefined;
      previousConversation.current = data.has_history && data.conversation_id && data.revision ? { id: data.conversation_id, revision: data.revision } : null;
      setHasPrevious(previousConversation.current !== null);
      setInitialized(true);
    } catch {
      if (mounted.current && sequence === loadSequence.current) setLoadingError("대화를 준비하지 못했어요. 연결을 확인하고 다시 시도해주세요.");
    } finally { bootstrap.current = null; }
  }

  async function resumePrevious() {
    const previous = previousConversation.current;
    if (!initialized || !previous || restoring.current || activeRequest.current) return;
    const sequence = ++loadSequence.current;
    restoring.current = true;
    resumeError.current = true;
    setResuming(true); setInitialized(false); setLoadingError(null);
    try {
      const response = await fetch(`/api/chat?conversation_id=${previous.id}`, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
      const data: unknown = await response.json();
      if (!mounted.current || sequence !== loadSequence.current) return;
      if (response.status === 404) {
        clearPrevious(); resumeError.current = false;
        setLoadingError("이전 대화가 정리됐어요. 새 질문을 시작해주세요.");
        return;
      }
      if (!response.ok || !isChatHistory(data) || data.conversation_id !== previous.id) throw new Error();
      clearPrevious();
      conversationId.current = data.turns.length ? data.conversation_id : undefined;
      setTurns(data.turns.map(({ id, question, status: saved }) => ({ id, question,
        reply: saved.reply, cancelled: saved.phase === "cancelled",
        error: saved.error ? { message: saved.error.message } : undefined,
      })));
      resumeError.current = false;
      const pending = data.turns.find((turn) => !["completed", "failed", "cancelled"].includes(turn.status.phase));
      if (pending && !activeRequest.current) {
        const item = active(pending.id, pending.id);
        activeRequest.current = item;
        setPendingId(pending.id); setStatus(pending.status);
        startPolling(item);
      }
    } catch {
      if (mounted.current && sequence === loadSequence.current) setLoadingError("이전 대화를 불러오지 못했어요. 다시 시도해주세요.");
    } finally {
      restoring.current = false;
      if (mounted.current && sequence === loadSequence.current) { setResuming(false); setInitialized(true); }
    }
  }

  function retryLoad() { return resumeError.current ? resumePrevious() : initialize(); }

  async function stop() {
    const item = activeRequest.current;
    if (!item || item.stopping) return !item;
    item.stopping = true; setStopping(true); setControlError(null);
    try {
      const response = await fetch(`/api/chat/${item.requestId}/cancel`, { method: "POST", signal: AbortSignal.timeout(25_000) });
      const data: unknown = await response.json();
      if (activeRequest.current !== item) return true;
      if (!response.ok || !isChatStatus(data) || data.request_id !== item.requestId) throw new Error();
      return applyStatus(item, data);
    } catch {
      if (activeRequest.current === item) setControlError("중지 요청을 확인하지 못했어요. 중지 버튼을 다시 눌러주세요.");
      return false;
    } finally {
      if (activeRequest.current === item) { item.stopping = false; setStopping(false); }
    }
  }

  async function ask(id: string, question: string) {
    if (!initialized || restoring.current || activeRequest.current) return;
    setLoadingError(null); resumeError.current = false;
    const item = active(id, crypto.randomUUID());
    activeRequest.current = item;
    setPendingId(id); setStatus(null); setStopping(false); setControlError(null);
    setTurns((current) => current.map((turn) => turn.id === id ? { ...turn, cancelled: undefined, error: undefined } : turn));
    let accepted = false;
    const previous = conversationId.current ? null : previousConversation.current;
    try {
      const response = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, conversation_id: conversationId.current, request_id: item.requestId,
          ...(previous ? { discard_conversation_id: previous.id, discard_revision: previous.revision } : {}) }),
        signal: AbortSignal.any([item.controller.signal, AbortSignal.timeout(25_000)]),
      });
      const data: unknown = await response.json().catch(() => null);
      if (activeRequest.current !== item) return;
      if (response.status === 202 && isChatStatus(data) && data.request_id === item.requestId) {
        accepted = true;
        if (!applyStatus(item, data)) startPolling(item);
        return;
      }
      if (response.ok && isChatReply(data)) {
        conversationId.current = data.conversation_id;
        clearPrevious();
        setTurns((current) => current.map((turn) => turn.id === id ? { ...turn, reply: data } : turn));
        return;
      }
      if (response.status === 409 && data && typeof data === "object" && "code" in data && data.code === "cancelled") {
        setTurns((current) => current.map((turn) => turn.id === id ? { ...turn, cancelled: true } : turn));
        return;
      }
      const message = data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : "질문을 보내지 못했어요. 다시 시도해주세요.";
      const retry = Number(response.headers.get("retry-after"));
      setTurns((current) => current.map((turn) => turn.id === id ? { ...turn, error: { message,
        retryAt: response.status === 429 && retry > 0 ? Date.now() + retry * 1000 : undefined } } : turn));
    } catch {
      if (activeRequest.current === item && !item.controller.signal.aborted) {
        // The POST may have been accepted even if its response was lost.
        accepted = true; startPolling(item);
      }
    } finally { if (!accepted) finish(item); }
  }

  function send(question = text) {
    const value = question.trim();
    if (!initialized || restoring.current || !value || value.length > 4000 || activeRequest.current) return;
    const id = crypto.randomUUID();
    setTurns((current) => [...current, { id, question: value }]);
    setText(""); void ask(id, value); input.current?.focus();
  }

  function edit(turn: Turn) {
    setTurns((current) => current.filter(({ id }) => id !== turn.id));
    setText(turn.question); input.current?.focus();
  }

  async function restart(event: MouseEvent) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (!initialized || restoring.current || (activeRequest.current && !await stop())) return;
    conversationId.current = undefined;
    clearPrevious();
    setTurns([]); setText(""); setStatus(null);
    await initialize();
  }

  return { turns, text, setText, pendingId, status, stopping, controlError, initialized, loadingError, hasPrevious, resuming,
    input, form, composing, busy, ask, send, edit, stopAnswer: stop, restart, retryLoad, resumePrevious };
}

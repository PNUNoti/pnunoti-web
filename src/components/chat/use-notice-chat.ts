"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { isChatHistory, isChatHistoryAvailability, isChatReply, isChatStatus, type ChatHistoryAvailability, type ChatReply, type ChatStatus } from "@/lib/chat-types";
import { connectAppUser, notificationRequest, restoreNotificationAnswer, type AppChatUser, type AppConnectionPurpose } from "@/lib/chat-app-bridge";
import { ChatConnectionError, chatAccountError, forgetUnseenChatRequest, readUnseenChatRequest, recoverUnseenChatRequest, rememberUnseenChatRequest, submitRememberedQuestion, type UnseenChatRequest } from "@/lib/chat-recovery";

export type ChatFailure = { message: string; retryAt?: number };
type Turn = { id: string; question: string; reply?: ChatReply; error?: ChatFailure; cancelled?: boolean; events?: ChatStatus["events"] };
type ActiveChat = {
  turnId: string; requestId: string; controller: AbortController; pollController: AbortController;
  record?: UnseenChatRequest; timer?: ReturnType<typeof setTimeout>; stopping: boolean; submitted: boolean; notificationEnabled: boolean; started: number;
};

export function useNoticeChat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [status, setStatus] = useState<ChatStatus | null>(null);
  const [stopping, setStopping] = useState(false);
  const [controlError, setControlError] = useState<string | null>(null);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [notificationWarning, setNotificationWarning] = useState<string | null>(null);
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
  const notificationBootstrap = useRef<ReturnType<typeof restoreNotificationAnswer> | null>(null);
  const appUser = useRef<AppChatUser | null>(null);
  const identityBootstrap = useRef<ReturnType<typeof connectAppUser> | null>(null);
  const identityPurpose = useRef<AppConnectionPurpose>("identity");
  const unsentRequest = useRef<UnseenChatRequest | null>(null);
  const recoveryBootstrap = useRef<ReturnType<typeof recoverUnseenChatRequest> | null>(null);
  const unseenRequest = useRef<{ turnId: string; requestId: string; settled: boolean } | null>(null);
  const loadSequence = useRef(0);
  const mounted = useRef(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const composing = useRef(false);
  const busy = pendingId !== null;

  const acknowledgeResult = useCallback((turnId: string) => {
    const unseen = unseenRequest.current;
    if (!unseen?.settled || unseen.turnId !== turnId) return;
    forgetUnseenChatRequest(unseen.requestId);
    unseenRequest.current = null;
  }, []);

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
    return { turnId, requestId, controller: new AbortController(), pollController: new AbortController(), stopping: false, submitted: false, notificationEnabled: false, started: Date.now() };
  }

  function finish(item: ActiveChat) {
    if (activeRequest.current !== item) return;
    activeRequest.current = null;
    item.controller.abort(); item.pollController.abort(); clearTimeout(item.timer);
    setPendingId(null); setStopping(false); setControlError(null); setNotificationEnabled(false);
  }

  function clearPrevious() {
    previousConversation.current = null;
    setHasPrevious(false);
  }

  function applyStatus(item: ActiveChat, data: ChatStatus) {
    if (activeRequest.current !== item) return true;
    setStatus(data); setControlError(null);
    if (["completed", "cancelled", "failed"].includes(data.phase)) {
      setTurns((current) => current.map((turn) => turn.id === item.turnId ? { ...turn, events: data.events } : turn));
    }
    item.notificationEnabled = data.notification_enabled === true;
    setNotificationEnabled(item.notificationEnabled);
    if (item.record) {
      item.record = { ...item.record, accepted: true, notificationEnabled: item.notificationEnabled };
      rememberUnseenChatRequest(item.record);
    }
    if (unsentRequest.current?.requestId === item.requestId) unsentRequest.current = null;
    if (unseenRequest.current?.requestId === item.requestId) {
      unseenRequest.current.settled = ["completed", "cancelled", "failed"].includes(data.phase);
    }
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
        // Allow 20 minutes to generate, up to 5 minutes in queue, plus 2 minutes
        // to recover a transient status connection before giving up polling.
        if ((cause instanceof Error && cause.message === "missing-request") || Date.now() - item.started > 27 * 60_000) {
          setTurns((current) => current.map((turn) => turn.id === item.turnId ? { ...turn, error: { message: "질문 전송을 확인하지 못했어요. 이 화면에서 다시 시도해주세요." } } : turn));
          finish(item); return;
        }
        setControlError("연결을 다시 확인하고 있어요. 접수된 질문은 계속 처리돼요.");
      }
      if (activeRequest.current === item) item.timer = setTimeout(() => void poll(), 2500);
    }
    void poll();
  }

  function connectIdentity(purpose: AppConnectionPurpose = "identity"): Promise<AppChatUser | null> {
    if (identityBootstrap.current && purpose === "notify" && identityPurpose.current === "identity") {
      // A fast login proof cannot replace notification permission/token checks.
      // Escalate only after the shared login request settles.
      return identityBootstrap.current.then(
        user => user?.notifications_ready ? user : connectIdentity("notify"),
        () => connectIdentity("notify"),
      );
    }
    if (!identityBootstrap.current) {
      identityPurpose.current = purpose;
      const connection = connectAppUser(purpose).then((user) => {
        if (mounted.current) appUser.current = user;
        return user;
      }).catch((error: unknown) => {
        if (mounted.current) appUser.current = null;
        throw error;
      }).finally(() => {
        if (identityBootstrap.current === connection) identityBootstrap.current = null;
      });
      identityBootstrap.current = connection;
    }
    return identityBootstrap.current;
  }

  async function initialize() {
    if (activeRequest.current || restoring.current) return;
    const sequence = ++loadSequence.current;
    setLoadingError(null); setInitialized(false);
    resumeError.current = false;
    const notificationId = notificationRequest(window.location.href);
    const remembered = readUnseenChatRequest();
    if (notificationId || remembered) setResuming(true);
    // Share the first GET across Strict Mode effects, so the browser gets one cookie.
    bootstrap.current ??= fetch("/api/chat?summary=true", { cache: "no-store", signal: AbortSignal.timeout(20_000) }).then(async (response) => {
      const data: unknown = await response.json();
      if (!response.ok || !isChatHistoryAvailability(data)) throw new Error();
      return data;
    });
    try {
      const data = await bootstrap.current;
      if (!mounted.current || sequence !== loadSequence.current) return;
      if (notificationId) {
        // Resume proves the app account itself. Do not first perform a second
        // account/notification connection for the same notification tap.
        notificationBootstrap.current ??= restoreNotificationAnswer(notificationId);
        const history = await notificationBootstrap.current;
        if (!mounted.current || sequence !== loadSequence.current) return;
        applyHistory(history, remembered);
        const url = new URL(window.location.href);
        url.searchParams.delete("chat_request");
        window.history.replaceState(window.history.state, "", url);
        setInitialized(true);
        void connectIdentity().catch(() => {});
        return;
      }
      const identity = connectIdentity().catch(() => {
        if (mounted.current) setNotificationWarning(current => current ?? "앱 계정을 연결하지 못했어요. 완료 알림 없이 답변을 확인할 수 있어요.");
      });
      // Recovery checks the account, without obtaining a push token. Ordinary
      // history belongs to the browser cookie and need not wait even for that.
      if (remembered) await identity;
      if (!mounted.current || sequence !== loadSequence.current) return;
      if (remembered) {
        const accountError = chatAccountError(remembered, appUser.current?.user_id ?? null);
        if (remembered.question && accountError) {
          unsentRequest.current = remembered;
          setTurns([{ id: remembered.requestId, question: remembered.question, error: { message: accountError.message } }]);
          setInitialized(true);
          return;
        }
        const recoveryUser = remembered.question && !remembered.userId ? undefined : appUser.current?.user_id;
        recoveryBootstrap.current ??= recoverUnseenChatRequest(remembered, recoveryUser);
        const history = await recoveryBootstrap.current;
        if (!mounted.current || sequence !== loadSequence.current) return;
        if (history) {
          applyHistory(history, remembered);
          setInitialized(true);
          return;
        }
        if (remembered.question) {
          unsentRequest.current = remembered;
          conversationId.current = remembered.conversationId;
          setTurns([{ id: remembered.requestId, question: remembered.question }]);
          setInitialized(true);
          if (!remembered.accepted) void ask(remembered.requestId, remembered.question, remembered);
          else setTurns([{ id: remembered.requestId, question: remembered.question, error: { message: "접수된 질문을 찾지 못했어요. 새 질문으로 다시 보내주세요." } }]);
          return;
        }
        forgetUnseenChatRequest(remembered.requestId);
      }
      conversationId.current = undefined;
      previousConversation.current = data.has_history && data.conversation_id && data.revision ? { id: data.conversation_id, revision: data.revision } : null;
      setHasPrevious(previousConversation.current !== null);
      setInitialized(true);
    } catch {
      if (mounted.current && sequence === loadSequence.current) setLoadingError(notificationId
        ? "알림의 답변을 불러오지 못했어요. 앱 로그인 상태를 확인한 뒤 다시 시도해주세요."
        : remembered ? "기다리던 답변을 불러오지 못했어요. 연결을 확인하고 다시 시도해주세요."
        : "대화를 준비하지 못했어요. 연결을 확인하고 다시 시도해주세요.");
    } finally {
      if (mounted.current && sequence === loadSequence.current) {
        bootstrap.current = null; notificationBootstrap.current = null; recoveryBootstrap.current = null;
        setResuming(false);
      }
    }
  }

  function applyHistory(data: import("@/lib/chat-types").ChatHistory, remembered: UnseenChatRequest | null = readUnseenChatRequest()) {
    clearPrevious();
    conversationId.current = data.turns.length ? data.conversation_id ?? undefined : undefined;
    setTurns(data.turns.map(({ id, question, status: saved }) => ({ id, question,
      reply: saved.reply, cancelled: saved.phase === "cancelled", events: saved.events,
      error: saved.error ? { message: saved.error.message }
        : saved.phase === "completed" && !saved.reply ? { message: "답변을 읽지 못했어요. 다시 질문해주세요." }
        : saved.phase === "failed" ? { message: "답변을 가져오지 못했어요. 다시 질문해주세요." } : undefined,
    })));
    const pending = data.turns.find((turn) => !["completed", "failed", "cancelled"].includes(turn.status.phase));
    const unseen = data.turns.find(turn => turn.id === remembered?.requestId);
    if (unseen) unseenRequest.current = { turnId: unseen.id, requestId: unseen.id, settled: ["completed", "failed", "cancelled"].includes(unseen.status.phase) };
    if (pending && !activeRequest.current) {
      const item = active(pending.id, pending.id);
      activeRequest.current = item;
      item.submitted = true;
      item.notificationEnabled = pending.status.notification_enabled === true;
      if (remembered?.requestId === pending.id) {
        item.record = { ...remembered, accepted: true, notificationEnabled: item.notificationEnabled };
        rememberUnseenChatRequest(item.record);
      }
      if (!remembered) {
        rememberUnseenChatRequest({ requestId: pending.id, savedAt: Date.now(), notificationEnabled: false });
        unseenRequest.current = { turnId: pending.id, requestId: pending.id, settled: false };
      }
      setNotificationEnabled(item.notificationEnabled);
      setPendingId(pending.id); setStatus(pending.status);
      startPolling(item);
    }
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
      applyHistory(data);
      resumeError.current = false;
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
    if (!item.submitted) {
      forgetUnseenChatRequest(item.requestId);
      unsentRequest.current = null;
      setTurns((current) => current.map((turn) => turn.id === item.turnId ? { ...turn, cancelled: true } : turn));
      finish(item);
      return true;
    }
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

  function checkQuestionConnection(record: UnseenChatRequest, newRequest = false) {
    const accountError = chatAccountError(record, appUser.current?.user_id ?? null);
    if (accountError) throw accountError;
    if (record.userId && !appUser.current?.notifications_ready) {
      // Only a fresh, unsubmitted UUID may fall back to cookie-only chat.
      // Retries keep the original account and notification authorization.
      if (!newRequest) throw new ChatConnectionError("notifications");
      record.userId = null;
      rememberUnseenChatRequest(record);
    }
  }

  async function ask(id: string, question: string, replay?: UnseenChatRequest) {
    if ((!initialized && !replay) || restoring.current || activeRequest.current) return;
    setLoadingError(null); setNotificationWarning(null); resumeError.current = false;
    const retained = unsentRequest.current ?? readUnseenChatRequest();
    const previous = conversationId.current ? null : previousConversation.current;
    const savedRequest = replay ?? (retained?.question === question && !retained.accepted ? retained : null);
    const record: UnseenChatRequest = savedRequest ?? {
      requestId: crypto.randomUUID(), question, savedAt: Date.now(), notificationEnabled: false,
      // Bind a new question to the pending verification, not a cached account.
      userId: identityBootstrap.current || !appUser.current?.notifications_ready ? null : appUser.current.user_id,
      ...(conversationId.current ? { conversationId: conversationId.current } : {}),
      ...(previous ? { discardId: previous.id, discardRevision: previous.revision } : {}),
    };
    // Save the exact payload and UUID synchronously, before any network or bridge work.
    unsentRequest.current = record;
    if (!rememberUnseenChatRequest(record)) setNotificationWarning("기기에 질문을 저장하지 못했어요. 접수가 확인될 때까지 이 화면을 유지해주세요.");
    const item = active(id, record.requestId);
    item.record = record;
    activeRequest.current = item;
    unseenRequest.current = { turnId: id, requestId: item.requestId, settled: false };
    setPendingId(id); setStatus(null); setStopping(false); setControlError(null); setNotificationEnabled(false);
    setTurns((current) => current.map((turn) => turn.id === id ? { ...turn, cancelled: undefined, error: undefined } : turn));
    let polling = false;
    try {
      // Reuse startup verification, or retry a failed/anonymous connection,
      // before submitting a new question without completion notifications.
      if (!replay && !record.accepted && !record.userId && (identityBootstrap.current || window.__PNUNOTI_CHAT_PUSH__ === 1)) {
        try { await connectIdentity("notify"); }
        catch { appUser.current = null; }
        if (activeRequest.current !== item || item.stopping) return;
        if (appUser.current?.notifications_ready) {
          record.userId = appUser.current.user_id;
          rememberUnseenChatRequest(record);
        }
      }
      // Finish pending verification or refresh an expired page login.
      if (record.userId && (identityBootstrap.current || !appUser.current?.notifications_ready || appUser.current.expires_at * 1000 <= Date.now() + 5000)) await connectIdentity("notify");
      if (activeRequest.current !== item || item.stopping) return;
      checkQuestionConnection(record, !savedRequest);
      if (window.__PNUNOTI_CHAT_PUSH__ === 1 && !record.userId) setNotificationWarning(current => current ?? "완료 알림을 연결하지 못했어요. 답변은 이 화면에서 확인해주세요.");
      item.submitted = true;
      let response = await submitRememberedQuestion(record, appUser.current?.user_id ?? null,
        AbortSignal.any([item.controller.signal, AbortSignal.timeout(25_000)]));
      if ([401, 403].includes(response.status) && record.userId) {
        item.submitted = false;
        await connectIdentity("notify");
        if (activeRequest.current !== item || item.stopping) return;
        checkQuestionConnection(record);
        item.submitted = true;
        response = await submitRememberedQuestion(record, appUser.current?.user_id ?? null,
          AbortSignal.any([item.controller.signal, AbortSignal.timeout(25_000)]));
      }
      const data: unknown = await response.json().catch(() => null);
      if (activeRequest.current !== item) return;
      if (response.status === 202 && isChatStatus(data) && data.request_id === item.requestId) {
        polling = true;
        if (!applyStatus(item, data)) startPolling(item);
        return;
      }
      if (response.ok && isChatReply(data)) {
        rememberUnseenChatRequest({ ...record, accepted: true });
        unsentRequest.current = null;
        if (unseenRequest.current?.requestId === item.requestId) unseenRequest.current.settled = true;
        conversationId.current = data.conversation_id;
        clearPrevious();
        setTurns((current) => current.map((turn) => turn.id === id ? { ...turn, reply: data } : turn));
        return;
      }
      if (response.status === 409 && data && typeof data === "object" && "code" in data && data.code === "cancelled") {
        forgetUnseenChatRequest(item.requestId); unsentRequest.current = null;
        setTurns((current) => current.map((turn) => turn.id === id ? { ...turn, cancelled: true } : turn));
        return;
      }
      if (response.status >= 500) { polling = true; startPolling(item); return; }
      const message = data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : "질문을 보내지 못했어요. 다시 시도해주세요.";
      const retry = Number(response.headers.get("retry-after"));
      setTurns((current) => current.map((turn) => turn.id === id ? { ...turn, error: { message,
        retryAt: response.status === 429 && retry > 0 ? Date.now() + retry * 1000 : undefined } } : turn));
    } catch (cause) {
      if (activeRequest.current === item && !item.controller.signal.aborted) {
        if (item.submitted && !(cause instanceof ChatConnectionError)) {
          polling = true; startPolling(item);
        } else setTurns((current) => current.map((turn) => turn.id === id ? { ...turn, error: { message:
          cause instanceof ChatConnectionError ? cause.message : "앱 연결을 확인하지 못했어요. 질문은 보관했어요. 다시 시도해주세요." } } : turn));
      }
    } finally { if (!polling) finish(item); }
  }

  function send(question = text) {
    const value = question.trim();
    if (!initialized || restoring.current || !value || value.length > 4000 || activeRequest.current) return;
    const id = crypto.randomUUID();
    setTurns((current) => [...current, { id, question: value }]);
    setText(""); void ask(id, value);
    // 터치 기기는 답변을 볼 수 있게 키보드를 닫고, PC는 연속 입력을 유지한다.
    if (window.matchMedia("(pointer: coarse)").matches) input.current?.blur();
    else input.current?.focus();
  }

  function edit(turn: Turn) {
    setTurns((current) => current.filter(({ id }) => id !== turn.id));
    setText(turn.question); input.current?.focus();
  }

  async function restart(event: MouseEvent) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (!initialized || restoring.current || (activeRequest.current && !await stop())) return;
    if (unseenRequest.current) forgetUnseenChatRequest(unseenRequest.current.requestId);
    unseenRequest.current = null;
    conversationId.current = undefined;
    const url = new URL(window.location.href);
    url.searchParams.delete("chat_request");
    window.history.replaceState(window.history.state, "", url);
    setNotificationWarning(null);
    clearPrevious();
    setTurns([]); setText(""); setStatus(null);
    await initialize();
  }

  return { turns, text, setText, pendingId, status, stopping, controlError, notificationEnabled, notificationWarning, initialized, loadingError, hasPrevious, resuming,
    input, form, composing, busy, ask, send, edit, stopAnswer: stop, restart, retryLoad, resumePrevious, acknowledgeResult };
}

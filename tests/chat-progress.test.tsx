import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatProgressTrace, chatActivityLabel } from "../src/components/chat/chat-progress";
import { chatNarrations, chatProgressSteps, chatProgressTimeline, isChatStatus, publicChatStatus, type ChatEvent, type ChatStatus } from "../src/lib/chat-types";

const status: ChatStatus = {
  request_id: "11111111-2222-4333-8444-555555555555", conversation_id: null,
  phase: "generating", generating: true, status_available: true, elapsed_seconds: 12,
  events: [{ phase: "generating", elapsed_seconds: 10, progress: { step_id: "tool-1", label: "관련 공지를 검색하고 있어요", status: "running" } }],
};

test("legacy statuses still work; progress rejects malformed identifiers, labels and states", () => {
  assert.equal(isChatStatus({ ...status, events: [] }), true);
  assert.equal(isChatStatus(status), true);
  for (const override of [{ step_id: "../secret" }, { step_id: "a".repeat(65) }, { label: " " }, { label: "a".repeat(241) }, { status: "unknown" }, { status: ["running"] }, { kind: "thought" }, { kind: ["narration"] }]) {
    assert.equal(isChatStatus({ ...status, events: [{ ...status.events[0], progress: { ...status.events[0].progress, ...override } }] }), false);
  }
});

test("narration is folded into the trace with steps, in the order it arrived", () => {
  const narration = { step_id: "narration-1", label: "장학금 공지를 찾아볼게요.", status: "completed", kind: "narration" } as const;
  const events: ChatEvent[] = [
    { phase: "generating", elapsed_seconds: 2, progress: narration },
    { phase: "generating", elapsed_seconds: 3, progress: { ...status.events[0].progress!, status: "completed" } },
  ];
  assert.deepEqual(chatNarrations(events), [narration]);
  assert.deepEqual(chatProgressSteps(events), [events[1].progress]);
  // 같은 항목이 다시 오면 처음 자리에서 최신 상태로 바뀐다.
  assert.deepEqual(chatProgressTimeline(events), [narration, events[1].progress]);
  assert.deepEqual(chatProgressTimeline([...events, { phase: "generating", elapsed_seconds: 4, progress: { ...narration, label: "장학금 공지를 찾았어요." } }]),
    [{ ...narration, label: "장학금 공지를 찾았어요." }, events[1].progress]);
  // 설명 문장만 있어도 접힌 확인 과정으로 보여준다.
  const html = renderToStaticMarkup(<ChatProgressTrace events={[events[0]]} />);
  assert.match(html, /확인 과정/);
  assert.match(html, /aria-expanded="false"/);
  assert.equal(renderToStaticMarkup(<ChatProgressTrace events={[]} />), "");
});

test("narration keeps only public fields across the proxy", () => {
  const narration = { step_id: "narration-1", label: "<img src=x onerror=alert(1) /> 확인할게요.", status: "completed", kind: "narration" } as const;
  const upstream = { ...status, events: [{ ...status.events[0], progress: { ...narration, thought: "PRIVATE", args: "PRIVATE" } }] };
  assert.equal(isChatStatus(upstream), true);
  const safe = publicChatStatus(upstream);
  assert.deepEqual(safe.events[0].progress, narration);
  assert.ok(!JSON.stringify(safe).includes("PRIVATE"));
});

test("proxy retains public progress fields and drops raw tool data and thoughts", () => {
  const unsafe = { ...status, secret: "PRIVATE", events: [{ ...status.events[0], raw: "PRIVATE", progress: {
    ...status.events[0].progress!, functionCall: { args: "PRIVATE" }, functionResponse: "PRIVATE", thought: "PRIVATE",
  } }] };
  const safe = publicChatStatus(unsafe);
  assert.deepEqual(safe, status);
  assert.ok(!JSON.stringify(safe).includes("PRIVATE"));
});

test("trace uses the latest actual tool status without changing the event log", () => {
  const events: ChatEvent[] = [...status.events,
    { phase: "generating", elapsed_seconds: 12, progress: { ...status.events[0].progress!, status: "completed" } },
    { phase: "generating", elapsed_seconds: 13, progress: { step_id: "tool-2", label: "공지 본문을 확인하고 있어요", status: "running" } },
  ];
  assert.deepEqual(chatProgressSteps(events), [events[1].progress, events[2].progress]);
  assert.equal(events.length, 3);
  assert.equal(events[0].progress!.status, "running");
});

test("providers without progress do not render a trace; actual steps have an accessible toggle", () => {
  assert.equal(renderToStaticMarkup(<ChatProgressTrace events={[]} />), "");
  const html = renderToStaticMarkup(<ChatProgressTrace events={status.events} />);
  assert.match(html, /확인 과정/);
  assert.match(html, /aria-expanded="false"/);
  assert.ok(!html.includes("NotebookLM"));
});

test("main waiting line keeps the latest signal instead of falling back to a fixed sentence", () => {
  const at = (elapsed_seconds: number, progress: ChatEvent["progress"]): ChatEvent => ({ phase: "generating", elapsed_seconds, progress });
  assert.equal(chatActivityLabel([]), null);
  const search = { step_id: "tool-1", label: "관련 공지 자료를 검색하고 있어요", status: "running" } as const;
  assert.equal(chatActivityLabel([at(1, search)]), "관련 공지 자료를 검색하고 있어요");
  // 도구가 끝나면 끝난 일에 이어지는 문구를 보여준다.
  assert.equal(chatActivityLabel([at(1, search), at(3, { ...search, status: "completed" })]), "찾은 공지를 살펴보고 있어요");
  const read = { step_id: "tool-2", label: "공지 본문을 확인하고 있어요", status: "completed" } as const;
  assert.equal(chatActivityLabel([at(1, search), at(5, read)]), "읽은 내용을 정리하고 있어요");
  assert.equal(chatActivityLabel([at(1, { step_id: "tool-3", label: "관련 자료를 확인하고 있어요", status: "failed" })]), "확인한 내용을 정리하고 있어요");
  // 설명 문장이 가장 최근 신호면 그 첫 문장을 쓰고, 길면 줄인다.
  const narration = { step_id: "narration-1", label: "장학금 공지를 찾아볼게요. 마감일도 함께 확인할게요.", status: "completed", kind: "narration" } as const;
  assert.equal(chatActivityLabel([at(1, search), at(2, narration)]), "장학금 공지를 찾아볼게요.");
  const long = chatActivityLabel([at(1, { ...narration, label: "가".repeat(80) })])!;
  assert.equal(long.length, 60);
  assert.ok(long.endsWith("…"));
});

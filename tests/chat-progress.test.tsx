import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatProgressTrace } from "../src/components/chat/chat-progress";
import { chatProgressSteps, isChatStatus, publicChatStatus, type ChatEvent, type ChatStatus } from "../src/lib/chat-types";

const status: ChatStatus = {
  request_id: "11111111-2222-4333-8444-555555555555", conversation_id: null,
  phase: "generating", generating: true, status_available: true, elapsed_seconds: 12,
  events: [{ phase: "generating", elapsed_seconds: 10, progress: { step_id: "tool-1", label: "관련 공지를 검색하고 있어요", status: "running" } }],
};

test("legacy statuses still work; progress rejects malformed identifiers, labels and states", () => {
  assert.equal(isChatStatus({ ...status, events: [] }), true);
  assert.equal(isChatStatus(status), true);
  for (const override of [{ step_id: "../secret" }, { step_id: "a".repeat(65) }, { label: " " }, { label: "a".repeat(241) }, { status: "unknown" }, { status: ["running"] }]) {
    assert.equal(isChatStatus({ ...status, events: [{ ...status.events[0], progress: { ...status.events[0].progress, ...override } }] }), false);
  }
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

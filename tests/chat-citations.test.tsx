import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { groupChatSources, remarkCitations } from "../src/lib/chat-citations";

function render(answer: string, numbers = [1, 2, 3]) {
  return renderToStaticMarkup(
    <ReactMarkdown remarkPlugins={[remarkGfm, [remarkCitations, { numbers }]]} components={{
      sup: ({ node, children }) => <button aria-label={`출처 ${node?.properties["data-citation"]} 보기`}>{children}</button>,
    }}>{answer}</ReactMarkdown>,
  );
}

test("renders each citation in a list or range as a separate control", () => {
  for (const citation of ["[1, 2, 3]", "[1-3]", "[1–3]", "[1~3]", "[1, 2–3]"]) {
    const html = render(`신청 기간이에요. ${citation}`);
    assert.equal((html.match(/<button/g) ?? []).length, 3);
    for (const number of [1, 2, 3]) assert.ok(html.includes(`aria-label="출처 ${number} 보기"`));
  }
});

test("keeps unknown and incomplete citations as text without inventing a source", () => {
  for (const citation of ["[4]", "[1, 4]", "[1-4]", "[3-1]", "[1-999999999999999999999999]"]) {
    const html = render(`확인이 필요해요. ${citation}`);
    assert.ok(!html.includes("<button"));
    assert.ok(html.includes(citation));
  }
  assert.ok(!render("공지 [1]", []).includes("<button"));
});

test("preserves code, links, and markdown tables while enabling body citations", () => {
  const html = render("본문 [1]\n\n`[2]`\n\n```text\n[3]\n```\n\n[[1]](https://example.com)\n\n| 일정 | 출처 |\n| --- | --- |\n| 11월 | [2] |");
  assert.equal((html.match(/<button/g) ?? []).length, 2);
  assert.ok(html.includes("<code>[2]</code>"));
  assert.ok(html.includes("[3]\n</code>"));
  assert.ok(html.includes('<a href="https://example.com">[1]</a>'));
  assert.ok(html.includes("<table>"));
});

test("preserves text around consecutive citations and deduplicates a repeated number", () => {
  const html = render("앞 문장 [1][2] 뒤 문장 [3, 3].");
  assert.equal((html.match(/<button/g) ?? []).length, 3);
  assert.ok(html.includes("앞 "));
  assert.ok(html.includes("뒤 "));
  assert.ok(html.endsWith(".</p>"));
});

test("groups repeated citation excerpts without renumbering unnumbered sources", () => {
  const sources = groupChatSources([
    { source_id: "a", citation_number: 7, cited_text: " 신청 마감은 11월 15일 " },
    { source_id: "a", citation_number: 7, cited_text: "신청 마감은 11월 15일" },
    { source_id: "a", citation_number: 7, cited_text: "온라인으로 신청" },
    { source_id: "b", citation_number: null, cited_text: null },
    { source_id: "b", citation_number: null, cited_text: " " },
  ]);
  assert.deepEqual(sources, [
    { key: "citation:7", citationNumber: 7, excerpts: ["신청 마감은 11월 15일", "온라인으로 신청"] },
    { key: "source:b", citationNumber: null, excerpts: [] },
  ]);
});

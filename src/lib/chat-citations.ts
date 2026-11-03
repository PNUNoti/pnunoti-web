import { safePostId, safeSourceUrl, type ChatReference } from "./chat-types";

export type SourceNotice = { key: string; title: string | null; url: string | null; excerpt: string | null; postId: string | null };

export type ChatSource = {
  key: string;
  citationNumber: number | null;
  notices: SourceNotice[];
};

// A citation can contain several excerpts. Keep the server's numbers and remove
// repeated excerpts; unnumbered references must not borrow an array index.
export function groupChatSources(references: ChatReference[]): ChatSource[] {
  const sources = new Map<string, ChatSource>();
  for (const reference of references) {
    const key = reference.citation_number === null ? `source:${reference.source_id}` : `citation:${reference.citation_number}`;
    let source = sources.get(key);
    if (!source) {
      source = { key, citationNumber: reference.citation_number, notices: [] };
      sources.set(key, source);
    }
    const url = safeSourceUrl(reference.url);
    const noticeKey = url ?? reference.source_id;
    const excerpt = reference.cited_text?.trim().replace(/\s+/g, " ") || null;
    const existing = source.notices.find((notice) => notice.key === noticeKey);
    const shortExcerpt = excerpt && excerpt.length > 240 ? excerpt.slice(0, 239).trimEnd() + "…" : excerpt;
    if (!existing) source.notices.push({ key: noticeKey, title: reference.title?.trim() || null, url, excerpt: shortExcerpt, postId: safePostId(reference.post_id) });
    else {
      if (!existing.excerpt && shortExcerpt) existing.excerpt = shortExcerpt;
      if (!existing.postId) existing.postId = safePostId(reference.post_id);
    }
  }
  return [...sources.values()];
}

type MarkdownNode = { type: string; value?: string; children?: MarkdownNode[]; data?: Record<string, unknown> };
const CITATION = /\[(\d+(?:\s*[,\-–~]\s*\d+)*)\]/g;

function citationNumbers(token: string, available: Set<number>): number[] | null {
  const numbers: number[] = [];
  for (const part of token.slice(1, -1).split(",")) {
    const range = part.trim().match(/^(\d+)(?:\s*[-–~]\s*(\d+))?$/);
    if (!range) return null;
    const start = Number(range[1]);
    const end = Number(range[2] ?? range[1]);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end) return null;
    // Filter known numbers instead of expanding an untrusted, potentially huge range.
    const matches = [...available].filter((number) => number >= start && number <= end).sort((a, b) => a - b);
    if (matches.length !== end - start + 1) return null;
    numbers.push(...matches);
  }
  return [...new Set(numbers)];
}

// Only turn resolvable citations into controls. Links and code keep their
// original meaning, and a range such as [1–3] becomes three separate controls.
export function remarkCitations(options: { numbers: number[] }) {
  const available = new Set(options.numbers);
  const walk = (node: MarkdownNode) => {
    if (!node.children || ["link", "linkReference", "code", "inlineCode"].includes(node.type)) return;
    node.children = node.children.flatMap((child) => {
      if (child.type !== "text" || !child.value) { walk(child); return [child]; }
      const parts: MarkdownNode[] = [];
      let last = 0;
      for (const match of child.value.matchAll(CITATION)) {
        const numbers = citationNumbers(match[0], available);
        if (!numbers?.length) continue;
        const before = child.value.slice(last, match.index);
        // Keep the preceding word and its citation on the same line.
        const word = before.match(/(\S+)(\s*)$/);
        const head = word ? before.slice(0, word.index) : before;
        if (head) parts.push({ type: "text", value: head });
        const badges = numbers.map((number) => ({
          type: "element", tagName: "sup", properties: { "data-citation": number },
          children: [{ type: "text", value: String(number) }],
        }));
        parts.push({
          type: "citation", children: [],
          data: {
            hName: "span", hProperties: { className: ["chat-cite-wrap"] },
            hChildren: [...(word ? [{ type: "text", value: word[1] + word[2] }] : []), ...badges],
          },
        });
        last = match.index + match[0].length;
      }
      if (!parts.length) return [child];
      if (last < child.value.length) parts.push({ type: "text", value: child.value.slice(last) });
      return parts;
    });
  };
  return (tree: unknown) => walk(tree as MarkdownNode);
}

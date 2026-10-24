/**
 * The policy pages' texts (`src/content/policies/*.md`) read into blocks the pages draw. Only the small part of
 * markdown those texts use is read: `#` and `##` headings, paragraphs, `- ` lists, `**bold**`, `_italic_` and
 * `[words](target)` links. An HTML comment is dropped, so a note in a text never reaches the page or its source.
 *
 * A link's target is one of the six pages by its short name (`about`, `contact`, `pricing`, `terms`, `privacy`,
 * `refund`), an `https://` address, a `mailto:` or a `tel:`; any other target is shown as plain words.
 */

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "strong"; children: Inline[] }
  | { kind: "em"; children: Inline[] }
  | { kind: "page"; page: PolicyPageName; children: Inline[] }
  | { kind: "href"; href: string; children: Inline[] };

export type Block =
  { kind: "h1" | "h2" | "p"; inline: Inline[] } | { kind: "ul"; items: Inline[][] };

/** The six pages, by the short names the texts link them with, and where each lives in this app. */
export const POLICY_PATHS = {
  about: "/about",
  contact: "/contact",
  pricing: "/pricing",
  terms: "/terms",
  privacy: "/privacy",
  refund: "/refund-policy",
} as const;

export type PolicyPageName = keyof typeof POLICY_PATHS;

function isPage(name: string): name is PolicyPageName {
  return Object.prototype.hasOwnProperty.call(POLICY_PATHS, name);
}

const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|(?<![A-Za-z0-9])_(.+?)_(?![A-Za-z0-9])/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let at = 0;
  for (const m of text.matchAll(INLINE)) {
    const start = m.index ?? 0;
    if (start > at) out.push({ kind: "text", text: text.slice(at, start) });
    const [whole, bold, words, target, italic] = m;
    if (bold !== undefined) out.push({ kind: "strong", children: parseInline(bold) });
    else if (italic !== undefined) out.push({ kind: "em", children: parseInline(italic) });
    else if (words !== undefined && target !== undefined) {
      const children = parseInline(words);
      if (isPage(target)) out.push({ kind: "page", page: target, children });
      else if (/^(https:\/\/|mailto:|tel:)/.test(target))
        out.push({ kind: "href", href: target, children });
      else out.push(...children);
    }
    at = start + whole.length;
  }
  if (at < text.length) out.push({ kind: "text", text: text.slice(at) });
  return out;
}

export function parsePolicy(markdown: string): Block[] {
  const lines = markdown
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\r\n?/g, "\n")
    .split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let items: string[] | null = null;
  const flush = () => {
    if (para.length) blocks.push({ kind: "p", inline: parseInline(para.join(" ")) });
    para = [];
    if (items) blocks.push({ kind: "ul", items: items.map(parseInline) });
    items = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
    } else if (line.startsWith("## ")) {
      flush();
      blocks.push({ kind: "h2", inline: parseInline(line.slice(3).trim()) });
    } else if (line.startsWith("# ")) {
      flush();
      blocks.push({ kind: "h1", inline: parseInline(line.slice(2).trim()) });
    } else if (/^\s*- /.test(line)) {
      if (para.length) flush();
      items = items ?? [];
      items.push(line.replace(/^\s*- /, "").trim());
    } else if (items && items.length && /^\s+/.test(line)) {
      // a list item that runs onto an indented next line
      const last = items.length - 1;
      items[last] = `${items[last] ?? ""} ${line.trim()}`;
    } else {
      if (items) flush();
      para.push(line.trim());
    }
  }
  flush();
  return blocks;
}

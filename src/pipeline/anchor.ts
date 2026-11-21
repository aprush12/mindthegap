import type { Evidence } from "../types.js";
import type { Page } from "./extract-text.js";

export interface DocSection {
  id: string;
  title: string;
  startPage: number;
  endPage: number;
}

export type Anchor =
  | { verified: true; page: number; startOffset: number; endOffset: number; sectionId?: string }
  | { verified: false };

const DASHES = /[‐-―−]/;

/** Per-code-point normalization used for the fallback match: NFKC, straight quotes/dashes, lower case. */
function foldChar(ch: string): string {
  if (ch === "‘" || ch === "’" || ch === "‚" || ch === "‛" || ch === "′") return "'";
  if (ch === "“" || ch === "”" || ch === "„" || ch === "‟" || ch === "″") return '"';
  if (DASHES.test(ch)) return "-";
  if (ch === "­") return ""; // soft hyphen
  return ch.normalize("NFKC").toLowerCase();
}

/** Normalize text and remember, for every normalized char, the raw index it came from. */
function normalizeWithMap(raw: string): { norm: string; map: number[]; rawLen: number[] } {
  let norm = "";
  const map: number[] = [];
  const rawLen: number[] = [];
  let pendingSpace = -1;
  let i = 0;
  for (const ch of raw) {
    const len = ch.length;
    if (/^\s$/u.test(ch) || ch === " ") {
      if (norm.length > 0 && pendingSpace < 0) pendingSpace = i;
    } else {
      const folded = foldChar(ch);
      if (folded.length > 0 && pendingSpace >= 0) {
        norm += " ";
        map.push(pendingSpace);
        rawLen.push(1);
      }
      if (folded.length > 0) pendingSpace = -1;
      for (const f of folded) {
        norm += f;
        map.push(i);
        rawLen.push(len);
      }
    }
    i += len;
  }
  return { norm, map, rawLen };
}

export const normalizeQuote = (q: string): string => normalizeWithMap(q).norm;

function sectionFor(page: number, sections: DocSection[]): string | undefined {
  const hits = sections.filter((s) => s.startPage <= page && page <= s.endPage);
  hits.sort((a, b) => a.endPage - a.startPage - (b.endPage - b.startPage));
  return hits[0]?.id;
}

/** Pages to try in order: claimed page, then ±1, ±2, then the rest of the document. */
function searchOrder(pages: Page[], claimed: number): Page[] {
  const byNum = new Map(pages.map((p) => [p.pageNumber, p]));
  const seen = new Set<number>();
  const out: Page[] = [];
  const add = (n: number) => {
    const p = byNum.get(n);
    if (p && !seen.has(n)) {
      seen.add(n);
      out.push(p);
    }
  };
  for (const d of [0, -1, 1, -2, 2]) add(claimed + d);
  for (const p of pages) add(p.pageNumber);
  return out;
}

export function anchorQuote(
  input: { quote: string; claimedPage: number },
  pages: Page[],
  sections: DocSection[] = [],
): Anchor {
  const quote = input.quote.trim();
  if (!quote) return { verified: false };
  const order = searchOrder(pages, input.claimedPage);
  const hit = (page: Page, start: number, end: number): Anchor => {
    const sectionId = sectionFor(page.pageNumber, sections);
    return { verified: true, page: page.pageNumber, startOffset: start, endOffset: end, ...(sectionId ? { sectionId } : {}) };
  };

  for (const p of order) {
    const idx = p.raw.indexOf(quote);
    if (idx >= 0) return hit(p, idx, idx + quote.length);
  }

  const nq = normalizeQuote(quote);
  if (!nq) return { verified: false };
  for (const p of order) {
    const { norm, map, rawLen } = normalizeWithMap(p.raw);
    const idx = norm.indexOf(nq);
    if (idx < 0) continue;
    const last = idx + nq.length - 1;
    return hit(p, map[idx], map[last] + rawLen[last]);
  }
  return { verified: false };
}

/** Anchor an evidence record; unverified evidence keeps only what the model claimed. */
export function anchorEvidence(ev: Evidence, pages: Page[], sections: DocSection[] = []): Evidence {
  const a = anchorQuote(ev, pages, sections);
  if (!a.verified) return { quote: ev.quote, claimedPage: ev.claimedPage, verified: false };
  return { quote: ev.quote, claimedPage: ev.claimedPage, ...a };
}

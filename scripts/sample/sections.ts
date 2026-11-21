/** Patient-agnostic section renderers shared by the packet generators. */
import { MX, TOP, type Writer } from "./layout.js";

export interface CoverOptions {
  hospitalLine: string;
  facts: [string, string][];
  intro: string;
  /** Rows of the "Documents not included" table; omit when the packet is complete. */
  notIncluded?: [string, string][];
  /** Shown instead of the not-included table when nothing is missing. */
  completeNote?: string;
  footer: string;
}

/** Transmittal page: contents come from the sections already written, so call this last. */
export function coverPage(w: Writer, pageIdx: number, o: CoverOptions) {
  w.page = w.pages[pageIdx];
  w.y = TOP;
  w.page.drawText("REFERRAL PACKET - TRANSMITTAL AND CONTENTS", { x: MX, y: w.y, size: 14, font: w.bold });
  w.y -= 22;
  w.kv(o.facts);
  w.p(o.intro);
  w.h("Contents");
  w.table(["Document", "Page"], w.sections.map((s) => [s.title, String(s.page)]), [420, 60], 9);
  if (o.notIncluded?.length) {
    w.h("Documents not included in this transmission");
    w.table(["Document", "Status"], o.notIncluded, [260, 220], 9);
  } else if (o.completeNote) {
    w.h("Completeness of this transmission");
    w.p(o.completeNote);
  }
  w.p(o.footer, { size: 8.5 });
}

/** Signature / attestation line used at the end of notes. */
export const signed = (w: Writer, who: string, when: string) => w.p(`${who}. Electronically signed ${when}.`, { size: 8.5 });

/** Rows for a generated time-series flowsheet: one row per (day, time) with the cells from `cell`. */
export function timeSeriesRows(days: string[], times: string[], cell: (day: string, time: string, di: number, ti: number) => string[]): string[][] {
  const rows: string[][] = [];
  days.forEach((d, di) => times.forEach((t, ti) => rows.push([d, t, ...cell(d, t, di, ti)])));
  return rows;
}

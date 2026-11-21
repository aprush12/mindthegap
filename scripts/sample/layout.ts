/**
 * Shared layout and rendering for the synthetic referral packet generators (Elena, Harold).
 * Everything patient-specific lives in scripts/sample/<patient>.ts; this module owns the page
 * engine (Writer), the EHR header/footer stamp, and the self-check runner.
 */
import { rgb, PDFDocument, PDFFont, PDFPage, StandardFonts } from "pdf-lib";
import { extractPages } from "../../src/pipeline/extract-text.js";


export const PW = 612, PH = 792, MX = 54, TOP = 716, BOTTOM = 62;
export const CW = PW - 2 * MX;
export const BODY = 11.2, LEAD = 15.4;

export function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Writer {
  pdf!: PDFDocument;
  font!: PDFFont;
  bold!: PDFFont;
  pages: PDFPage[] = [];
  page!: PDFPage;
  y = TOP;
  sections: { title: string; page: number }[] = [];

  static async create() {
    const w = new Writer();
    w.pdf = await PDFDocument.create();
    w.font = await w.pdf.embedFont(StandardFonts.Helvetica);
    w.bold = await w.pdf.embedFont(StandardFonts.HelveticaBold);
    return w;
  }

  newPage() {
    this.page = this.pdf.addPage([PW, PH]);
    this.pages.push(this.page);
    this.y = TOP;
  }

  section(title: string, sub?: string) {
    this.newPage();
    this.sections.push({ title, page: this.pages.length });
    this.page.drawRectangle({ x: MX, y: this.y - 6, width: CW, height: 24, color: rgb(0.88, 0.9, 0.94) });
    this.page.drawText(clean(title.toUpperCase()), { x: MX + 6, y: this.y, size: 13, font: this.bold });
    this.y -= 26;
    if (sub) {
      this.page.drawText(clean(sub), { x: MX, y: this.y, size: 8.5, font: this.font, color: rgb(0.3, 0.3, 0.3) });
      this.y -= 16;
    }
  }

  ensure(h: number) {
    if (this.y - h < BOTTOM) this.newPage();
  }

  wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    const out: string[] = [];
    for (const para of clean(text).split("\n")) {
      let line = "";
      for (const word of para.split(" ")) {
        const t = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(t, size) > width && line) {
          out.push(line);
          line = word;
        } else line = t;
      }
      out.push(line);
    }
    return out;
  }

  h(text: string) {
    this.ensure(34);
    this.y -= 8;
    this.page.drawText(clean(text), { x: MX, y: this.y, size: 10.5, font: this.bold });
    this.y -= 4;
    this.page.drawLine({ start: { x: MX, y: this.y }, end: { x: PW - MX, y: this.y }, thickness: 0.4, color: rgb(0.6, 0.6, 0.6) });
    this.y -= 13;
  }

  /** Paragraph; `keep` moves the whole block to the next page rather than splitting it. */
  p(text: string, opts: { size?: number; bold?: boolean; indent?: number; keep?: boolean } = {}) {
    const size = opts.size ?? BODY;
    const lead = size + 3.7;
    const indent = opts.indent ?? 0;
    const lines = this.wrap(text, opts.bold ? this.bold : this.font, size, CW - indent);
    if (opts.keep) this.ensure(lines.length * lead + 4);
    for (const l of lines) {
      this.ensure(lead);
      this.page.drawText(l, { x: MX + indent, y: this.y, size, font: opts.bold ? this.bold : this.font });
      this.y -= lead;
    }
    this.y -= 3;
  }

  bullets(items: string[]) {
    for (const it of items) {
      const lines = this.wrap(it, this.font, BODY, CW - 14);
      this.ensure(lines.length * LEAD);
      this.page.drawText("-", { x: MX + 3, y: this.y, size: BODY, font: this.font });
      for (const l of lines) {
        this.page.drawText(l, { x: MX + 14, y: this.y, size: BODY, font: this.font });
        this.y -= LEAD;
      }
    }
    this.y -= 3;
  }

  kv(rows: [string, string][], labelW = 150) {
    for (const [k, v] of rows) {
      const lines = this.wrap(v, this.font, BODY, CW - labelW);
      this.ensure(lines.length * LEAD + 2);
      this.page.drawText(clean(k), { x: MX, y: this.y, size: BODY, font: this.bold });
      for (const l of lines) {
        this.page.drawText(l, { x: MX + labelW, y: this.y, size: BODY, font: this.font });
        this.y -= LEAD;
      }
      this.y -= 1;
    }
    this.y -= 4;
  }

  table(headers: string[], rows: string[][], widths: number[], size = 9) {
    const total = widths.reduce((a, b) => a + b, 0);
    const scale = CW / total;
    const ws = widths.map((w) => w * scale);
    const lead = size + 2.6;
    const drawRow = (cells: string[], isHead: boolean) => {
      const wrapped = cells.map((c, i) => this.wrap(c, isHead ? this.bold : this.font, size, ws[i] - 6));
      const hgt = Math.max(...wrapped.map((l) => l.length)) * lead + 5;
      if (this.y - hgt < BOTTOM) {
        this.newPage();
        if (!isHead) drawRow(headers, true);
      }
      const top = this.y + 2;
      if (isHead) this.page.drawRectangle({ x: MX, y: top - hgt, width: CW, height: hgt, color: rgb(0.92, 0.92, 0.92) });
      let x = MX;
      wrapped.forEach((lines, i) => {
        lines.forEach((l, j) => this.page.drawText(l, { x: x + 3, y: top - 9 - j * lead, size, font: isHead ? this.bold : this.font }));
        x += ws[i];
      });
      this.page.drawLine({ start: { x: MX, y: top - hgt }, end: { x: MX + CW, y: top - hgt }, thickness: 0.4, color: rgb(0.7, 0.7, 0.7) });
      this.y = top - hgt - 2;
    };
    this.ensure(40);
    drawRow(headers, true);
    for (const r of rows) drawRow(r, false);
    this.y -= 6;
  }

  gap(n = 6) {
    this.y -= n;
  }
}

/** Helvetica WinAnsi only: refuse anything outside Latin-1 so nothing silently drops from the text layer. */
export function clean(s: string): string {
  for (const ch of s) if (ch.charCodeAt(0) > 255) throw new Error(`non-Latin-1 character in packet text: ${JSON.stringify(ch)} in "${s.slice(0, 50)}"`);
  return s;
}


// ---------------------------------------------------------------- packet spec, stamping, self-check

export interface PacketSpec {
  /** Output path under samples/. */
  out: string;
  hospital: string;
  patientLine: string;
  /** Substrings that must appear on every page (header identity). */
  headerTokens: string[];
  pages: [min: number, max: number];
  /** Fills the document: page 1 is pre-created for the cover, which `build` fills last. */
  build(w: Writer): void;
  forbidden: [string, RegExp][];
  required: [string, RegExp][];
  /** Packet-specific extra assertions. */
  extraChecks?(all: string, ok: (name: string, pass: boolean, detail?: string) => void): void;
}

export async function buildPacket(spec: PacketSpec): Promise<Uint8Array> {
  const w = await Writer.create();
  w.newPage(); // page 1: cover, filled in last once section start pages are known
  spec.build(w);
  const n = w.pages.length;
  w.pages.forEach((pg, i) => {
    pg.drawText(spec.hospital, { x: MX, y: PH - 38, size: 11, font: w.bold });
    pg.drawText("Electronic Health Record - Print", { x: PW - MX - w.font.widthOfTextAtSize("Electronic Health Record - Print", 8.5), y: PH - 37, size: 8.5, font: w.font });
    pg.drawText(clean(spec.patientLine), { x: MX, y: PH - 52, size: 8.5, font: w.font });
    pg.drawLine({ start: { x: MX, y: PH - 58 }, end: { x: PW - MX, y: PH - 58 }, thickness: 0.8, color: rgb(0.2, 0.2, 0.2) });
    pg.drawLine({ start: { x: MX, y: 48 }, end: { x: PW - MX, y: 48 }, thickness: 0.4, color: rgb(0.5, 0.5, 0.5) });
    pg.drawText(`Page ${i + 1} of ${n}`, { x: PW - MX - 60, y: 36, size: 8.5, font: w.font });
    pg.drawText("CONFIDENTIAL - synthetic test data, not a real patient record", { x: MX, y: 36, size: 8, font: w.font });
  });
  return w.pdf.save();
}

export async function selfCheck(bytes: Uint8Array, spec: PacketSpec): Promise<boolean> {
  const pages = await extractPages(bytes);
  const all = pages.map((p) => p.text).join("\n");
  const failures: string[] = [];
  const ok = (name: string, pass: boolean, detail = "") => {
    console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  ${detail}` : ""}`);
    if (!pass) failures.push(name);
  };
  const [lo, hi] = spec.pages;
  ok(`page count ${lo}-${hi}`, pages.length >= lo && pages.length <= hi, `(${pages.length} pages)`);
  ok("header on every page", pages.every((p) => p.text.includes(spec.hospital) && spec.headerTokens.every((t) => p.text.includes(t))));
  ok("page numbers on every page", pages.every((p, i) => p.text.includes(`Page ${i + 1} of ${pages.length}`)));
  for (const [name, re] of spec.forbidden) {
    const m = all.match(re);
    ok(`absent: ${name}`, !m, m ? `found "${m[0]}"` : "");
  }
  spec.extraChecks?.(all, ok);
  for (const [name, re] of spec.required) ok(`present: ${name}`, re.test(all));
  const empty = pages.filter((p) => p.text.length < 220).map((p) => p.pageNumber);
  ok("no near-empty pages", empty.length === 0, empty.length ? `pages ${empty.join(",")}` : "");
  console.log(failures.length ? `\nSELF-CHECK FAILED (${failures.length}): ${failures.join("; ")}` : `\nSELF-CHECK PASSED (${pages.length} pages)`);
  return failures.length === 0;
}

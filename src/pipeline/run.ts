import { randomUUID } from "node:crypto";
import { prioritizeAll, type Priorities } from "../engine/priority.js";
import type { PacketGap } from "../engine/packet-checks.js";
import { screen, type ScreenResult } from "../engine/verdict.js";
import { loadCapacity, loadPolicy, type Policy } from "../policy/index.js";
import type { CapacitySnapshot } from "../policy/schema.js";
import { loadFile, saveFile } from "../store.js";
import type { Evidence, Extraction } from "../types.js";
import { anchorEvidence, type DocSection } from "./anchor.js";
import type { Llm } from "./anthropic.js";
import { buildHeadline, type Headline } from "./headline.js";
import { buildDocumentMap } from "./document-map.js";
import { CATEGORY_LABELS, extractionStepIds, runExtraction, type StepHooks } from "./extraction.js";
import { extractPages, type Page } from "./extract-text.js";

export type ParseStatus = "processing" | "complete" | "failed";

export type StepStatus = "pending" | "running" | "done" | "failed";
export interface ParseStep {
  id: string;
  label: string;
  status: StepStatus;
  /** One plain-language line about what the step found, once done. */
  detail?: string;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
}

/** What the screen has learned so far, filled in step by step while status is "processing". */
export interface PartialFindings {
  pageCount?: number;
  sections?: { title: string; startPage: number; endPage: number }[];
  timing?: Record<string, unknown>;
  patient?: Record<string, unknown>;
  medications?: { name: string; dose?: string; schedule?: string; doseChanges?: { listedDose: string; noteDose: string }[] }[];
  categories?: Record<string, { label: string; answered: number; total: number }>;
}

export interface ParseRecord {
  parseId: string;
  status: ParseStatus;
  createdAt: string;
  completedAt?: string;
  error?: string;
  /** Step-by-step progress, in display order. */
  steps?: ParseStep[];
  partial?: PartialFindings;
  /** Non-fatal problems (a category call that failed); the affected rules are reported as unknown. */
  warnings?: string[];
  arrivalAt?: string;
  /** The `now` the engine evaluated against (arrival if extracted, else wall clock). */
  evaluatedAt?: string;
  pageCount?: number;
  documentMap?: DocSection[];
  extraction?: Extraction;
  medicationEvidence?: Evidence[];
  result?: ScreenResult;
  /** Facility-independent packet-completeness gaps (copy of result.packetGaps for convenience). */
  packetGaps?: PacketGap[];
  /** Ranked "what matters most" candidates per facility (deterministic). */
  priorities?: Priorities;
  /** Top-of-report summary: model-written and grounded in `priorities`, or deterministic fallback. */
  headline?: Headline;
}

export const newParseId = () => randomUUID();

export interface RunOptions {
  parseId: string;
  pdf: Uint8Array;
  llm: Llm;
  policy?: Policy;
  capacity?: CapacitySnapshot;
  /** Wall clock; only used when the record gives no arrival time. */
  clock?: () => Date;
}

/** Anchor every quote in the extraction; returns a new Extraction (inputs untouched). */
export function anchorExtraction(ex: Extraction, pages: Page[], sections: DocSection[]): Extraction {
  const a = (e: Evidence) => anchorEvidence(e, pages, sections);
  const anchorQuotes = (quote: string, page: number) => a({ quote, claimedPage: page });
  return {
    ...ex,
    medications: ex.medications.map((m) =>
      m.doseChanges?.length
        ? {
            ...m,
            doseChanges: m.doseChanges.map((d) => {
              const l = anchorQuotes(d.quoteList, d.pageList);
              const n = anchorQuotes(d.quoteNote, d.pageNote);
              // a verified quote reports the page it was actually found on
              return { ...d, pageList: l.verified ? l.page ?? d.pageList : d.pageList, pageNote: n.verified ? n.page ?? d.pageNote : d.pageNote, verifiedList: l.verified === true, verifiedNote: n.verified === true };
            }),
          }
        : m,
    ),
    ...(ex.monitoringOrders ? { monitoringOrders: { ...ex.monitoringOrders, evidence: ex.monitoringOrders.evidence.map(a) } } : {}),
    answers: ex.answers.map((ans) => ({
      ...ans,
      evidence: ans.evidence.map(a),
      contradictions: ans.contradictions.map((c) => {
        const x = a({ quote: c.quoteA, claimedPage: c.pageA });
        const y = a({ quote: c.quoteB, claimedPage: c.pageB });
        return { ...c, verifiedA: x.verified === true, verifiedB: y.verified === true };
      }),
    })),
  };
}

export async function createRecord(parseId: string): Promise<ParseRecord> {
  const rec: ParseRecord = { parseId, status: "processing", createdAt: new Date().toISOString() };
  await saveFile(parseId, "result.json", rec);
  return rec;
}

const STEP_LABELS: Record<string, string> = {
  pages: "Reading the PDF",
  "document-map": "Mapping the packet's sections",
  facts: "Patient facts, timing and signed orders",
  medications: "Discharge medications and dose check",
  ...Object.fromEntries(Object.entries(CATEGORY_LABELS).map(([k, v]) => [`category-${k}`, v])),
  score: "Checking each facility's rules",
  headline: "Writing the summary",
};

/**
 * Holds the live record and writes it after every change. Writes are chained so they land in order
 * and a poll never reads a half-written older state over a newer one.
 */
class Progress {
  private chain: Promise<void> = Promise.resolve();
  private closed = false;
  constructor(public rec: ParseRecord) {}
  /** Final write; calls still in flight after this (siblings of a failed call) no longer touch the file. */
  finish(rec: ParseRecord): Promise<void> {
    this.rec = rec;
    const v = this.save();
    this.closed = true;
    return v;
  }
  save(): Promise<void> {
    if (this.closed) return this.chain;
    const snapshot = structuredClone(this.rec);
    this.chain = this.chain.then(() => saveFile(this.rec.parseId, "result.json", snapshot)).catch(() => {});
    return this.chain;
  }
  private step(id: string) {
    return this.rec.steps!.find((s) => s.id === id)!;
  }
  start(id: string) {
    Object.assign(this.step(id), { status: "running", startedAt: new Date().toISOString() });
    void this.save();
  }
  done(id: string, detail?: string) {
    Object.assign(this.step(id), { status: "done", finishedAt: new Date().toISOString(), ...(detail ? { detail } : {}) });
    void this.save();
  }
  fail(id: string, error: string) {
    Object.assign(this.step(id), { status: "failed", finishedAt: new Date().toISOString(), error });
    void this.save();
  }
  /** Runs fn as step `id`; marks it failed and rethrows on error. */
  async run<T>(id: string, fn: () => Promise<T>, detail?: (v: T) => string): Promise<T> {
    this.start(id);
    try {
      const v = await fn();
      this.done(id, detail?.(v));
      return v;
    } catch (e) {
      this.fail(id, e instanceof Error ? e.message : String(e));
      throw e;
    }
  }
}

/** Runs the whole pipeline; never throws - failures are persisted as status "failed". */
export async function runPipeline(opts: RunOptions): Promise<ParseRecord> {
  const { parseId, pdf, llm } = opts;
  const policy = opts.policy ?? loadPolicy();
  const capacity = opts.capacity ?? loadCapacity();
  const clock = opts.clock ?? (() => new Date());
  const rec = (await loadFile<ParseRecord>(parseId, "result.json")) ?? (await createRecord(parseId));
  const ids = ["pages", "document-map", ...extractionStepIds(policy.rules), "score", "headline"];
  const p = new Progress({ ...rec, steps: ids.map((id) => ({ id, label: STEP_LABELS[id] ?? id, status: "pending" })), partial: {}, warnings: [] });
  await p.save();
  const partial = p.rec.partial!;
  try {
    const pages = await p.run("pages", async () => {
      const pages = await extractPages(pdf);
      await saveFile(parseId, "pages.json", pages);
      if (pages.length === 0) throw new Error("PDF has no pages");
      partial.pageCount = pages.length;
      return pages;
    }, (pg) => `${pg.length} pages`);

    const pdfBase64 = Buffer.from(pdf).toString("base64");
    // Runs alone first: it is quick and writes the prompt cache every later call reads.
    // Section labels are a nicety, so a failure here does not stop the screen.
    const documentMap = await p.run("document-map", () => buildDocumentMap(llm, pdfBase64, pages.length), (s) => `${s.length} sections`)
      .catch((e: unknown) => {
        p.rec.warnings!.push(`Couldn't map the packet's sections (${e instanceof Error ? e.message : String(e)}); evidence is shown without section names.`);
        return [];
      });
    partial.sections = documentMap.map((s) => ({ title: s.title, startPage: s.startPage, endPage: s.endPage }));
    await p.save();

    const hooks: StepHooks = {
      start: (id) => p.start(id),
      fail: (id, err) => p.fail(id, err),
      done: (id, { detail, data }) => {
        if (id === "facts") Object.assign(partial, data);
        else if (id === "medications") Object.assign(partial, data);
        else if (id.startsWith("category-") && data) {
          const cat = id.slice("category-".length) as keyof typeof CATEGORY_LABELS;
          partial.categories = { ...partial.categories, [cat]: { label: CATEGORY_LABELS[cat], answered: Number(data.answered), total: Number(data.total) } };
        }
        p.done(id, detail);
      },
    };
    const { extraction, medicationEvidence, failedCategories } = await runExtraction(llm, pdfBase64, policy.rules, undefined, hooks);
    for (const cat of failedCategories) {
      p.rec.warnings!.push(`Couldn't read "${CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat}" from the packet; those rules are marked unknown. Re-run to try again.`);
    }

    const { anchored, now, result, priorities } = await p.run("score", async () => {
      const anchored = anchorExtraction(extraction, pages, documentMap);
      const arrival = anchored.timing.arrivalAt ? new Date(anchored.timing.arrivalAt) : undefined;
      const now = arrival && !Number.isNaN(arrival.getTime()) ? arrival : clock();
      const result = screen(anchored, policy, capacity, now);
      return { anchored, now, result, priorities: prioritizeAll(result, anchored, now) };
    });
    const headline = await p.run("headline", () => buildHeadline(llm, anchored, result, now, priorities), (h) => (h.source === "model" ? "" : "used the built-in summary")); // never throws

    const done: ParseRecord = {
      ...p.rec,
      status: "complete",
      completedAt: new Date().toISOString(),
      ...(anchored.timing.arrivalAt ? { arrivalAt: anchored.timing.arrivalAt } : {}),
      evaluatedAt: now.toISOString(),
      pageCount: pages.length,
      documentMap,
      extraction: anchored,
      medicationEvidence: medicationEvidence.map((e) => anchorEvidence(e, pages, documentMap)),
      result,
      packetGaps: result.packetGaps,
      priorities,
      headline,
    };
    await p.finish(done);
    return done;
  } catch (e) {
    // steps still waiting will not run now
    for (const s of p.rec.steps ?? []) if (s.status === "running") s.status = "pending";
    const failed: ParseRecord = { ...p.rec, status: "failed", completedAt: new Date().toISOString(), error: e instanceof Error ? e.message : String(e) };
    await p.finish(failed);
    return failed;
  }
}

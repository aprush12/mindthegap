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
import { runExtraction } from "./extraction.js";
import { extractPages, type Page } from "./extract-text.js";

export type ParseStatus = "processing" | "complete" | "failed";

export interface ParseRecord {
  parseId: string;
  status: ParseStatus;
  createdAt: string;
  completedAt?: string;
  error?: string;
  /** "live": extracted by the model. "fixture": the offline demo path (golden test fixture, no model). */
  source?: "live" | "fixture";
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

/** Runs the whole pipeline; never throws - failures are persisted as status "failed". */
export async function runPipeline(opts: RunOptions): Promise<ParseRecord> {
  const { parseId, pdf, llm } = opts;
  const policy = opts.policy ?? loadPolicy();
  const capacity = opts.capacity ?? loadCapacity();
  const clock = opts.clock ?? (() => new Date());
  const rec = (await loadFile<ParseRecord>(parseId, "result.json")) ?? (await createRecord(parseId));
  try {
    const pages = await extractPages(pdf);
    await saveFile(parseId, "pages.json", pages);
    if (pages.length === 0) throw new Error("PDF has no pages");

    const pdfBase64 = Buffer.from(pdf).toString("base64");
    const documentMap = await buildDocumentMap(llm, pdfBase64, pages.length);
    const { extraction, medicationEvidence } = await runExtraction(llm, pdfBase64, policy.rules);

    const anchored = anchorExtraction(extraction, pages, documentMap);
    const arrival = anchored.timing.arrivalAt ? new Date(anchored.timing.arrivalAt) : undefined;
    const now = arrival && !Number.isNaN(arrival.getTime()) ? arrival : clock();
    const result = screen(anchored, policy, capacity, now);
    const priorities = prioritizeAll(result, anchored, now);
    const headline = await buildHeadline(llm, anchored, result, now, priorities); // never throws

    const done: ParseRecord = {
      ...rec,
      status: "complete",
      source: "live",
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
    await saveFile(parseId, "result.json", done);
    return done;
  } catch (e) {
    const failed: ParseRecord = { ...rec, status: "failed", completedAt: new Date().toISOString(), error: e instanceof Error ? e.message : String(e) };
    await saveFile(parseId, "result.json", failed);
    return failed;
  }
}

import { z } from "zod";
import { prioritizeAll, type PriorityCandidate, type PrioritySeverity, type Priorities } from "../engine/priority.js";
import type { FacilityResult, ScreenResult } from "../engine/verdict.js";
import { FACILITY_IDS, type FacilityId } from "../policy/schema.js";
import type { Extraction } from "../types.js";
import type { Llm } from "./anthropic.js";

export const MAX_PRIORITIES = 6;
export const DIGEST_CANDIDATES = 10;

const SeveritySchema = z.enum(["tonight", "block", "capability", "clock"]);
const PrioritySchema = z.object({
  text: z.string(),
  ruleIds: z.array(z.string()),
  dueBy: z.string().optional(),
  severity: SeveritySchema,
});
const FacilityHeadlineSchema = z.object({ headline: z.string(), topPriorities: z.array(PrioritySchema) });
/** Structured-output schema for the one headline call. */
export const HeadlineOutputSchema = z.object({
  patientSnapshot: z.string(),
  perFacility: z.object({ A: FacilityHeadlineSchema, B: FacilityHeadlineSchema, C: FacilityHeadlineSchema }),
});
export type HeadlineOutput = z.infer<typeof HeadlineOutputSchema>;

export interface TopPriority {
  text: string;
  ruleIds: string[];
  dueBy?: string;
  severity: PrioritySeverity;
  /** Deterministic question for the hospital, copied from the first cited candidate; never written by the model. */
  followUpAsk?: string;
}
export interface Headline {
  /** "model": the model wrote the text (ungrounded entries dropped). "deterministic": built from the candidates. */
  source: "model" | "deterministic";
  /** Model entries removed because they cited a rule id that was not among the candidates sent. */
  droppedUngrounded: number;
  patientSnapshot: string;
  perFacility: Record<FacilityId, { headline: string; topPriorities: TopPriority[] }>;
}

const ts = (iso?: string) => (iso ? new Date(iso).getTime() : Number.POSITIVE_INFINITY);

/** Compact, PHI-minimal digest: the only thing the model sees. */
export function buildDigest(extraction: Extraction, result: ScreenResult, priorities: Priorities) {
  return {
    patient: { ...extraction.patient, arrivalAt: extraction.timing.arrivalAt, dischargeAt: extraction.timing.dischargeAt },
    medications: extraction.medications.map((m) => ({ name: m.name, route: m.route, schedule: m.schedule, firstDoseDue: m.firstDoseDue })),
    facilities: Object.fromEntries(
      FACILITY_IDS.map((id) => {
        const f = result.facilities[id];
        return [id, {
          verdict: f.verdict, blockingCount: f.blocking.length, onAClockCount: f.conditional.length, firstDoseAtRisk: f.firstDoseAtRisk, beds: f.beds,
          candidates: priorities[id].slice(0, DIGEST_CANDIDATES).map((c) => ({ id: c.id, severity: c.severity, dueBy: c.dueBy, question: c.question, text: c.text, evidence: c.evidence })),
        }];
      }),
    ),
  };
}

const SYSTEM = `You write the "what matters most" summary at the top of a skilled nursing facility admissions screen. You receive a JSON digest of one referral: patient facts, medications, and for each of three facilities (A, B, C) a verdict and a ranked list of candidate issues, each with an id, question and evidence quotes.
Rules:
- Plain language for an admissions nurse who will glance at this for ten seconds. Each text is ONE line under 100 characters. Never write clock times, dates or ISO timestamps (due times are added separately).
- Plain language for an admissions nurse. Use only facts present in the digest; add no new clinical claims, doses or recommendations.
- Do not soften blocks: a blocking or capability issue is stated as blocking.
- patientSnapshot: ONE short line (for example "71.4 kg, insulin-dependent, 7 discharge medications, wound care needed") on who this patient is and the care they need (for example insulin management, wound care, anticoagulation, heart failure regimen), drawn only from the digest.
- For each facility: headline is one sentence giving the verdict and why. topPriorities has 3 to 6 items, most important first. Each text is imperative and nurse-facing, for example "Obtain the insulin correction scale before the first meal, referenced in the MAR but never received".
- Every topPriorities item must list in ruleIds the candidate ids (exactly as given) it is based on. Never invent ids. Copy dueBy from the cited candidate when it has one. severity is one of tonight, block, capability, clock and should match the cited candidate.`;

/** Drop model entries citing ids outside the candidates sent for that facility. */
export function validateHeadline(out: HeadlineOutput, sent: Priorities): { headline: Headline; dropped: number } {
  let dropped = 0;
  const perFacility = {} as Headline["perFacility"];
  for (const id of FACILITY_IDS) {
    const byId = new Map(sent[id].slice(0, DIGEST_CANDIDATES).map((c) => [c.id, c]));
    const kept: TopPriority[] = [];
    for (const p of out.perFacility[id].topPriorities) {
      const cited = p.ruleIds.map((r) => byId.get(r));
      if (p.ruleIds.length === 0 || cited.some((c) => !c)) { dropped++; continue; }
      // dueBy comes from the cited candidates, never from the model's own arithmetic
      const due = cited.map((c) => c!.dueBy).filter((d): d is string => !!d).sort((a, b) => ts(a) - ts(b))[0];
      const ask = cited.find((c) => c!.followUpAsk)?.followUpAsk;
      kept.push({ text: p.text.trim(), ruleIds: p.ruleIds, severity: p.severity, ...(due ? { dueBy: due } : {}), ...(ask ? { followUpAsk: ask } : {}) });
    }
    // a dose conflict must never be dropped by the model: re-add any MEDREC candidate no kept entry cites
    const missing = sent[id].filter((c) => c.id.startsWith("MEDREC:") && !kept.some((k) => k.ruleIds.includes(c.id)));
    if (missing.length) kept.unshift(...deterministicPriorities(missing));
    perFacility[id] = { headline: out.perFacility[id].headline.trim(), topPriorities: kept.slice(0, MAX_PRIORITIES) };
  }
  return { headline: { source: "model", droppedUngrounded: dropped, patientSnapshot: out.patientSnapshot.trim(), perFacility }, dropped };
}

export function deterministicPriorities(cands: PriorityCandidate[]): TopPriority[] {
  return cands.slice(0, MAX_PRIORITIES).map((c) => ({ text: c.text, ruleIds: [c.id], severity: c.severity, ...(c.dueBy ? { dueBy: c.dueBy } : {}), ...(c.followUpAsk ? { followUpAsk: c.followUpAsk } : {}) }));
}

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "71.4 kg, insulin-dependent, 7 discharge medications, wound care needed, referred for complex medical" */
function deterministicSnapshot(ex: Extraction): string {
  const p = ex.patient;
  const answered = (id: string) => ex.answers.find((a) => a.ruleId === id && a.answered)?.value as { present?: boolean } | undefined;
  const bits = [
    p.weightKg !== undefined ? `${p.weightKg} kg` : undefined,
    p.insulinRequired && "insulin-dependent",
    p.tubeFed && "tube-fed",
    p.ventDependent && "ventilator-dependent",
    p.trach && "trach care",
    p.dialysis && "dialysis",
    p.elopementRisk && "elopement risk",
    ex.medications.length ? count(ex.medications.length, "discharge medication") : undefined,
    answered("SKN-01")?.present === true ? "wound care needed" : undefined,
    p.targetUnit ? `referred for ${String(p.targetUnit).replaceAll("_", " ")}` : undefined,
  ].filter(Boolean);
  return bits.length ? bits.join(", ") : "Referred patient (no details extracted)";
}

function verdictHeadline(f: FacilityResult, cands: PriorityCandidate[]): string {
  const tonight = cands.filter((c) => c.severity === "tonight").length;
  const cap = cands.filter((c) => c.severity === "capability").length;
  const preArrival = f.blocking.filter((i) => i.preArrival).length;
  switch (f.verdict) {
    case "accept": return "Can take this patient: nothing outstanding.";
    case "conditional_accept": {
      const nowItems = tonight ? `${tonight} ${tonight === 1 ? "item" : "items"} needed tonight` : "";
      const blockers = f.blocking.length ? `${count(f.blocking.length, "blocker")} to clear` : `${count(f.conditional.length, "item")} to resolve`;
      return `Can take this patient with conditions: ${blockers}${nowItems ? `, ${nowItems}` : ""}.`;
    }
    case "blocked": return `Not yet: ${count(preArrival || f.blocking.length, "item")} must be cleared before the patient travels.`;
    case "decline": return `Can't take this patient here: ${count(cap || 1, "thing")} this facility can't do.`;
  }
}

export function deterministicHeadline(ex: Extraction, result: ScreenResult, priorities: Priorities, droppedUngrounded = 0): Headline {
  const perFacility = {} as Headline["perFacility"];
  for (const id of FACILITY_IDS) {
    perFacility[id] = { headline: verdictHeadline(result.facilities[id], priorities[id]), topPriorities: deterministicPriorities(priorities[id]) };
  }
  return { source: "deterministic", droppedUngrounded, patientSnapshot: deterministicSnapshot(ex), perFacility };
}

/**
 * One structured-output call (no PDF). Never throws: any failure, an unusable reply, or a missing key
 * yields the deterministic headline with source "deterministic".
 */
export async function buildHeadline(llm: Llm | undefined, ex: Extraction, result: ScreenResult, now: Date, priorities = prioritizeAll(result, ex, now)): Promise<Headline> {
  try {
    if (!llm) return deterministicHeadline(ex, result, priorities);
    const out = await llm.parse({
      system: SYSTEM,
      instruction: `Digest (JSON):\n${JSON.stringify(buildDigest(ex, result, priorities))}`,
      schema: HeadlineOutputSchema,
      label: "headline",
      maxTokens: 4000,
    });
    const { headline } = validateHeadline(HeadlineOutputSchema.parse(out), priorities);
    // a facility with nothing grounded left, or an empty sentence, falls back to the deterministic text for that facility
    const det = deterministicHeadline(ex, result, priorities);
    for (const id of FACILITY_IDS) {
      if (headline.perFacility[id].topPriorities.length === 0) headline.perFacility[id].topPriorities = det.perFacility[id].topPriorities;
      if (!headline.perFacility[id].headline) headline.perFacility[id].headline = det.perFacility[id].headline;
    }
    if (!headline.patientSnapshot) headline.patientSnapshot = det.patientSnapshot;
    return headline;
  } catch {
    return deterministicHeadline(ex, result, priorities);
  }
}

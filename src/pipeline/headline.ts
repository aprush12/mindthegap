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
  /** Verbatim packet quotes behind the item, copied from the cited candidates (never from the model). */
  evidence?: { quote: string; page?: number }[];
}

const MAX_QUOTES = 3;
function quotesOf(cands: PriorityCandidate[]): { quote: string; page?: number }[] {
  const seen = new Set<string>();
  const out: { quote: string; page?: number }[] = [];
  for (const c of cands) for (const e of c.evidence) {
    if (!e.quote || seen.has(e.quote)) continue;
    seen.add(e.quote);
    out.push(e);
  }
  return out.slice(0, MAX_QUOTES);
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

const SYSTEM = `You write the top of a results page for a hospital discharge coordinator who has to decide, tonight, which skilled nursing facility can safely take a patient. You receive a JSON digest of one referral: patient facts, medications, and for each of three facilities (A, B, C) a verdict and a ranked list of candidate issues, each with an id, question, short text and evidence quotes.

Voice: warm, plain English that a tired coordinator understands in five seconds. Short words, short sentences, active voice. Write the way a helpful senior nurse would say it out loud, not the way a form or a regulation reads.
- No jargon or abbreviations when an everyday word exists. If a term has no plain substitute, add a two-to-four-word gloss the first time, e.g. "PASRR (mental health screen)", "MDRO (drug-resistant infection)".
- Never mention rule ids, "candidates", "the digest", "criteria", "checklist" or "the model".
- Never write clock times, dates or timestamps; due times are shown separately.
- Use only facts present in the digest. Add no new clinical claims, doses or recommendations.
- Do not soften a block: if a facility cannot take the patient or something must be fixed first, say so plainly.

Fields:
- patientSnapshot: 3 to 6 short facts about who this patient is and the care they need, separated by commas, most important first, each 2 to 5 words, sentence case. Example: "Heart failure, Insulin every night, Pressure sore needing daily care, 11 medications, 71.4 kg".
- headline (per facility): ONE sentence under 20 words that says why the verdict is what it is. The verdict itself is shown in big type above it, so don't restate it. Examples: "Beds are open, but three things need sorting out before tonight's insulin." / "It can't give insulin overnight, so it can't safely take her."
- topPriorities (per facility): 3 to 6 items, most urgent first. Each text is under 70 characters, starts with a verb, and says what to do and why in everyday words. Example: "Get the insulin scale the hospital forgot to attach". Bad: "Obtain ACU-06 correction scale per MAR".
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
      const quotes = quotesOf(cited as PriorityCandidate[]);
      kept.push({ text: p.text.trim(), ruleIds: p.ruleIds, severity: p.severity, ...(due ? { dueBy: due } : {}), ...(ask ? { followUpAsk: ask } : {}), ...(quotes.length ? { evidence: quotes } : {}) });
    }
    // a dose conflict must never be dropped by the model: re-add any MEDREC candidate no kept entry cites
    const missing = sent[id].filter((c) => c.id.startsWith("MEDREC:") && !kept.some((k) => k.ruleIds.includes(c.id)));
    if (missing.length) kept.unshift(...deterministicPriorities(missing));
    perFacility[id] = { headline: out.perFacility[id].headline.trim(), topPriorities: kept.slice(0, MAX_PRIORITIES) };
  }
  return { headline: { source: "model", droppedUngrounded: dropped, patientSnapshot: out.patientSnapshot.trim(), perFacility }, dropped };
}

export function deterministicPriorities(cands: PriorityCandidate[]): TopPriority[] {
  return cands.slice(0, MAX_PRIORITIES).map((c) => {
    const quotes = quotesOf([c]);
    return { text: c.text, ruleIds: [c.id], severity: c.severity, ...(c.dueBy ? { dueBy: c.dueBy } : {}), ...(c.followUpAsk ? { followUpAsk: c.followUpAsk } : {}), ...(quotes.length ? { evidence: quotes } : {}) };
  });
}

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "Heart failure, Insulin-dependent, Wound care needed, 7 discharge medications, 71.4 kg, Referred for complex medical care" */
function deterministicSnapshot(ex: Extraction): string {
  const p = ex.patient;
  const answered = (id: string) => ex.answers.find((a) => a.ruleId === id && a.answered)?.value as { present?: boolean } | undefined;
  const bits = [
    p.diagnoses?.heartFailure && "Heart failure",
    p.ventDependent && "On a ventilator",
    p.trach && "Has a tracheostomy",
    p.dialysis && "Needs dialysis",
    p.insulinRequired && "Insulin-dependent",
    p.tubeFed && "Tube-fed",
    answered("SKN-01")?.present === true ? "Wound care needed" : undefined,
    p.elopementRisk && "Wandering risk",
    ex.medications.length ? count(ex.medications.length, "discharge medication") : undefined,
    p.weightKg !== undefined ? `${p.weightKg} kg` : undefined,
    p.targetUnit ? `Referred for ${String(p.targetUnit).replaceAll("_", " ")} care` : undefined,
  ].filter(Boolean);
  return bits.length ? bits.join(", ") : "Referred patient (no details extracted)";
}

function verdictHeadline(f: FacilityResult, cands: PriorityCandidate[]): string {
  const tonight = cands.filter((c) => c.severity === "tonight").length;
  const cap = cands.filter((c) => c.severity === "capability").length;
  const preArrival = f.blocking.filter((i) => i.preArrival).length;
  switch (f.verdict) {
    case "accept": return "Nothing is outstanding, so this facility can take the patient.";
    case "conditional_accept": {
      const n = f.blocking.length || f.conditional.length;
      const urgent = tonight ? ` ${tonight === 1 ? "One thing needs" : `${tonight} things need`} doing in the next few hours.` : "";
      return `It can take the patient once ${count(n, "thing")} ${n === 1 ? "is" : "are"} sorted out.${urgent}`;
    }
    case "blocked": {
      const n = f.blocking.length, pre = preArrival || n;
      if (n === 1) return "1 thing to fix, and it has to happen before the patient can travel.";
      return `${n} things to fix, ${pre === n ? "all of them" : `${pre} of them`} before the patient can travel.`;
    }
    case "decline": return `It can't meet ${cap > 1 ? `${cap} of the patient's needs` : "one of the patient's needs"}, so it can't safely take them.`;
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

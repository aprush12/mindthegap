import { z } from "zod";
import { prioritizeAll, type PriorityCandidate, type PrioritySeverity, type Priorities } from "../engine/priority.js";
import type { ScreenResult, Verdict } from "../engine/verdict.js";
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
}
export interface Headline {
  /** "model": the model wrote the text (ungrounded entries dropped). "deterministic": built from the candidates. */
  source: "model" | "deterministic";
  /** Model entries removed because they cited a rule id that was not among the candidates sent. */
  droppedUngrounded: number;
  patientSnapshot: string;
  perFacility: Record<FacilityId, { headline: string; topPriorities: TopPriority[] }>;
}

const VERDICT_PLAIN: Record<Verdict, string> = { accept: "Accept", conditional_accept: "Conditional accept", blocked: "Blocked", decline: "Decline" };
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
- Plain language for an admissions nurse. Use only facts present in the digest; add no new clinical claims, doses or recommendations.
- Do not soften blocks: a blocking or capability issue is stated as blocking.
- patientSnapshot: 2 to 3 sentences on who this patient is clinically and the care they need (for example insulin management, wound care, anticoagulation, heart failure regimen), drawn only from the digest.
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
      kept.push({ text: p.text.trim(), ruleIds: p.ruleIds, severity: p.severity, ...(due ? { dueBy: due } : {}) });
    }
    perFacility[id] = { headline: out.perFacility[id].headline.trim(), topPriorities: kept.slice(0, MAX_PRIORITIES) };
  }
  return { headline: { source: "model", droppedUngrounded: dropped, patientSnapshot: out.patientSnapshot.trim(), perFacility }, dropped };
}

const lead: Record<PrioritySeverity, string> = { tonight: "Tonight: ", block: "Blocker: ", capability: "Facility cannot provide: ", clock: "Resolve: " };

export function deterministicPriorities(cands: PriorityCandidate[]): TopPriority[] {
  return cands.slice(0, MAX_PRIORITIES).map((c) => ({ text: `${lead[c.severity]}${c.text}`, ruleIds: [c.id], severity: c.severity, ...(c.dueBy ? { dueBy: c.dueBy } : {}) }));
}

function deterministicSnapshot(ex: Extraction): string {
  const p = ex.patient;
  const needs = [
    p.insulinRequired && "insulin",
    p.tubeFed && "tube feeding",
    p.ventDependent && "ventilator support",
    p.trach && "tracheostomy care",
    p.dialysis && "dialysis",
  ].filter(Boolean) as string[];
  const bits = [
    `${ex.medications.length} discharge medication(s)`,
    needs.length ? `needs ${needs.join(", ")}` : undefined,
    p.weightKg !== undefined ? `${p.weightKg} kg` : undefined,
    p.targetUnit ? `referred for ${String(p.targetUnit).replaceAll("_", " ")}` : undefined,
  ].filter(Boolean);
  return `Referred patient: ${bits.join("; ")}.`;
}

export function deterministicHeadline(ex: Extraction, result: ScreenResult, priorities: Priorities, droppedUngrounded = 0): Headline {
  const perFacility = {} as Headline["perFacility"];
  for (const id of FACILITY_IDS) {
    const f = result.facilities[id];
    const top = priorities[id][0];
    perFacility[id] = {
      headline: `${VERDICT_PLAIN[f.verdict]}: ${f.blocking.length} blocking item(s), ${f.conditional.length} on a clock${top ? `; first issue: ${top.text}` : ""}.`,
      topPriorities: deterministicPriorities(priorities[id]),
    };
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

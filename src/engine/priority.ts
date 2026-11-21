import type { FacilityId } from "../policy/schema.js";
import { FACILITY_IDS } from "../policy/schema.js";
import type { Extraction } from "../types.js";
import type { Item, RuleState } from "./evaluate.js";
import type { FacilityResult, ScreenResult } from "./verdict.js";
import type { MedReport } from "./formulary.js";
import { buildMedRec } from "./medrec.js";
import { itemPhrase, medFollowUp, medLine } from "./phrase.js";

export type PrioritySeverity = "tonight" | "block" | "capability" | "clock";

export interface PriorityCandidate {
  /** Rule id (PAY-01), or a synthetic id: CAP-BEDS, FORMULARY:<agent>, MEDREC:<agent>. */
  id: string;
  /** One-line plain-language action phrase (no timestamps), built from item data only. */
  text: string;
  severity: PrioritySeverity;
  /** 1 = tonight, 2 = pre-arrival block, 3 = capability block, 4 = other block, 5 = on a clock, 6 = contradiction, 7 = review. */
  tier: number;
  dueBy?: string;
  question?: string;
  state?: RuleState;
  evidence: { quote: string; page?: number }[];
  /** One-sentence question for the discharging hospital (deterministic; the model headline never rewrites it). */
  followUpAsk?: string;
}

/** A conditional item or first dose due within this many hours of `now` counts as "tonight". */
export const TONIGHT_HOURS = 12;

const t = (iso?: string) => (iso ? new Date(iso).getTime() : Number.POSITIVE_INFINITY);
/** Earliest of the given timestamps, normalised to UTC ISO (extraction times may carry no zone). */
const earliest = (...xs: (string | undefined)[]) => {
  const v = xs.filter((x): x is string => !!x && !Number.isNaN(t(x))).sort((a, b) => t(a) - t(b));
  return v[0] ? new Date(v[0]).toISOString() : undefined;
};

interface Ctx { report: MedReport[]; arrival: Date }

function fromItem(it: Item, tier: number, severity: PrioritySeverity, cx: Ctx, dueBy?: string): PriorityCandidate {
  const c: PriorityCandidate = {
    id: it.ruleId, text: itemPhrase(it, cx.report, cx.arrival, severity === "capability"), severity, tier, question: it.question, state: it.state,
    evidence: it.evidence.slice(0, 2).map((e) => ({ quote: e.quote, ...(e.page !== undefined ? { page: e.page } : {}) })),
  };
  if (dueBy) c.dueBy = dueBy;
  if (it.followUpAsk) c.followUpAsk = it.followUpAsk;
  return c;
}

const byDue = (a: PriorityCandidate, b: PriorityCandidate) => t(a.dueBy) - t(b.dueBy);

/** Rule items whose issue is about specific medications (RX-01 not on formulary, RX-03 PA, RX-05 interchange). */
const MED_RULE_STATUS: Record<string, string[]> = { "RX-01": ["nf", "not_stocked", "not_accepted"], "RX-03": ["pa"], "RX-05": ["interchange"] };

/**
 * Deterministic "what matters most" ranking for one facility. Pure; `now` is the evaluation clock.
 * Each rule appears once, at its first matching tier. When the facility verdict is "decline", capability
 * blocks lead (nothing else matters if the facility cannot take the patient).
 */
export function prioritize(f: FacilityResult, extraction: Extraction, now: Date): PriorityCandidate[] {
  const horizon = now.getTime() + TONIGHT_HOURS * 3_600_000;
  const all = [...f.blocking, ...f.conditional, ...f.review];
  const cx: Ctx = { report: f.formularyReport, arrival: extraction.timing.arrivalAt ? new Date(extraction.timing.arrivalAt) : now };
  const seen = new Set<string>();
  const out: PriorityCandidate[] = [];
  const push = (c: PriorityCandidate) => { if (!seen.has(c.id)) { seen.add(c.id); out.push(c); } };
  const firstDose = (med: string) => extraction.medications.find((m) => m.name === med)?.firstDoseDue;

  // earliest first dose of the meds a medication rule is about (the clock that actually bites)
  const medDue = (it: Item): string | undefined => {
    const st = MED_RULE_STATUS[it.ruleId];
    if (!st) return undefined;
    return earliest(...f.formularyReport.filter((r) => r.firstDoseAtRisk && st.includes(r.status)).map((r) => firstDose(r.med)));
  };
  const isBlock = (i: Item) => i.decision === "block";
  const capability = (i: Item) => isBlock(i) && i.resolvable === "capability";

  const capBlocks = f.blocking.filter(capability).map((i) => fromItem(i, 3, "capability", cx));
  if (f.verdict === "decline") capBlocks.forEach(push);

  // tier 1: tonight
  const tonight: PriorityCandidate[] = [];
  for (const i of f.conditional) {
    const due = earliest(i.resolveBy, medDue(i));
    if (due && t(due) <= horizon) tonight.push(fromItem(i, 1, "tonight", cx, due));
  }
  const tonightIds = new Set(tonight.map((c) => c.id));
  for (const r of f.formularyReport) {
    if (!r.firstDoseAtRisk || r.status === "formulary" || r.status === "unmatched") continue;
    const due = earliest(firstDose(r.med));
    if (!due || t(due) > horizon) continue;
    const rule = Object.entries(MED_RULE_STATUS).find(([, s]) => s.includes(r.status))?.[0];
    if (rule && (tonightIds.has(rule) || f.blocking.some((i) => i.ruleId === rule))) continue; // already covered
    tonight.push({ id: `FORMULARY:${r.agent ?? r.med}`, text: medLine(r), severity: "tonight", tier: 1, dueBy: due, question: "Can this medication's first dose be given on time?", evidence: [], followUpAsk: medFollowUp(r) });
  }
  // dose conflicts between the discharge list and the final days' notes: facility-independent confirm-items,
  // always tier 1 (a wrong dose is given at the first dose), never a rule failure and never a verdict input
  for (const m of buildMedRec(extraction)) {
    tonight.push({
      id: m.id, text: m.text, severity: "tonight", tier: 1, ...(m.dueBy ? { dueBy: m.dueBy } : {}),
      question: "Do the discharge list and the latest notes agree on this dose?", evidence: m.evidence, followUpAsk: m.followUpAsk,
    });
  }
  tonight.sort(byDue).forEach(push);

  // tiers 2-4: blocks
  f.blocking.filter((i) => i.preArrival).map((i) => fromItem(i, 2, "block", cx)).forEach(push);
  capBlocks.forEach(push);
  f.blocking.map((i) => fromItem(i, 4, "block", cx)).forEach(push);

  // tier 5: remaining conditionals, soonest resolveBy first
  f.conditional.map((i) => fromItem(i, 5, "clock", cx, i.resolveBy)).sort(byDue).forEach(push);

  // tier 6-7: contradictions needing reconciliation, then review items
  all.filter((i) => i.state === "contradictory" && !seen.has(i.ruleId)).map((i) => fromItem(i, 6, "clock", cx)).forEach(push);
  f.review.map((i) => fromItem(i, 7, "clock", cx)).forEach(push);

  return out;
}

export type Priorities = Record<FacilityId, PriorityCandidate[]>;

export function prioritizeAll(result: ScreenResult, extraction: Extraction, now: Date): Priorities {
  const p = {} as Priorities;
  for (const id of FACILITY_IDS) p[id] = prioritize(result.facilities[id], extraction, now);
  return p;
}

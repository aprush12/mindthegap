import type { Policy } from "../policy/index.js";
import { CRITERIA, FACILITY_IDS, type CapacitySnapshot, type Criterion, type FacilityId } from "../policy/schema.js";
import type { Extraction } from "../types.js";
import { evaluateFacility, type FacilityEvaluation, type Item, type RuleState } from "./evaluate.js";
import type { MedReport } from "./formulary.js";

export type Verdict = "accept" | "conditional_accept" | "blocked" | "decline";

export interface FacilityResult {
  facilityId: FacilityId;
  verdict: Verdict;
  blocking: Item[];
  conditional: Item[];
  review: Item[];
  firstDoseAtRisk: boolean;
  checklist: Item[]; // all 43, including met and not_applicable
  formularyReport: MedReport[];
  beds: { unit: string | null; available: number | null };
}

export type CriteriaView = Record<Criterion, Record<FacilityId, { worstState: RuleState; items: Item[] }>>;

export interface ScreenResult {
  facilities: Record<FacilityId, FacilityResult>;
  criteriaView: CriteriaView;
}

/**
 * decline: a blocking item the facility cannot fix at any paperwork level.
 * blocked: a blocking item that must be cleared before the patient travels (preArrival).
 * conditional_accept: remaining blocks are cleared during admission, or there are items on a clock.
 * accept: nothing blocking or conditional (review items may remain).
 */
export function rollup(ev: FacilityEvaluation): FacilityResult {
  const all = [...ev.checklist, ...ev.extraItems];
  const blocking = all.filter((i) => i.decision === "block");
  const conditional = all.filter((i) => i.decision === "conditional");
  const review = all.filter((i) => i.decision === "review");
  const verdict: Verdict = blocking.some((i) => i.resolvable === "capability")
    ? "decline"
    : blocking.some((i) => i.preArrival)
      ? "blocked"
      : blocking.length || conditional.length
        ? "conditional_accept"
        : "accept";
  return { facilityId: ev.facilityId, verdict, blocking, conditional, review, firstDoseAtRisk: ev.firstDoseAtRisk, checklist: ev.checklist, formularyReport: ev.formularyReport, beds: ev.beds };
}

const SEVERITY: RuleState[] = ["not_met", "contradictory", "unknown", "met", "not_applicable"];
const worst = (items: Item[]): RuleState => SEVERITY.find((s) => items.some((i) => i.state === s)) ?? "not_applicable";

export function buildCriteriaView(facilities: Record<FacilityId, FacilityResult>): CriteriaView {
  const view = {} as CriteriaView;
  for (const c of CRITERIA) {
    view[c] = {} as CriteriaView[Criterion];
    for (const f of FACILITY_IDS) {
      const items = facilities[f].checklist.filter((i) => i.criterion === c);
      view[c][f] = { worstState: worst(items), items };
    }
  }
  return view;
}

export function screen(extraction: Extraction, policy: Policy, capacity: CapacitySnapshot, now: Date): ScreenResult {
  const facilities = {} as Record<FacilityId, FacilityResult>;
  for (const f of FACILITY_IDS) facilities[f] = rollup(evaluateFacility(extraction, f, policy, capacity, now));
  return { facilities, criteriaView: buildCriteriaView(facilities) };
}

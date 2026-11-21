import type { Policy } from "../policy/index.js";
import { CRITERIA, FACILITY_IDS, type CapacitySnapshot, type Criterion, type FacilityId } from "../policy/schema.js";
import type { Extraction } from "../types.js";
import { evaluateFacility, type FacilityEvaluation, type Item, type RuleState } from "./evaluate.js";
import type { MedReport } from "./formulary.js";
import { buildMedRec, type MedRecItem } from "./medrec.js";
import { evaluatePacketChecks, type PacketGap } from "./packet-checks.js";

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

/** A non-rule note shown in a criterion cell (confirm-items, packet gaps). Never feeds worstState or a verdict. */
export interface CriteriaFlag { id: string; chip: "CONFIRM DOSE" | "PACKET GAP"; text: string; followUpAsk: string }

export type CriteriaView = Record<Criterion, Record<FacilityId, { worstState: RuleState; items: Item[]; flags?: CriteriaFlag[] }>>;

export interface ScreenResult {
  facilities: Record<FacilityId, FacilityResult>;
  criteriaView: CriteriaView;
  /** Dose divergences between the discharge list and the final days' notes. Facility-independent; verdict-neutral. */
  medRec: MedRecItem[];
  /** Diagnosis-aware packet-completeness gaps. Facility-independent; verdict-neutral. */
  packetGaps: PacketGap[];
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

/**
 * Design choice: med-rec confirm-items and packet gaps are listed as `flags` on the pharmacy_operations and
 * monitoring_transitions cells (same in every facility column) instead of pseudo rule states, so worstState stays a
 * pure function of the 43 rules and nothing here can look like a rule failure.
 */
export function buildCriteriaView(facilities: Record<FacilityId, FacilityResult>, medRec: MedRecItem[] = [], packetGaps: PacketGap[] = []): CriteriaView {
  const view = {} as CriteriaView;
  const flagsFor = (c: Criterion): CriteriaFlag[] =>
    c === "pharmacy_operations"
      ? medRec.map((m) => ({ id: m.id, chip: "CONFIRM DOSE" as const, text: m.text, followUpAsk: m.followUpAsk }))
      : c === "monitoring_transitions"
        ? packetGaps.map((g) => ({ id: g.id, chip: "PACKET GAP" as const, text: g.text, followUpAsk: g.followUpAsk }))
        : [];
  for (const c of CRITERIA) {
    view[c] = {} as CriteriaView[Criterion];
    for (const f of FACILITY_IDS) {
      const items = facilities[f].checklist.filter((i) => i.criterion === c);
      const flags = flagsFor(c);
      view[c][f] = { worstState: worst(items), items, ...(flags.length ? { flags } : {}) };
    }
  }
  return view;
}

export function screen(extraction: Extraction, policy: Policy, capacity: CapacitySnapshot, now: Date): ScreenResult {
  const facilities = {} as Record<FacilityId, FacilityResult>;
  for (const f of FACILITY_IDS) facilities[f] = rollup(evaluateFacility(extraction, f, policy, capacity, now));
  const medRec = buildMedRec(extraction);
  const packetGaps = evaluatePacketChecks(extraction);
  return { facilities, criteriaView: buildCriteriaView(facilities, medRec, packetGaps), medRec, packetGaps };
}

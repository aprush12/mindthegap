import type { Policy } from "../policy/index.js";
import type { CapacitySnapshot, Decision, FacilityId, FacilityRuleCell, Predicate, Resolvable, Rule } from "../policy/schema.js";
import type { Contradiction, Evidence, Extraction, Patient, RuleAnswer } from "../types.js";
import { evaluateMed, matchAgent, type MedReport } from "./formulary.js";
import { firstDoseRisks, hhmm, minuteOfDay, resolveBy } from "./leadtime.js";

export type RuleState = "met" | "not_met" | "unknown" | "contradictory" | "not_applicable";

export interface Item {
  ruleId: string;
  category: string;
  criterion: string;
  question: string;
  state: RuleState;
  decision: Decision | null;
  windowHours?: number;
  resolveBy?: string;
  resolvable: Resolvable;
  preArrival: boolean;
  requirement: Record<string, unknown>;
  evidence: Evidence[];
  contradictions: Contradiction[];
  detail?: string;
  notes: string;
}

export interface FacilityEvaluation {
  facilityId: FacilityId;
  checklist: Item[]; // exactly one per rule, rule order
  extraItems: Item[]; // capacity blockers outside the 43 rules (CAP-BEDS)
  formularyReport: MedReport[];
  firstDoseAtRisk: boolean;
  beds: { unit: string | null; available: number | null };
}

type V = Record<string, unknown>;
type Req = Record<string, unknown>;
interface Cx { patient: Patient; arrival: Date; vent: boolean; sitters: number }

const truthy = (x: unknown) => x !== undefined && x !== null && x !== false && x !== "";
const holds = (p: Predicate | undefined, patient: Patient): boolean => {
  if (!p) return true;
  if ("all" in p) return p.all.every((q) => holds(q, patient));
  const v = patient[p.field];
  if (v === undefined) return false;
  return p.in ? p.in.includes(v) : v === p.equals;
};

/** Requirement checker. true = met, false = not met, undefined = cannot tell (treated as unknown). */
function check(id: string, v: V, req: Req, cx: Cx): boolean | undefined {
  const all = (keys: unknown) => !Array.isArray(keys) || keys.every((k) => truthy(v[String(k)]));
  switch (id) {
    case "PAY-01": {
      const min = cx.vent && typeof req.ventMinApprovedDays === "number" ? req.ventMinApprovedDays : Number(req.minApprovedDays);
      return v.status === "active" && Number(v.approvedDays) >= min;
    }
    case "REG-01": return truthy(v.level1Complete) && (!truthy(v.level2Triggered) || truthy(v.level2Resolved));
    case "REG-02": return all(req.requiresAll) && (!cx.vent || all(req.ventRequiresAll));
    case "REG-03": return truthy(v.capacityDocumented) && (!truthy(v.impaired) || truthy(v.proxyDocumented));
    case "ACU-03": {
      if (v.present === false) return true;
      if (Array.isArray(req.acceptedLineTypes) && !req.acceptedLineTypes.includes(v.lineType)) return false;
      if (typeof req.noStartAfter === "string") {
        const start = v.startsAt ? new Date(String(v.startsAt)) : cx.arrival;
        if (minuteOfDay(start) >= hhmm(req.noStartAfter)) return false;
      }
      return true;
    }
    case "ACU-06":
      if (!truthy(v.present) || !truthy(v.correctionScaleNeeded)) return true;
      return req.accepted === false ? false : truthy(v.scalePresent);
    case "ACU-08":
      if (v.present === false) return true;
      return cx.sitters >= Number(req.minSittersAvailable ?? 1) || (typeof req.orUnit === "string" && cx.patient.targetUnit === req.orUnit);
    case "ACU-09": {
      const w = Number(v.weightKg ?? cx.patient.weightKg);
      return Number.isNaN(w) ? undefined : w <= Number(req.maxWeightKg);
    }
    case "INF-02":
      if (v.present === false) return true;
      if (!all(req.requiresAll)) return false;
      return v.route !== "iv" || (req.oralOnly !== true && all(req.ivRequiresAll));
    case "NUT-01": return !truthy(v.conflict);
    case "DCP-01": return all(req.requiresAll) && (!(req.placementPathIfNoSafeHome === true && v.safeHome === false) || truthy(v.placementPath));
    default: {
      // generic gate: explicit absence is met; then accepted / type lists / required fields
      if (v.present === false) return true;
      if (req.accepted === false) return false;
      if (Array.isArray(req.acceptedTypes) && !req.acceptedTypes.includes(v.type ?? v.kind)) return false;
      if (Array.isArray(req.notAcceptedTypes) && req.notAcceptedTypes.includes(v.type ?? v.kind)) return false;
      if (Array.isArray(req.requiresAny) && !req.requiresAny.some((k) => truthy(v[String(k)]))) return false;
      return all(req.requiresAll);
    }
  }
}

interface Computed { state: RuleState; detail?: string; resolvable?: Resolvable; dueOverride?: Date }

const UNIT_FALLBACK: Record<string, string[]> = {
  complex_medical: ["complex_medical", "skilled_medical", "long_term_care"],
  skilled_medical: ["skilled_medical", "complex_medical"],
  vent_trach: ["vent_trach"],
  short_stay_rehab: ["short_stay_rehab"],
  long_term_care: ["long_term_care"],
  memory_care: ["secured_memory_care"],
};

export function evaluateFacility(extraction: Extraction, facilityId: FacilityId, policy: Policy, capacity: CapacitySnapshot, now: Date): FacilityEvaluation {
  const facility = policy.facilities.find((f) => f.id === facilityId);
  if (!facility) throw new Error(`unknown facility ${facilityId}`);
  const cap = capacity[facilityId];
  const arrival = extraction.timing.arrivalAt ? new Date(extraction.timing.arrivalAt) : now;
  const answers = new Map<string, RuleAnswer>(extraction.answers.map((a) => [a.ruleId, a]));
  const val = (id: string): V => ((answers.get(id)?.answered ? answers.get(id)?.value : undefined) ?? {}) as V;

  const patient: Patient = { ...extraction.patient };
  if (patient.isolationRequired === undefined && answers.get("INF-01")?.answered && typeof val("INF-01").present === "boolean") patient.isolationRequired = val("INF-01").present as boolean;
  if (patient.ventDependent === undefined && answers.get("ACU-01")?.answered && typeof val("ACU-01").present === "boolean") patient.ventDependent = val("ACU-01").present as boolean;
  const cx: Cx = { patient, arrival, vent: patient.ventDependent === true || patient.targetUnit === "vent_trach", sitters: cap.sittersAvailable };

  const meds = extraction.medications;
  const risks = firstDoseRisks(meds, facility, arrival, policy.formulary);
  const riskNames = new Set(risks.map((r) => r.med));
  const formularyReport: MedReport[] = meds.map((m) => {
    const r = evaluateMed(m, matchAgent(m.name, policy.formulary), facilityId);
    if (r.leadHours > 0) r.resolveBy = resolveBy(r.leadHours, arrival).toISOString();
    if (m.firstDoseDue) r.firstDoseAtRisk = riskNames.has(m.name);
    return r;
  });

  const list = (xs: MedReport[]) => xs.map((r) => `${r.med} (${r.status})`).join(", ");
  const computed = (id: string, req: Req): Computed | undefined => {
    const rep = formularyReport;
    const noMeds = meds.length === 0 ? ({ state: "unknown", detail: "no medications extracted" } as Computed) : undefined;
    switch (id) {
      case "INF-03": {
        const ok = cap.isolationRoomsAvailable >= Number(req.minIsolationRoomsAvailable ?? 1);
        return { state: ok ? "met" : "not_met", detail: `${cap.isolationRoomsAvailable} isolation room(s) available at ${cap.asOf}` };
      }
      case "RX-01": {
        if (noMeds) return noMeds;
        const bad = rep.filter((r) => r.status === "nf" || r.status === "not_stocked" || r.status === "not_accepted");
        if (bad.length) return { state: "not_met", detail: list(bad), resolvable: bad.some((r) => r.status !== "nf") ? "capability" : undefined };
        const un = rep.filter((r) => r.status === "unmatched");
        return un.length ? { state: "unknown", detail: `unmatched: ${list(un)}` } : { state: "met" };
      }
      case "RX-02": {
        if (noMeds) return noMeds;
        if (!risks.length) return { state: "met" };
        const earliest = new Date(Math.min(...risks.map((r) => r.due.getTime())));
        return { state: "not_met", detail: risks.map((r) => `${r.med} due ${r.due.toISOString()}, earliest supply ${r.supplyAt?.toISOString() ?? "never"}`).join("; "), dueOverride: earliest };
      }
      case "RX-03": {
        if (noMeds) return noMeds;
        const pa = rep.filter((r) => r.payorPA);
        return pa.length ? { state: "not_met", detail: list(pa) } : { state: "met" };
      }
      case "RX-04": {
        const ctl = rep.filter((r) => r.controlled);
        if (!ctl.length) return { state: "not_applicable" };
        const bad = meds.filter((m, i) => rep[i].controlled && m.hardCopyPresent !== true);
        return bad.length ? { state: "not_met", detail: `no signed hard copy: ${bad.map((m) => m.name).join(", ")}` } : { state: "met" };
      }
      case "RX-05": {
        if (noMeds) return noMeds;
        const ix = rep.filter((r) => r.status === "interchange");
        return ix.length ? { state: "not_met", detail: ix.map((r) => `${r.med} -> ${r.interchangeTo}`).join(", ") } : { state: "met" };
      }
    }
  };

  const build = (rule: Rule): Item => {
    const cell: FacilityRuleCell = rule.perFacility[facilityId];
    const ans = answers.get(rule.id);
    let state: RuleState;
    let detail: string | undefined;
    let resolvable: Resolvable = cell.resolvable;
    let due: Date | undefined;
    const pre = computed(rule.id, cell.requirement);
    if (!holds(rule.appliesWhen, patient) || !holds(cell.appliesWhen, patient)) {
      state = "not_applicable";
    } else if (pre) {
      ({ state, detail } = pre);
      due = pre.dueOverride;
      if (pre.resolvable) resolvable = pre.resolvable;
    } else if (ans && ans.contradictions.length) {
      state = "contradictory";
      detail = `Contradictory passages (p${ans.contradictions.map((c) => `${c.pageA}/${c.pageB}`).join(", p")}); not resolved`;
    } else if (!ans || !ans.answered) {
      state = "unknown";
      detail = "Record does not answer this question";
    } else {
      const ok = check(rule.id, (ans.value ?? {}) as V, cell.requirement, cx);
      state = ok === undefined ? "unknown" : ok ? "met" : "not_met";
      if (ok === undefined) detail = "Answer lacks the value needed to compare";
    }

    let decision: Decision | null = null;
    let windowHours: number | undefined;
    let resolveByIso: string | undefined;
    if (state === "not_met" || state === "unknown" || state === "contradictory") {
      const isNotMet = state === "not_met";
      decision = isNotMet ? cell.notMetDecision : cell.unknownDecision;
      windowHours = isNotMet ? cell.windowHours : (cell.unknownWindowHours ?? cell.windowHours);
      if (decision === "conditional") {
        if (due) resolveByIso = due.toISOString(); // RX-02: the first dose, not a fixed window
        else {
          windowHours ??= 24; // spec silent: 24h assumption
          resolveByIso = resolveBy(windowHours, arrival).toISOString();
        }
      } else windowHours = undefined;
    }
    if (state !== "not_met") resolvable = "sender"; // unknown/contradictory is a documentation gap
    const item: Item = {
      ruleId: rule.id, category: rule.category, criterion: rule.criterion, question: rule.question,
      state, decision, resolvable, preArrival: cell.preArrival === true, requirement: cell.requirement,
      evidence: ans?.evidence ?? [], contradictions: ans?.contradictions ?? [], notes: cell.notes,
    };
    if (windowHours !== undefined) item.windowHours = windowHours;
    if (resolveByIso) item.resolveBy = resolveByIso;
    if (detail) item.detail = detail;
    return item;
  };

  // beds: informational, plus a capability blocker when the target unit has none tonight
  const wanted = patient.targetUnit ? UNIT_FALLBACK[patient.targetUnit] ?? [patient.targetUnit] : [];
  const unit = wanted.find((u) => facility.units.some((x) => x.name === u)) ?? null;
  const available = unit === null ? null : (cap.bedsAvailable[unit] ?? 0);
  const extraItems: Item[] = [];
  if (unit !== null && available === 0) {
    extraItems.push({
      ruleId: "CAP-BEDS", category: "CAP", criterion: "acuity_vs_staffing", question: "Bed available tonight in the target unit?",
      state: "not_met", decision: "block", resolvable: "capability", preArrival: false, requirement: { unit, minBeds: 1 },
      evidence: [], contradictions: [], detail: `0 ${unit} beds available at ${cap.asOf}`, notes: "capacity snapshot",
    });
  }

  return { facilityId, checklist: policy.rules.map(build), extraItems, formularyReport, firstDoseAtRisk: risks.length > 0, beds: { unit, available } };
}

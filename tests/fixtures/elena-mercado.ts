import type { Extraction, RuleAnswer } from "../../src/types.js";

/** Synthetic reference case from docs/facility-acceptance-spec.md (Elena Mercado). No real PHI. */
export const ARRIVAL = "2026-11-17T20:40:00";
export const NOW = new Date(ARRIVAL);

const yes = (ruleId: string, value: Record<string, unknown>, quote = "documented in record", page = 1): RuleAnswer => ({
  ruleId, answered: true, value, evidence: [{ quote, claimedPage: page, page, verified: true }], contradictions: [],
});
const unanswered = (ruleId: string): RuleAnswer => ({ ruleId, answered: false, evidence: [], contradictions: [] });
const absent = (ruleId: string) => yes(ruleId, { present: false }, "not present per nursing assessment");

export const elena: Extraction = {
  timing: { dischargeAt: "2026-11-17T18:42:00", arrivalAt: ARRIVAL },
  patient: { weightKg: 71.4, targetUnit: "complex_medical", medicaidPending: false, tubeFed: false, insulinRequired: true, ventDependent: false, trach: false, dialysis: false, elopementRisk: false, diagnoses: { heartFailure: true } },
  // Weights appear only in narrative notes; the packet has no order set at all (RX-06 unanswered), so no daily-weights
  // order and no escalation order: both packet gaps fire. No dose change anywhere in the packet.
  monitoringOrders: {
    dailyWeightsOrdered: false,
    weightEscalationPlan: false,
    evidence: [{ quote: "Daily weights for heart failure", claimedPage: 12, page: 12, verified: true }],
  },
  medications: [
    { name: "Sacubitril/valsartan (Entresto) 24/26 mg", route: "PO", schedule: "BID", firstDoseDue: "2026-11-18T08:00:00" },
    { name: "Insulin glargine 20 units", route: "SC", schedule: "nightly", firstDoseDue: "2026-11-17T21:00:00" },
    { name: "Apixaban 2.5 mg", route: "PO", schedule: "BID", firstDoseDue: "2026-11-18T08:00:00" },
    { name: "Furosemide 40 mg", route: "PO", schedule: "daily", firstDoseDue: "2026-11-18T08:00:00" },
    { name: "Carvedilol 6.25 mg", route: "PO", schedule: "BID", firstDoseDue: "2026-11-18T08:00:00" },
    { name: "Atorvastatin 40 mg", route: "PO", schedule: "nightly", firstDoseDue: "2026-11-17T21:00:00" },
    { name: "Amiodarone 200 mg", route: "PO", schedule: "daily", firstDoseDue: "2026-11-18T08:00:00" },
  ],
  answers: [
    yes("PAY-01", { status: "pending" }, "Authorization pending with payor", 4),
    yes("PAY-02", { qualifyingStay: true }, "Inpatient admission 14 Nov, 3 midnights", 2),
    unanswered("PAY-03"),
    unanswered("PAY-04"),
    unanswered("REG-01"), // PASRR never mentioned anywhere in the record
    unanswered("REG-02"),
    unanswered("REG-03"),
    unanswered("REG-04"),
    absent("ACU-01"), absent("ACU-02"), absent("ACU-03"), absent("ACU-04"), absent("ACU-05"),
    yes("ACU-06", { present: true, correctionScaleNeeded: true, scalePresent: false }, "Correct per sliding scale insulin orders (scale not attached)", 17),
    absent("ACU-07"), absent("ACU-08"),
    yes("ACU-09", { weightKg: 71.4 }, "Weight 71.4 kg", 1),
    unanswered("INF-01"), // MDRO / isolation status undocumented
    absent("INF-02"),
    unanswered("RX-06"), // signed orders never received
    yes("SKN-01", { present: true, stage: true, site: true, measurements: false, treatmentOrder: false }, "Stage 2 sacral pressure injury", 9),
    unanswered("SKN-02"),
    absent("SKN-03"),
    unanswered("THR-01"), unanswered("THR-02"),
    absent("THR-03"),
    yes("NUT-01", { conflict: false }, "Cardiac diet, swallow screen passed", 11),
    yes("MON-01", { present: true, standingOrders: false }, "BMP in 7 days (narrative only)", 22),
    unanswered("MON-02"),
    yes("MON-03", { present: true, kind: "daily_weights" }, "Daily weights for heart failure", 12),
    unanswered("FUP-01"), unanswered("FUP-02"), unanswered("FUP-03"),
    unanswered("DCP-01"), unanswered("DCP-02"),
  ],
};

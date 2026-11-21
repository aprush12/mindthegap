import type { Extraction, RuleAnswer } from "../../src/types.js";

/**
 * Synthetic second case (Harold Jennings, see scripts/sample/harold.ts): the inverse of Elena. Paperwork is complete;
 * the one hard problem is the ordered continuous cardiac telemetry. No real PHI.
 */
export const HAROLD_ARRIVAL = "2026-11-18T14:30:00";
export const HAROLD_NOW = new Date(HAROLD_ARRIVAL);

const yes = (ruleId: string, value: Record<string, unknown>, quote = "documented in record", page = 1): RuleAnswer => ({
  ruleId, answered: true, value, evidence: [{ quote, claimedPage: page, page, verified: true }], contradictions: [],
});
const absent = (ruleId: string) => yes(ruleId, { present: false }, "not present per nursing assessment");

export const harold: Extraction = {
  timing: { dischargeAt: "2026-11-18T11:30:00", arrivalAt: HAROLD_ARRIVAL },
  patient: { weightKg: 95, targetUnit: "complex_medical", medicaidPending: false, tubeFed: false, insulinRequired: false, ventDependent: false, trach: false, dialysis: false, elopementRisk: false, diagnoses: { heartFailure: true } },
  // Packet orders daily weights with escalation parameters (the signed order set), so no packet gaps.
  monitoringOrders: {
    dailyWeightsOrdered: true,
    weightEscalationPlan: true,
    evidence: [
      { quote: "Daily standing weight every morning after voiding, before breakfast, same scale.", claimedPage: 22, page: 22, verified: true },
      { quote: "Notify the physician for a gain above 1 kg in 24 hours or 2 kg in a week.", claimedPage: 22, page: 22, verified: true },
    ],
  },
  medications: [
    {
      name: "Torsemide 40 mg", route: "PO", schedule: "daily", firstDoseDue: "2026-11-19T08:00:00",
      // planted: the 17 Nov cardiology progress note raised the dose after the discharge list/order set were written
      doseChanges: [{
        listedDose: "40 mg", noteDose: "60 mg", noteContext: "17 Nov cardiology progress note",
        quoteList: "Torsemide 40 mg", pageList: 21, quoteNote: "increased torsemide to 60 mg daily", pageNote: 11, verifiedList: true, verifiedNote: true,
      }],
    },
    { name: "Empagliflozin (Jardiance) 10 mg", route: "PO", schedule: "daily", firstDoseDue: "2026-11-19T08:00:00" },
    { name: "Spironolactone 25 mg", route: "PO", schedule: "daily", firstDoseDue: "2026-11-19T08:00:00" },
    { name: "Carvedilol 12.5 mg", route: "PO", schedule: "BID", firstDoseDue: "2026-11-18T17:00:00" },
    { name: "Amiodarone 200 mg", route: "PO", schedule: "daily", firstDoseDue: "2026-11-19T08:00:00" },
    { name: "Aspirin 81 mg", route: "PO", schedule: "daily", firstDoseDue: "2026-11-19T08:00:00" },
    { name: "Atorvastatin 40 mg", route: "PO", schedule: "nightly", firstDoseDue: "2026-11-18T21:00:00" },
    { name: "Senna 8.6 mg", route: "PO", schedule: "nightly", firstDoseDue: "2026-11-18T21:00:00" },
  ],
  answers: [
    yes("PAY-01", { status: "active", approvedDays: 8 }, "Authorization is ACTIVE. 8 days approved", 2),
    yes("PAY-02", { qualifyingStay: true }, "Inpatient admission 10 Nov, 8 midnights", 2),
    yes("PAY-03", { dayCountKnown: true, financialCounselingArranged: true }, "0 of 100 skilled nursing days used", 2),
    yes("PAY-04", { partyIdentified: true }, "Denise Jennings (wife), (555) 555-0143", 1),
    yes("REG-01", { level1Complete: true, level2Triggered: false }, "Level I screen complete; Level II not triggered", 33),
    yes("REG-02", { codeStatusDocumented: true }, "FULL CODE; advance directive signed", 35),
    yes("REG-03", { capacityDocumented: true, impaired: false }, "Patient has decision-making capacity", 35),
    yes("REG-04", { immunizationsAvailable: true, tbScreened: true }, "Tuberculosis screening negative 11 Nov 2026", 36),
    absent("ACU-01"), absent("ACU-02"), absent("ACU-03"), absent("ACU-04"), absent("ACU-05"),
    absent("ACU-06"), absent("ACU-07"), absent("ACU-08"),
    yes("ACU-09", { weightKg: 95 }, "Weight 95.0 kg", 1),
    yes("INF-01", { present: false }, "No isolation precautions required", 34),
    absent("INF-02"),
    yes("RX-06", { allSigned: true }, "SIGNED PHYSICIAN ORDER SET", 25),
    absent("SKN-01"), absent("SKN-02"), absent("SKN-03"),
    // Honest gap: weight-bearing appears only as a PT narrative ("tolerates standing and gait training as tolerated"), never as an order.
    yes("THR-01", { weightBearingDocumented: false }, "tolerates standing and gait training as tolerated with a rolling walker", 30),
    yes("THR-02", { priorLevelOfFunction: true, ptRecommendation: true, otRecommendation: true, speechRecommendation: true }, "Prior level of function: independent", 30),
    yes("THR-03", { identified: true, settings: true, patientOwned: true }, "Patient-owned device and settings are documented", 24),
    yes("NUT-01", { conflict: false }, "Swallow screen passed; cardiac diet", 31),
    yes("MON-01", { present: true, standingOrders: true }, "Standing laboratory orders: potassium and creatinine twice weekly", 25),
    yes("MON-03", { present: true, kind: "continuous_telemetry", dailyWeights: true }, "CONTINUOUS CARDIAC TELEMETRY ordered for 7 days from arrival", 25),
    // Honest gap: pending potassium with no named recipient.
    yes("FUP-01", { present: true, namedRecipient: false }, "Repeat potassium pending at the time of transfer", 26),
    yes("FUP-02", { pcpOfRecord: true }, "Primary care physician of record: Naomi Whitfield, MD", 37),
    yes("FUP-03", { dateLocation: true, transport: true }, "Cardiology 25 Nov 2026 at 09:40; transport arranged", 37),
    yes("DCP-01", { destinationDocumented: true }, "Skilled nursing facility, skilled medical unit", 26),
    // Honest gap: bed hold policy never mentioned.
    { ruleId: "DCP-02", answered: false, evidence: [], contradictions: [] },
  ],
};

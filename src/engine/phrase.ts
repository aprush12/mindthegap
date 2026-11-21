import type { Item } from "./evaluate.js";
import type { MedReport } from "./formulary.js";
import { clockFromHHMM } from "../report/when.js";

/** Plain-language copy for priority lines. Pure text; no logic changes. One line, action first, no timestamps. */

/** "Sacubitril/valsartan (Entresto) 24/26 mg" -> "Entresto"; "Insulin glargine 20 units" -> "Insulin glargine". */
export function shortMed(name: string): string {
  const paren = name.match(/\(([^)]+)\)/);
  if (paren) return paren[1];
  return name.replace(/\s+\d[\d./]*\s*(mg|mcg|g|ml|units?|%|iu)\b.*$/i, "").trim();
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** What a medication needs, in a few words. */
function need(r: MedReport): string {
  switch (r.status) {
    case "nf": return `needs ${r.leadHours || 72}-hr exception`;
    case "not_stocked": return "not stocked";
    case "not_accepted": return "not accepted";
    case "pa": return "needs prior authorization";
    case "interchange": return "needs an interchange order";
    default: return "supply arrives too late";
  }
}
const RANK: Record<string, number> = { not_stocked: 0, not_accepted: 0, nf: 1, pa: 2, interchange: 3 };
const worstOf = (rs: MedReport[]) => [...rs].sort((a, b) => (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9) || b.leadHours - a.leadHours)[0];

const noInsulin = (s: string) => s.replace(/^insulin\s+/i, "");
const agentName = (r: MedReport) => noInsulin(r.agent ?? shortMed(r.med));

const note = (it: Item, re: RegExp) => it.notes?.match(re);

interface Ctx { it: Item; report: MedReport[]; arrival: Date }

const MEDLESS: Record<string, [string, string?]> = {
  "PAY-01": ["Insurance authorization still pending", "No insurance authorization found in the packet"],
  "PAY-02": ["Three-midnight qualifying hospital stay not documented"],
  "PAY-03": ["Benefit days unknown; day-21 co-insurance not planned for"],
  "PAY-04": ["No responsible party named; needed at signing"],
  "PAY-05": ["Medicaid application reference number missing"],
  "REG-01": ["PASRR screening incomplete", "PASRR screening missing from the packet"],
  "REG-02": ["Code status or directive not documented"],
  "REG-03": ["Decision-making capacity or proxy not documented"],
  "REG-04": ["Immunization dates or TB screening missing"],
  "ACU-01": ["Patient is ventilator dependent"],
  "ACU-02": ["Patient has a tracheostomy"],
  "ACU-03": ["IV line type or timing doesn't fit this facility"],
  "ACU-04": ["Dialysis chair or transport not arranged"],
  "ACU-05": ["Patient needs TPN"],
  "ACU-06": ["Insulin correction scale is referenced in the MAR but was never sent; obtain before first meal"],
  "ACU-07": ["Elopement or behavior risk needs a care plan"],
  "ACU-08": ["Patient needs one-to-one observation"],
  "ACU-09": ["Patient weight is over the equipment limit"],
  "INF-01": ["Isolation status needs action", "No MDRO/isolation status anywhere in the packet"],
  "INF-02": ["Antibiotic orders lack indication, course or stop date"],
  "INF-03": ["No isolation room available tonight"],
  "RX-04": ["Controlled substances need a signed hard copy"],
  "RX-06": ["Physician orders are unsigned; chase the hospital for signatures"],
  "SKN-01": ["Wound details incomplete; need stage, size, site and treatment order"],
  "SKN-02": ["Wounds not documented as present on admission"],
  "SKN-03": ["Specialty surface or wound vac needed"],
  "THR-01": ["Weight-bearing status missing"],
  "THR-02": ["Prior function and PT/OT/speech recommendations missing"],
  "THR-03": ["Required equipment not identified"],
  "NUT-01": ["Diet order conflicts with the swallow evaluation"],
  "NUT-02": ["Tube feeding details missing (formula, rate, flushes, tube type)"],
  "MON-01": ["No standing order for lab monitoring of high-risk meds"],
  "MON-02": ["Glucose check frequency and low-sugar parameters missing"],
  "MON-03": ["Required monitoring (telemetry, weights, sats) isn't available"],
  "FUP-01": ["Pending results have no named recipient"],
  "FUP-02": ["No primary care physician on record"],
  "FUP-03": ["Appointments missing date, location or transport"],
  "DCP-01": ["Discharge destination or home setup not documented"],
  "DCP-02": ["Bed-hold policy not yet acknowledged"],
  "CAP-BEDS": ["No bed available tonight in the target unit"],
};

const CAP_MEDLESS: Record<string, string> = {
  "ACU-01": "This facility does not take ventilator patients",
  "ACU-02": "This facility does not take tracheostomy patients",
  "ACU-03": "This facility cannot manage this patient's IV therapy",
  "ACU-04": "This facility cannot arrange dialysis",
  "ACU-05": "This facility does not give TPN",
  "ACU-08": "This facility cannot provide one-to-one observation",
  "ACU-09": "Patient's weight is over this facility's equipment limit",
  "INF-03": "This facility has no isolation room available tonight",
  "NUT-01": "This facility cannot manage the diet and swallow conflict",
  "SKN-03": "This facility cannot provide the specialty surface or wound vac",
  "MON-03": "This facility cannot provide the monitoring required",
  "CAP-BEDS": "This facility has no bed available tonight in the target unit",
};

function medText({ it, report, arrival }: Ctx, capability: boolean): string | undefined {
  switch (it.ruleId) {
    case "RX-02": {
      const risk = report.filter((r) => r.firstDoseAtRisk);
      if (!risk.length) return undefined;
      const w = worstOf(risk);
      const tail = `${plural(risk.length, "med", "meds")}; worst: ${shortMed(w.med)}, ${need(w)}`;
      const m = note(it, /cutoff (\d{1,2}):(\d{2})/i);
      const late = !!m && arrival.getHours() * 60 + arrival.getMinutes() >= Number(m[1]) * 60 + Number(m[2]);
      if (capability) return `Pharmacy can't get first doses here in time (${late ? `past ${clockFromHHMM(`${m![1]}:${m![2]}`)} cutoff; ` : ""}${tail})`;
      return `First doses at risk: ${late ? "arrival past pharmacy cutoff" : "supply arrives after they're due"} (${tail})`;
    }
    case "RX-01": {
      const bad = report.filter((r) => ["nf", "not_stocked", "not_accepted"].includes(r.status));
      if (!bad.length) return undefined;
      const w = worstOf(bad);
      if (bad.length === 1) return `${shortMed(w.med)} isn't on the formulary (${need(w)})`;
      return `${bad.length} meds aren't on the formulary (worst: ${shortMed(w.med)}, ${need(w)})`;
    }
    case "RX-03": {
      const pa = report.filter((r) => r.payorPA);
      if (!pa.length) return undefined;
      return pa.length === 1 ? `Get payor prior authorization for ${shortMed(pa[0].med)}` : `Get payor prior authorization for ${pa.length} meds (${shortMed(pa[0].med)} first)`;
    }
    case "RX-05": {
      const ix = report.filter((r) => r.status === "interchange");
      if (!ix.length) return undefined;
      const r = ix[0];
      const more = ix.length > 1 ? ` (+${ix.length - 1} more)` : "";
      return `Get an interchange order: ${agentName(r)} → ${noInsulin(r.interchangeTo ?? "stocked agent")} (facility doesn't stock ${agentName(r)})${more}`;
    }
  }
}

/** One-line, plain-language text for a priority item. `capability` selects the capability-gap phrasing. */
export function itemPhrase(it: Item, report: MedReport[], arrival: Date, capability: boolean): string {
  const med = medText({ it, report, arrival }, capability);
  if (med) return med;
  if (capability) {
    if (it.ruleId === "ACU-06") {
      const rn = note(it, /RN ends (\d{1,2}:\d{2})/i);
      return `This facility cannot manage sliding-scale insulin overnight${rn ? ` (RN leaves at ${clockFromHHMM(rn[1])})` : ""}`;
    }
    if (CAP_MEDLESS[it.ruleId]) return CAP_MEDLESS[it.ruleId];
  }
  const p = MEDLESS[it.ruleId];
  if (p) {
    const base = it.state === "unknown" && p[1] ? p[1] : p[0];
    return it.state === "contradictory" ? `${base} (the packet contradicts itself)` : base;
  }
  return it.state === "unknown" ? `Not documented: ${it.question}` : it.question;
}

/** Text for a medication the first-dose clock flags when its rule item is not itself a tonight item. */
export function medLine(r: MedReport): string {
  if (r.status === "interchange") return `Get an interchange order: ${agentName(r)} → ${noInsulin(r.interchangeTo ?? "stocked agent")}`;
  return `${shortMed(r.med)}: ${need(r)}; first dose is due before supply is confirmed`;
}

// ---- follow-up asks: the one-sentence question for the discharging hospital (voice-agent call sheet) ----

/** [ask when the packet is silent or the item is not met, ask when the record contradicts itself?] */
const ASK: Record<string, [string, string?]> = {
  "PAY-01": ["Confirm when the insurance authorization will be approved and for how many days", "Send the insurance authorization number and approved days"],
  "PAY-02": ["Send documentation of the three-midnight inpatient stay"],
  "PAY-03": ["Send the number of skilled nursing days already used"],
  "PAY-04": ["Give us the name and phone number of the responsible party"],
  "PAY-05": ["Send the Medicaid application reference number"],
  "REG-01": ["Send the completed PASRR Level II determination", "Fax the PASRR Level I determination"],
  "REG-02": ["Send the code status order and any advance directive or MOLST"],
  "REG-03": ["Send the capacity assessment and the healthcare proxy's name if the patient lacks capacity"],
  "REG-04": ["Send immunization dates and the TB screening result"],
  "ACU-01": ["Confirm whether the patient is ventilator dependent"],
  "ACU-02": ["Confirm whether the patient has a tracheostomy"],
  "ACU-03": ["Send the IV line type, start time and IV therapy orders"],
  "ACU-04": ["Confirm the dialysis chair and transport arrangements"],
  "ACU-05": ["Confirm the TPN orders and who supplies the TPN"],
  "ACU-06": ["Send the insulin correction scale from the MAR before the first meal"],
  "ACU-07": ["Send the behavior or elopement-risk care plan"],
  "ACU-08": ["Confirm whether one-to-one observation is required"],
  "ACU-09": ["Confirm the patient's current weight"],
  "INF-01": ["Send the MDRO and isolation status, or confirm there is none"],
  "INF-02": ["Send the antibiotic indication, course length and stop date"],
  "INF-03": ["Confirm whether isolation precautions are required"],
  "RX-04": ["Send the signed hard-copy prescriptions for the controlled substances"],
  "RX-06": ["Send the signed physician order set"],
  "SKN-01": ["Send each wound's stage, size, site and treatment order"],
  "SKN-02": ["Confirm which wounds were present on admission"],
  "SKN-03": ["Confirm whether a specialty surface or wound vac is ordered"],
  "THR-01": ["Send the weight-bearing status order"],
  "THR-02": ["Send prior level of function and the PT, OT and speech recommendations"],
  "THR-03": ["Send the list of required equipment and who supplies it"],
  "NUT-01": ["Confirm the diet order against the swallow evaluation"],
  "NUT-02": ["Send the tube feeding formula, rate, flushes and tube type"],
  "MON-01": ["Send the standing lab order for the medications that need lab monitoring"],
  "MON-02": ["Send the glucose check frequency and low-sugar parameters"],
  "MON-03": ["Send the orders for telemetry, daily weights or oxygen saturation monitoring"],
  "FUP-01": ["Name who receives each pending result"],
  "FUP-02": ["Send the primary care physician's name and phone number"],
  "FUP-03": ["Send each appointment's date, location and transport arrangement"],
  "DCP-01": ["Confirm the discharge destination and home setup"],
  "DCP-02": ["Confirm the family was told the bed-hold policy"],
};

/** When the facility itself cannot do it, the ask is about changing the plan, not sending paperwork. */
const CAP_ASK: Record<string, string> = {
  "CAP-BEDS": "Ask whether the transfer can wait for a bed in the target unit, or whether another unit is acceptable",
  "MON-03": "Ask the physician whether telemetry can be replaced with spot checks, or whether a facility with telemetry is needed",
  "RX-02": "Ask the prescriber how first doses will be covered, since supply arrives after they are due",
  "ACU-06": "Ask the prescriber whether a simpler insulin plan can replace overnight sliding scale",
};

function medAsk(it: Item, report: MedReport[]): string | undefined {
  switch (it.ruleId) {
    case "RX-01": {
      const bad = report.filter((r) => ["nf", "not_stocked", "not_accepted"].includes(r.status));
      if (!bad.length) return undefined;
      const w = worstOf(bad);
      return `Ask the prescriber for a formulary alternative to ${shortMed(w.med)}${bad.length > 1 ? ` and ${bad.length - 1} other ${bad.length === 2 ? "med" : "meds"}` : ""}`;
    }
    case "RX-02": {
      const risk = report.filter((r) => r.firstDoseAtRisk);
      return risk.length ? `Ask the hospital how first doses of ${plural(risk.length, "med", "meds")} will be covered, since supply arrives after they are due` : undefined;
    }
    case "RX-03": {
      const pa = report.filter((r) => r.payorPA);
      return pa.length ? `Ask the hospital to start payor prior authorization for ${shortMed(pa[0].med)}${pa.length > 1 ? ` and ${pa.length - 1} other ${pa.length === 2 ? "med" : "meds"}` : ""}` : undefined;
    }
    case "RX-05": {
      const ix = report.filter((r) => r.status === "interchange");
      if (!ix.length) return undefined;
      const r = ix[0];
      return `Ask the prescriber for an interchange order: ${agentName(r)} → ${noInsulin(r.interchangeTo ?? "stocked agent")}${ix.length > 1 ? ` (+${ix.length - 1} more)` : ""}`;
    }
  }
}

/**
 * Deterministic one-sentence ask for the hospital, per rule family. Pure text; never includes timestamps.
 * Only for items that need action (not_met / unknown / contradictory).
 */
export function followUpAsk(it: Item, report: MedReport[]): string {
  const capability = it.decision === "block" && it.resolvable === "capability";
  if (capability && CAP_ASK[it.ruleId]) return CAP_ASK[it.ruleId];
  const med = medAsk(it, report);
  if (med) return med;
  if (capability) return "Tell the hospital this facility can't meet this need and ask whether the plan can change";
  const a = ASK[it.ruleId];
  if (a) return it.state === "not_met" ? a[0] : (a[1] ?? a[0]);
  return `Send documentation for: ${it.question}`;
}

/** Ask for a medication the first-dose clock flags when its rule item is not itself a tonight item. */
export function medFollowUp(r: MedReport): string {
  if (r.status === "interchange") return `Ask the prescriber for an interchange order: ${agentName(r)} → ${noInsulin(r.interchangeTo ?? "stocked agent")}`;
  return `Ask the hospital how the first dose of ${shortMed(r.med)} will be covered (${need(r)})`;
}

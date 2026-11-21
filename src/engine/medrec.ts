import type { DoseChange, Extraction } from "../types.js";
import { scrubTimes } from "../report/when.js";
import { shortMed } from "./phrase.js";

/**
 * Medication reconciliation confirm-items: a dose or frequency that differs between the discharge list and the
 * final days' notes. Facility-independent and never a rule failure: they surface as tier-1 "CONFIRM DOSE" priorities
 * at every facility and never touch a verdict.
 */
export interface MedRecItem {
  /** MEDREC:<agent>, agent being the lower-cased short drug name. */
  id: string;
  med: string;
  text: string;
  followUpAsk: string;
  listedDose: string;
  noteDose: string;
  /** First dose due at the facility, if the record gives it (ISO; display goes through the friendly formatter). */
  dueBy?: string;
  /** Both quotes, list first. */
  evidence: { quote: string; page?: number }[];
}

const ISO = /\d{4}-\d{2}-\d{2}/;
/** Model-written context only if it reads as plain words (no ISO leak); else the neutral phrase. */
const context = (d: DoseChange) => {
  const c = d.noteContext ? scrubTimes(d.noteContext).trim() : "";
  return c && !ISO.test(c) && c.length <= 60 ? c : undefined;
};

const ev = (quote: string, page: number, verified?: boolean): { quote: string; page?: number } => ({ quote, ...(verified === false ? {} : { page }) });

export function buildMedRec(ex: Extraction): MedRecItem[] {
  const out: MedRecItem[] = [];
  for (const m of ex.medications) {
    const d = m.doseChanges?.[0];
    if (!d) continue;
    const name = shortMed(m.name);
    const more = (m.doseChanges?.length ?? 1) - 1;
    const tail = more > 0 ? ` (+${more} more difference${more > 1 ? "s" : ""})` : "";
    const src = context(d);
    const due = m.firstDoseDue && !Number.isNaN(new Date(m.firstDoseDue).getTime()) ? new Date(m.firstDoseDue).toISOString() : undefined;
    out.push({
      id: `MEDREC:${name.toLowerCase()}`,
      med: m.name,
      text: `${name} dose conflict: discharge list says ${d.listedDose}, last progress note says ${d.noteDose} — confirm before first dose${tail}`,
      followUpAsk: `Confirm current ${name.toLowerCase()} dose: discharge list ${d.listedDose} vs ${src ?? "last progress note"} ${d.noteDose}`,
      listedDose: d.listedDose,
      noteDose: d.noteDose,
      ...(due ? { dueBy: due } : {}),
      evidence: [ev(d.quoteList, d.pageList, d.verifiedList), ev(d.quoteNote, d.pageNote, d.verifiedNote)],
    });
  }
  return out;
}

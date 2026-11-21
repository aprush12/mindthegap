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

/** Doses can be whole sentences ("Sliding scale SC, per attached scale; With meals and at bedtime"): keep the ask readable. */
const brief = (dose: string, max = 40) => {
  const d = dose.trim().replace(/\s+/g, " ");
  if (d.length <= max) return d;
  const cut = d.slice(0, max).replace(/[\s,;:]+\S*$/, "");
  return `${cut || d.slice(0, max)}…`;
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
      // the doses themselves are shown side by side on the page (from the evidence quotes); the line stays short
      text: `Check the ${name} dose: the discharge list and a later note disagree${tail}`,
      followUpAsk: `Which ${name.toLowerCase()} dose is current: "${brief(d.listedDose)}" on the discharge list, or "${brief(d.noteDose)}" in the ${src ?? "latest progress note"}?`,
      listedDose: d.listedDose,
      noteDose: d.noteDose,
      ...(due ? { dueBy: due } : {}),
      evidence: [ev(d.quoteList, d.pageList, d.verifiedList), ev(d.quoteNote, d.pageNote, d.verifiedNote)],
    });
  }
  return out;
}

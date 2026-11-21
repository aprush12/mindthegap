import type { Facility, FormularyAgent } from "../policy/schema.js";
import type { Med } from "../types.js";
import { matchAgent } from "./formulary.js";

/** "HH:MM" (anywhere in the string, so "+1d 11:00" works) -> minutes after midnight. */
export const hhmm = (s: string): number => {
  const m = /(\d{1,2}):(\d{2})/.exec(s);
  if (!m) throw new Error(`bad time: ${s}`);
  return Number(m[1]) * 60 + Number(m[2]);
};
export const minuteOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();

const atMinute = (base: Date, minutes: number, dayOffset: number) => {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  d.setMinutes(minutes);
  return d;
};

/** Deadline for a conditional item: arrival + window. */
export const resolveBy = (windowHours: number, arrivalAt: Date): Date => new Date(arrivalAt.getTime() + windowHours * 3_600_000);

/**
 * When can the pharmacy get a (stocked) item into the building, ordering at `arrivalAt`?
 * Orders before the cutoff (and after the morning delivery) are served the same day. Orders after
 * the cutoff, or overnight before the next delivery, wait for the next delivery, unless the
 * pharmacy has an on-call pharmacist (then arrival + on-call minutes).
 */
export function pharmacySupplyAt(facility: Facility, arrivalAt: Date): Date {
  const p = facility.pharmacy;
  const tod = minuteOfDay(arrivalAt);
  const cutoff = hhmm(p.cutoff);
  const delivery = p.nextDelivery ? hhmm(p.nextDelivery) : 0;
  const afterCutoff = tod >= cutoff;
  const overnight = tod < delivery;
  if (!afterCutoff && !overnight) return arrivalAt;
  if (p.onCallAfterCutoffMinutes) return new Date(arrivalAt.getTime() + p.onCallAfterCutoffMinutes * 60_000);
  return atMinute(arrivalAt, delivery, afterCutoff ? 1 : 0);
}

/** Earliest the med can be in hand; null = cannot be supplied at any lead time. */
export function earliestSupply(agent: FormularyAgent | undefined, facility: Facility, arrivalAt: Date): Date | null {
  if (agent?.kitClass && facility.emergencyKit.includes.includes(agent.kitClass)) return arrivalAt; // kit covers
  const cell = agent?.perFacility[facility.id];
  if (cell && (cell.status === "not_stocked" || cell.status === "not_accepted")) return null;
  const base = pharmacySupplyAt(facility, arrivalAt);
  if (cell?.status === "nf") {
    const exception = resolveBy(cell.leadHours ?? 72, arrivalAt);
    return exception > base ? exception : base;
  }
  return base; // formulary / pa (payor PA is paperwork, tracked by RX-03) / interchange (stocked substitute)
}

export interface FirstDoseRisk { med: string; due: Date; supplyAt: Date | null }

export function firstDoseRisks(meds: Med[], facility: Facility, arrivalAt: Date, formulary: FormularyAgent[]): FirstDoseRisk[] {
  const risks: FirstDoseRisk[] = [];
  for (const med of meds) {
    if (!med.firstDoseDue) continue;
    const due = new Date(med.firstDoseDue);
    const supplyAt = earliestSupply(matchAgent(med.name, formulary), facility, arrivalAt);
    if (supplyAt === null || supplyAt > due) risks.push({ med: med.name, due, supplyAt });
  }
  return risks;
}

/** True if any med's first dose is due before the earliest the facility can supply it. */
export const firstDoseAtRisk = (meds: Med[], facility: Facility, arrivalAt: Date, formulary: FormularyAgent[]): boolean =>
  firstDoseRisks(meds, facility, arrivalAt, formulary).length > 0;

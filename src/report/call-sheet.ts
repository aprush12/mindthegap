import type { Item } from "../engine/evaluate.js";
import type { PrioritySeverity } from "../engine/priority.js";
import type { ScreenResult } from "../engine/verdict.js";
import { FACILITY_IDS, type FacilityId } from "../policy/schema.js";

/** tonight/block/capability/clock as in the priorities, plus caution (packet gap) and review. */
export type CallSheetSeverity = PrioritySeverity | "caution" | "review";

export interface CallSheetEntry {
  /** Absent for facility-independent items (MEDREC:*, PKT-*): they are listed once, not per facility. */
  facilityId?: FacilityId;
  itemId: string;
  followUpAsk: string;
  severity: CallSheetSeverity;
}

const RANK: Record<CallSheetSeverity, number> = { tonight: 0, block: 1, capability: 2, clock: 3, caution: 4, review: 5 };

const sev = (i: Item, bucket: "block" | "clock" | "review"): CallSheetSeverity =>
  bucket === "block" ? (i.resolvable === "capability" ? "capability" : "block") : bucket;

/**
 * Flat list of every unresolved item with its ask for the discharging hospital: the input for the future voice
 * agent that works this list by phone. Facility-independent items first, then per facility; severity-ordered.
 */
export function buildCallSheet(result: ScreenResult): CallSheetEntry[] {
  const out: CallSheetEntry[] = [];
  for (const m of result.medRec ?? []) out.push({ itemId: m.id, followUpAsk: m.followUpAsk, severity: "tonight" });
  for (const g of result.packetGaps ?? []) out.push({ itemId: g.id, followUpAsk: g.followUpAsk, severity: "caution" });
  for (const id of FACILITY_IDS) {
    const f = result.facilities[id];
    const rows: [Item, CallSheetSeverity][] = [
      ...f.blocking.map((i): [Item, CallSheetSeverity] => [i, sev(i, "block")]),
      ...f.conditional.map((i): [Item, CallSheetSeverity] => [i, sev(i, "clock")]),
      ...f.review.map((i): [Item, CallSheetSeverity] => [i, sev(i, "review")]),
    ];
    for (const [i, severity] of rows) if (i.followUpAsk) out.push({ facilityId: id, itemId: i.ruleId, followUpAsk: i.followUpAsk, severity });
  }
  // stable: independent items stay ahead of facility items at equal severity
  return out.map((e, n) => ({ e, n })).sort((a, b) => RANK[a.e.severity] - RANK[b.e.severity] || a.n - b.n).map((x) => x.e);
}

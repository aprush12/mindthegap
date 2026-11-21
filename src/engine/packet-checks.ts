import type { Evidence, Extraction } from "../types.js";

/**
 * Packet-completeness checks: diagnosis-aware expectations evaluated against the packet itself, independent of
 * any facility. A failed check is a `PacketGap` (a caution under the monitoring criterion); it never changes a
 * facility verdict. Add a diagnosis -> expectation pair by appending to PACKET_CHECKS.
 */
export interface PacketGap {
  /** Check id, e.g. PKT-HF-WEIGHTS. */
  id: string;
  /** Plain-language one-liner for the card. */
  text: string;
  /** The one-sentence ask for the discharging hospital. */
  followUpAsk: string;
  /** Closest passages the model found (usually a narrative mention that is not an order). */
  evidence?: { quote: string; page?: number }[];
}

export interface PacketCheck {
  id: string;
  /** Does this expectation apply to this patient? */
  appliesWhen(ex: Extraction): boolean;
  /** What the packet should contain (for docs and tests). */
  expectation: string;
  /** true = the packet meets the expectation. Only called when appliesWhen is true. */
  check(ex: Extraction): boolean;
  severity: "caution";
  /** Gap text shown when the check fails. */
  gapText: string;
  /** Template for the hospital ask; a function when it needs extraction facts. */
  followUpAsk: string | ((ex: Extraction) => string);
}

const heartFailure = (ex: Extraction) => ex.patient.diagnoses?.heartFailure === true;
/** Without monitoringOrders (old record, or never extracted) we cannot tell, so the check does not fire. */
const hasOrders = (ex: Extraction) => ex.monitoringOrders !== undefined;

export const PACKET_CHECKS: PacketCheck[] = [
  {
    id: "PKT-HF-WEIGHTS",
    appliesWhen: (ex) => heartFailure(ex) && hasOrders(ex),
    expectation: "Heart failure: a daily-weights ORDER exists in the packet (narrative mention does not count).",
    check: (ex) => ex.monitoringOrders?.dailyWeightsOrdered === true,
    severity: "caution",
    gapText: "Heart failure, but no daily-weights order in the packet",
    followUpAsk: "Send the signed physician order for daily weights",
  },
  {
    id: "PKT-HF-PLAN",
    appliesWhen: (ex) => heartFailure(ex) && hasOrders(ex),
    expectation: "Heart failure: weight-gain escalation parameters exist (for example call the MD for a gain over a day or a week).",
    check: (ex) => ex.monitoringOrders?.weightEscalationPlan === true,
    severity: "caution",
    gapText: "Heart failure, but no weight-gain call parameters in the packet",
    followUpAsk: "Send the weight-gain escalation parameters: how much gain in a day or a week means call the physician",
  },
];

const toEvidence = (e: Evidence) => ({ quote: e.quote, ...(e.page !== undefined ? { page: e.page } : {}) });

/** Every applicable check the packet fails, in registry order. Pure. */
export function evaluatePacketChecks(ex: Extraction, checks: PacketCheck[] = PACKET_CHECKS): PacketGap[] {
  const gaps: PacketGap[] = [];
  for (const c of checks) {
    if (!c.appliesWhen(ex) || c.check(ex)) continue;
    const evidence = (ex.monitoringOrders?.evidence ?? []).slice(0, 2).map(toEvidence);
    gaps.push({
      id: c.id,
      text: c.gapText,
      followUpAsk: typeof c.followUpAsk === "function" ? c.followUpAsk(ex) : c.followUpAsk,
      ...(evidence.length ? { evidence } : {}),
    });
  }
  return gaps;
}

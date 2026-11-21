import { describe, expect, it } from "vitest";
import { evaluatePacketChecks, PACKET_CHECKS, type PacketCheck } from "../src/engine/packet-checks.js";
import { screen } from "../src/engine/verdict.js";
import { loadCapacity, loadPolicy } from "../src/policy/index.js";
import type { Extraction } from "../src/types.js";
import { elena, NOW } from "./fixtures/elena-mercado.js";
import { harold, HAROLD_NOW } from "./fixtures/harold-jennings.js";

const policy = loadPolicy();
const capacity = loadCapacity();
const base: Extraction = { answers: [], medications: [], timing: {}, patient: {} };
const hf = (mo?: Extraction["monitoringOrders"], heartFailure = true): Extraction => ({ ...base, patient: { diagnoses: { heartFailure } }, ...(mo ? { monitoringOrders: mo } : {}) });
const ev = [{ quote: "Daily weights", claimedPage: 3 }];

describe("packet-checks registry", () => {
  it("ships the two HF checks as cautions", () => {
    expect(PACKET_CHECKS.map((c) => c.id)).toEqual(["PKT-HF-WEIGHTS", "PKT-HF-PLAN"]);
    expect(PACKET_CHECKS.every((c) => c.severity === "caution" && c.expectation.length > 0)).toBe(true);
  });

  it("applies only to heart-failure patients", () => {
    for (const c of PACKET_CHECKS) {
      expect(c.appliesWhen(hf({ dailyWeightsOrdered: false, weightEscalationPlan: false, evidence: [] }))).toBe(true);
      expect(c.appliesWhen(hf({ dailyWeightsOrdered: false, weightEscalationPlan: false, evidence: [] }, false))).toBe(false);
      expect(c.appliesWhen({ ...base, monitoringOrders: { dailyWeightsOrdered: false, weightEscalationPlan: false, evidence: [] } })).toBe(false);
    }
  });

  it("passes when weights are ordered and an escalation plan exists", () => {
    expect(evaluatePacketChecks(hf({ dailyWeightsOrdered: true, weightEscalationPlan: true, evidence: ev }))).toEqual([]);
  });

  it("fails each check independently, with a follow-up ask and the closest evidence", () => {
    const onlyWeights = evaluatePacketChecks(hf({ dailyWeightsOrdered: true, weightEscalationPlan: false, evidence: ev }));
    expect(onlyWeights.map((g) => g.id)).toEqual(["PKT-HF-PLAN"]);
    const onlyPlan = evaluatePacketChecks(hf({ dailyWeightsOrdered: false, weightEscalationPlan: true, evidence: ev }));
    expect(onlyPlan.map((g) => g.id)).toEqual(["PKT-HF-WEIGHTS"]);
    const both = evaluatePacketChecks(hf({ dailyWeightsOrdered: false, weightEscalationPlan: false, evidence: ev }));
    expect(both.map((g) => g.id)).toEqual(["PKT-HF-WEIGHTS", "PKT-HF-PLAN"]);
    for (const g of both) {
      expect(g.followUpAsk.length).toBeGreaterThan(10);
      expect(g.evidence).toEqual([{ quote: "Daily weights" }]);
      expect(g.text + g.followUpAsk).not.toMatch(/\d{4}-\d{2}-\d{2}|T\d{2}:/);
    }
  });

  it("does not fire when monitoringOrders was never extracted (old records)", () => {
    expect(evaluatePacketChecks(hf(undefined))).toEqual([]);
  });

  it("is extensible: a custom registry entry is evaluated", () => {
    const custom: PacketCheck = { id: "PKT-X", appliesWhen: () => true, expectation: "x", check: () => false, severity: "caution", gapText: "gap", followUpAsk: (ex) => `ask ${ex.medications.length}` };
    expect(evaluatePacketChecks(base, [custom])).toEqual([{ id: "PKT-X", text: "gap", followUpAsk: "ask 0" }]);
  });
});

describe("packet gaps on the fixtures", () => {
  it("Elena (HF, weights only in narrative): both gaps; Harold (weights + escalation ordered): none", () => {
    expect(screen(elena, policy, capacity, NOW).packetGaps.map((g) => g.id)).toEqual(["PKT-HF-WEIGHTS", "PKT-HF-PLAN"]);
    expect(screen(harold, policy, capacity, HAROLD_NOW).packetGaps).toEqual([]);
  });

  it("never change a verdict or any facility's item lists", () => {
    const stripped: Extraction = { ...elena, patient: { ...elena.patient, diagnoses: undefined }, monitoringOrders: undefined };
    const a = screen(elena, policy, capacity, NOW);
    const b = screen(stripped, policy, capacity, NOW);
    expect(b.packetGaps).toEqual([]);
    for (const f of ["A", "B", "C"] as const) {
      expect(a.facilities[f].verdict).toBe(b.facilities[f].verdict);
      expect(a.facilities[f].blocking.map((i) => i.ruleId)).toEqual(b.facilities[f].blocking.map((i) => i.ruleId));
      expect(a.facilities[f].conditional.map((i) => i.ruleId)).toEqual(b.facilities[f].conditional.map((i) => i.ruleId));
    }
    expect(a.criteriaView.monitoring_transitions.A.worstState).toBe(b.criteriaView.monitoring_transitions.A.worstState);
    expect(a.criteriaView.monitoring_transitions.A.flags?.map((x) => x.chip)).toEqual(["PACKET GAP", "PACKET GAP"]);
  });
});

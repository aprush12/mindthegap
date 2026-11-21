import { describe, expect, it } from "vitest";
import { buildMedRec } from "../src/engine/medrec.js";
import { prioritizeAll } from "../src/engine/priority.js";
import { screen } from "../src/engine/verdict.js";
import { deterministicHeadline, validateHeadline, type HeadlineOutput } from "../src/pipeline/headline.js";
import { loadCapacity, loadPolicy } from "../src/policy/index.js";
import type { Extraction } from "../src/types.js";
import { elena, NOW } from "./fixtures/elena-mercado.js";
import { harold, HAROLD_NOW } from "./fixtures/harold-jennings.js";

const policy = loadPolicy();
const capacity = loadCapacity();
const strip = (ex: Extraction): Extraction => ({ ...ex, medications: ex.medications.map(({ doseChanges: _d, ...m }) => m) });
const IDS = ["A", "B", "C"] as const;

describe("medication reconciliation (MEDREC)", () => {
  const items = buildMedRec(harold);

  it("builds one facility-independent item per med with a dose change", () => {
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("MEDREC:torsemide");
    expect(items[0].text).toBe("Torsemide dose conflict: discharge list says 40 mg, last progress note says 60 mg — confirm before first dose");
    expect(items[0].followUpAsk).toBe("Confirm current torsemide dose: discharge list 40 mg vs 17 Nov cardiology progress note 60 mg");
    expect(items[0].evidence).toEqual([{ quote: "Torsemide 40 mg", page: 21 }, { quote: "increased torsemide to 60 mg daily", page: 11 }]);
  });

  it("Elena has no dose change", () => {
    expect(buildMedRec(elena)).toEqual([]);
    expect(screen(elena, policy, capacity, NOW).medRec).toEqual([]);
    for (const f of IDS) expect(prioritizeAll(screen(elena, policy, capacity, NOW), elena, NOW)[f].some((c) => c.id.startsWith("MEDREC:"))).toBe(false);
  });

  it("is a tier-1 tonight candidate at every Harold facility, with its ask", () => {
    const p = prioritizeAll(screen(harold, policy, capacity, HAROLD_NOW), harold, HAROLD_NOW);
    for (const f of IDS) {
      const c = p[f].find((x) => x.id === "MEDREC:torsemide")!;
      expect(c).toMatchObject({ tier: 1, severity: "tonight", followUpAsk: items[0].followUpAsk });
      expect(c.text).not.toMatch(/\d{4}-\d{2}-\d{2}|T\d{2}:|\dZ\b/);
    }
  });

  it("never changes a verdict or any item list (both fixtures)", () => {
    for (const [ex, now] of [[harold, HAROLD_NOW], [elena, NOW]] as const) {
      const a = screen(ex, policy, capacity, now);
      const b = screen(strip(ex), policy, capacity, now);
      for (const f of IDS) {
        expect(a.facilities[f].verdict).toBe(b.facilities[f].verdict);
        for (const k of ["blocking", "conditional", "review"] as const) expect(a.facilities[f][k].map((i) => i.ruleId)).toEqual(b.facilities[f][k].map((i) => i.ruleId));
      }
      for (const c of Object.keys(a.criteriaView) as (keyof typeof a.criteriaView)[]) for (const f of IDS) expect(a.criteriaView[c][f].worstState).toBe(b.criteriaView[c][f].worstState);
    }
  });

  it("Harold verdicts stay A decline / B conditional / C decline and the item sits under pharmacy_operations", () => {
    const r = screen(harold, policy, capacity, HAROLD_NOW);
    expect(IDS.map((f) => r.facilities[f].verdict)).toEqual(["decline", "conditional_accept", "decline"]);
    expect(r.criteriaView.pharmacy_operations.B.flags).toMatchObject([{ id: "MEDREC:torsemide", chip: "CONFIRM DOSE" }]);
    expect(r.criteriaView.regulatory_screens.B.flags).toBeUndefined();
  });

  it("a model headline cannot drop the dose conflict", () => {
    const r = screen(harold, policy, capacity, HAROLD_NOW);
    const p = prioritizeAll(r, harold, HAROLD_NOW);
    const f = (id: string) => ({ headline: "h", topPriorities: [{ text: "Get telemetry", ruleIds: [id], severity: "block" as const }] });
    const out: HeadlineOutput = { patientSnapshot: "s", perFacility: { A: f("MON-03"), B: f("RX-03"), C: f("MON-03") } };
    const { headline } = validateHeadline(out, p);
    for (const id of IDS) {
      const first = headline.perFacility[id].topPriorities[0];
      expect(first.ruleIds).toEqual(["MEDREC:torsemide"]);
      expect(first.followUpAsk).toBe(items[0].followUpAsk);
    }
    // model text is kept, but followUpAsk of a cited rule stays the deterministic one
    expect(headline.perFacility.B.topPriorities[1].followUpAsk).toBe(p.B.find((c) => c.id === "RX-03")!.followUpAsk);
  });

  it("deterministic headline carries the ask on top priorities", () => {
    const r = screen(harold, policy, capacity, HAROLD_NOW);
    const h = deterministicHeadline(harold, r, prioritizeAll(r, harold, HAROLD_NOW));
    for (const id of IDS) expect(h.perFacility[id].topPriorities.every((t) => !!t.followUpAsk)).toBe(true);
  });
});

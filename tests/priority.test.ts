import { describe, expect, it } from "vitest";
import { prioritize, prioritizeAll } from "../src/engine/priority.js";
import { screen } from "../src/engine/verdict.js";
import { loadCapacity, loadPolicy } from "../src/policy/index.js";
import { NOW, elena } from "./fixtures/elena-mercado.js";

const result = screen(elena, loadPolicy(), loadCapacity(), NOW);
const p = prioritizeAll(result, elena, NOW);
const ids = (f: "A" | "B" | "C", n = 10) => p[f].slice(0, n).map((c) => c.id);

describe("prioritize (Elena)", () => {
  it("Bayview's top candidates include the three that bite tonight and the three blocks", () => {
    const top = ids("A");
    for (const id of ["ACU-06", "RX-05", "RX-02", "PAY-01", "REG-01", "INF-01"]) expect(top).toContain(id);
    expect(p.A.find((c) => c.id === "RX-05")!.text).toBe("Get an interchange order: glargine → detemir (facility doesn't stock glargine)");
    expect(p.A.find((c) => c.id === "RX-02")!.severity).toBe("tonight");
  });

  it("orders tonight, then blocks, then clocks, then review", () => {
    const tiers = p.A.map((c) => c.tier);
    expect(tiers).toEqual([...tiers].sort((a, b) => a - b));
    expect(p.A[0].tier).toBe(1);
    expect(p.A.at(-1)!.tier).toBe(7);
    // tonight items are sorted by their due time
    const due = p.A.filter((c) => c.tier === 1).map((c) => new Date(c.dueBy!).getTime());
    expect(due).toEqual([...due].sort((a, b) => a - b));
  });

  it("writes one-line plain-language text: no ISO timestamps, no rule-question echo, med detail kept out", () => {
    for (const f of ["A", "B", "C"] as const) {
      for (const c of p[f]) {
        expect(c.text).not.toMatch(/\d{4}-\d{2}-\d{2}|T\d{2}:|\dZ\b/);
        expect(c.text).not.toContain("(not met");
        expect(c.text).not.toContain("medication(s)");
        expect(c.text.length).toBeLessThan(110);
      }
    }
    expect(p.A.find((c) => c.id === "RX-02")!.text).toMatch(/^First doses at risk.*past pharmacy cutoff.*worst: Entresto, needs 72-hr exception/);
    expect(p.A.find((c) => c.id === "ACU-06")!.text).toContain("obtain before first meal");
    expect(p.A.find((c) => c.id === "RX-06")!.text).toBe("Physician orders are unsigned; chase the hospital for signatures");
    expect(p.A.find((c) => c.id === "PAY-01")!.text).toBe("Insurance authorization still pending");
    expect(p.A.find((c) => c.id === "REG-01")!.text).toBe("PASRR screening missing from the packet");
    expect(p.A.find((c) => c.id === "INF-01")!.text).toBe("No MDRO/isolation status anywhere in the packet");
  });

  it("states capability gaps for Maple Grove, not the rule question", () => {
    expect(p.C[0].text).toBe("This facility cannot manage sliding-scale insulin overnight (RN leaves at 11 PM)");
    expect(p.C[1].text).toMatch(/^Pharmacy can't get first doses here in time/);
  });

  it("lists each rule once", () => {
    for (const f of ["A", "B", "C"] as const) expect(new Set(ids(f, 99)).size).toBe(p[f].length);
  });

  it("puts a pre-arrival block ahead of other blocks (Harborview RX-06)", () => {
    const top = ids("B");
    expect(top.indexOf("RX-06")).toBeLessThan(top.indexOf("PAY-01"));
  });

  it("Maple Grove (decline) leads with its capability blocks", () => {
    expect(result.facilities.C.verdict).toBe("decline");
    expect(p.C.slice(0, 2).map((c) => [c.id, c.severity])).toEqual([["ACU-06", "capability"], ["RX-02", "capability"]]);
  });

  it("a conditional resolving beyond 12h is a clock item, not tonight", () => {
    const pay04 = p.A.find((c) => c.id === "PAY-04")!;
    expect(pay04.severity).toBe("clock");
    expect(pay04.dueBy).toBe(result.facilities.A.conditional.find((i) => i.ruleId === "PAY-04")!.resolveBy);
  });

  it("adds a FORMULARY:<agent> candidate for an at-risk med whose rule item is not itself tonight", () => {
    const ent = p.A.find((c) => c.id.startsWith("FORMULARY:") && c.id.includes("sacubitril"));
    expect(ent).toBeUndefined(); // RX-01 is already tonight at Bayview via the first-dose clock
    expect(prioritize(result.facilities.A, elena, NOW).find((c) => c.id === "RX-01")!.dueBy).toBe(new Date("2026-11-18T08:00:00").toISOString());
  });
});

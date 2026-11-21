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
    expect(p.A.find((c) => c.id === "RX-05")!.text).toContain("insulin detemir");
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

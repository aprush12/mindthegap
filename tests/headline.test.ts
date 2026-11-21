import { describe, expect, it } from "vitest";
import { prioritizeAll } from "../src/engine/priority.js";
import { screen } from "../src/engine/verdict.js";
import { buildDigest, buildHeadline, deterministicHeadline, validateHeadline, type HeadlineOutput } from "../src/pipeline/headline.js";
import type { Llm } from "../src/pipeline/anthropic.js";
import { loadCapacity, loadPolicy } from "../src/policy/index.js";
import { NOW, elena } from "./fixtures/elena-mercado.js";

const result = screen(elena, loadPolicy(), loadCapacity(), NOW);
const pri = prioritizeAll(result, elena, NOW);
const fac = (ruleIds: string[]) => ({
  headline: "Conditional accept: items outstanding.",
  topPriorities: [{ text: "Obtain the insulin correction scale before the first meal", ruleIds, severity: "tonight" as const, dueBy: "1999-01-01T00:00:00Z" }],
});
const out = (a: string[], b = ["ACU-06"], c = ["ACU-06"]): HeadlineOutput => ({ patientSnapshot: "Needs insulin.", perFacility: { A: fac(a), B: fac(b), C: fac(c) } });

describe("validateHeadline", () => {
  it("drops entries that cite unknown rule ids and counts them", () => {
    const o = out(["ACU-06"], ["NOPE-99"], ["ACU-06", "FAKE-1"]);
    const { headline } = validateHeadline(o, pri);
    expect(headline.droppedUngrounded).toBe(2);
    expect(headline.perFacility.A.topPriorities).toHaveLength(1);
    expect(headline.perFacility.B.topPriorities).toHaveLength(0);
    expect(headline.perFacility.C.topPriorities).toHaveLength(0);
  });

  it("drops entries with no citation, and takes dueBy from the cited candidate not the model", () => {
    const { headline } = validateHeadline(out([]), pri);
    expect(headline.droppedUngrounded).toBe(1);
    const ok = validateHeadline(out(["ACU-06"]), pri).headline.perFacility.A.topPriorities[0];
    expect(ok.dueBy).toBe(pri.A.find((c) => c.id === "ACU-06")!.dueBy);
  });

  it("only accepts ids among the top candidates sent for that facility", () => {
    const unsent = pri.A[12].id;
    expect(validateHeadline(out([unsent]), pri).dropped).toBeGreaterThanOrEqual(1);
  });
});

describe("buildHeadline", () => {
  it("uses the model output when grounded", async () => {
    const llm: Llm = { parse: async () => out(["ACU-06"], ["ACU-06"], ["ACU-06"]) as never };
    const h = await buildHeadline(llm, elena, result, NOW, pri);
    expect(h.source).toBe("model");
    expect(h.droppedUngrounded).toBe(0);
  });

  it("sends a PDF-free digest with candidate ids", async () => {
    let req: { pdfBase64?: string; instruction: string; label: string } | undefined;
    const llm: Llm = { parse: async (r) => { req = r as never; return out(["ACU-06"]) as never; } };
    await buildHeadline(llm, elena, result, NOW, pri);
    expect(req!.pdfBase64).toBeUndefined();
    expect(req!.label).toBe("headline");
    expect(req!.instruction).toContain('"id":"RX-02"');
    expect(Object.keys(buildDigest(elena, result, pri).facilities)).toEqual(["A", "B", "C"]);
  });

  it("falls back to the deterministic shape when the call throws", async () => {
    const llm: Llm = { parse: async () => { throw new Error("boom"); } };
    const h = await buildHeadline(llm, elena, result, NOW, pri);
    expect(h.source).toBe("deterministic");
    expect(h).toEqual(deterministicHeadline(elena, result, pri));
    for (const id of ["A", "B", "C"] as const) {
      expect(h.perFacility[id].headline.length).toBeGreaterThan(0);
      expect(h.perFacility[id].topPriorities.length).toBeGreaterThanOrEqual(3);
      expect(h.perFacility[id].topPriorities.length).toBeLessThanOrEqual(6);
      for (const t of h.perFacility[id].topPriorities) expect(pri[id].map((c) => c.id)).toEqual(expect.arrayContaining(t.ruleIds));
    }
    expect(h.perFacility.A.topPriorities[0]).toMatchObject({ severity: "tonight", ruleIds: ["RX-02"] });
  });

  it("falls back when there is no llm or the reply is malformed", async () => {
    expect((await buildHeadline(undefined, elena, result, NOW, pri)).source).toBe("deterministic");
    const bad: Llm = { parse: async () => ({ answers: [] }) as never };
    expect((await buildHeadline(bad, elena, result, NOW, pri)).source).toBe("deterministic");
  });

  it("uses deterministic priorities for a facility whose entries were all ungrounded", async () => {
    const llm: Llm = { parse: async () => out(["ACU-06"], ["NOPE"], ["ACU-06"]) as never };
    const h = await buildHeadline(llm, elena, result, NOW, pri);
    expect(h.source).toBe("model");
    expect(h.droppedUngrounded).toBe(1);
    expect(h.perFacility.B.topPriorities.length).toBeGreaterThanOrEqual(3);
  });
});

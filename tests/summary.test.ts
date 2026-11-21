import { describe, expect, it } from "vitest";
import { screen } from "../src/engine/verdict.js";
import { loadCapacity, loadPolicy } from "../src/policy/index.js";
import { renderSummary, renderTextTable } from "../src/report/summary.js";
import { ARRIVAL, NOW, elena } from "./fixtures/elena-mercado.js";

const result = screen(elena, loadPolicy(), loadCapacity(), NOW);
const input = { parseId: "parse-123", arrivalAt: ARRIVAL, evaluatedAt: NOW.toISOString(), result, facilityNames: { A: "Bayview", B: "Harborview", C: "Maple Grove" } };

describe("renderSummary", () => {
  const html = renderSummary(input);

  it("is self-contained and print-styled", () => {
    expect(html).toContain("@media print");
    expect(html).toContain("break-before:page");
    expect(html).not.toMatch(/(src|href)=["']https?:/);
    expect(html).not.toMatch(/<link\b/);
  });

  it("shows header, the verdict table and per-facility counts", () => {
    expect(html).toContain("parse-123");
    expect(html).toContain("17 Nov 2026 20:40");
    for (const n of ["Bayview", "Harborview", "Maple Grove", "First dose at risk", "Items on a clock", "Blocking items"]) expect(html).toContain(n);
    for (const f of Object.values(result.facilities)) {
      expect(html).toContain(`Blocking items (${f.blocking.length})`);
      expect(html).toContain(`Items on a clock (${f.conditional.length})`);
    }
  });

  it("lists blocking items with rule id, question and evidence page, and unknowns as such", () => {
    expect(html).toContain("PAY-01");
    expect(html).toContain("Authorization pending with payor");
    expect(html).toContain("(page 4)");
    expect(html).toContain("REG-01");
    expect(html).toContain("No supporting passage in the record.");
  });

  it("shows resolveBy for conditional items", () => {
    const first = result.facilities.A.conditional.find((i) => i.resolveBy)!;
    expect(html).toContain("Resolve by");
    expect(html).toContain(first.ruleId);
  });

  it("renders the 8-row criteria grid", () => {
    expect(html).toContain("Criteria view");
    for (const c of ["Regulatory screens", "Acuity vs staffing", "Infection control", "Pharmacy operations", "Skin and wounds", "Therapy", "Nutrition and swallowing", "Monitoring and transitions"]) expect(html).toContain(c);
  });

  it("visibly marks unverified quotes and escapes HTML", () => {
    const bad = structuredClone(result);
    const item = bad.facilities.A.blocking[0];
    item.evidence = [{ quote: "<script>x</script> made up", claimedPage: 7, verified: false }];
    const out = renderSummary({ ...input, result: bad });
    expect(out).toContain("UNVERIFIED");
    expect(out).toContain("model cited page 7");
    expect(out).not.toContain("<script>x</script>");
    expect(out).toContain("&lt;script&gt;");
  });
});

describe("renderTextTable", () => {
  it("prints the verdict table", () => {
    const t = renderTextTable(input);
    expect(t).toContain("Verdict");
    expect(t).toContain("Bayview");
    expect(t.split("\n")).toHaveLength(5);
  });
});

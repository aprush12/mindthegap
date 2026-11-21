import { describe, expect, it } from "vitest";
import { screen } from "../src/engine/verdict.js";
import { loadCapacity, loadPolicy } from "../src/policy/index.js";
import { prioritizeAll } from "../src/engine/priority.js";
import { deterministicHeadline } from "../src/pipeline/headline.js";
import { fmtTime, renderSummary, renderTextTable } from "../src/report/summary.js";
import { ARRIVAL, NOW, elena } from "./fixtures/elena-mercado.js";

const result = screen(elena, loadPolicy(), loadCapacity(), NOW);
const headline = deterministicHeadline(elena, result, prioritizeAll(result, elena, NOW));
const input = { parseId: "parse-123", arrivalAt: ARRIVAL, evaluatedAt: NOW.toISOString(), result, headline, facilityNames: { A: "Bayview", B: "Harborview", C: "Maple Grove" } };

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
    expect(html).toContain("Page 4");
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

describe("What matters most", () => {
  const html = renderSummary(input);
  it("is the first section, above the verdict table and the checklist", () => {
    expect(html).toContain("What matters most");
    expect(html.indexOf("What matters most")).toBeLessThan(html.indexOf("<h3>Verdicts</h3>"));
    expect(html.indexOf("What matters most")).toBeLessThan(html.indexOf("Blocking items ("));
    expect(html).toContain(headline.patientSnapshot);
  });
  it("shows a tonight-severity item with its due-by time", () => {
    expect(html).toContain("pri sev-tonight");
    expect(html).toContain("by tonight 9:00 PM");
    expect(html).toContain("by tomorrow 8:00 AM");
    expect(html).toContain("before first meal");
  });
  it("is omitted when there is no headline", () => {
    expect(renderSummary({ ...input, headline: undefined })).not.toContain("What matters most");
  });
  it("prints top priorities per facility in the CLI table", () => {
    const t = renderTextTable(input);
    expect(t).toContain("What matters most");
    expect(t).toContain("[TONIGHT]");
    expect(t).toContain("(by tonight 9:00 PM)");
    expect(t).toContain("[CAN'T DO HERE]");
    expect(t).toContain("[BLOCKED]");
  });
  it("renders big verdict badges, chips and a collapsed medication timing detail per facility", () => {
    expect(html).toContain('class="badge b-conditional_accept"');
    expect(html).toContain("Yes, if…");
    expect(html).toContain('<span class="chip c-cap">Can\'t do here</span>');
    expect(html).toContain("<details class=\"meddetail\"><summary>Medication timing detail</summary>");
    expect((html.match(/<details class="meddetail">/g) ?? []).length).toBe(3);
    expect(html).not.toContain("<details open");
    expect(html).toContain("won&#39;t arrive until");
    expect(html).toContain("Entresto");
    expect(html.indexOf("Medication timing detail")).toBeGreaterThan(html.indexOf("Blocking items ("));
  });
  it("puts the snapshot first and the cards before everything else", () => {
    expect(html.indexOf(headline.patientSnapshot)).toBeLessThan(html.indexOf('class="card '));
    expect(headline.patientSnapshot).toBe("Heart failure, Insulin-dependent, Wound care needed, 7 discharge medications, 71.4 kg, Referred for complex medical care");
    // shown as one chip per fact
    expect(html).toContain("<li>Heart failure</li><li>Insulin-dependent</li>");
  });
  it("never shows ISO/UTC timestamps in the page or the text table", () => {
    const t = renderTextTable(input);
    for (const out of [html, t]) {
      expect(out).not.toMatch(/T\d{2}:/);
      expect(out).not.toMatch(/Z"/);
      expect(out).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
      expect(out).not.toMatch(/\d{2}:\d{2}:\d{2}/);
    }
  });
  it("keeps text-table priority lines short and capped at six per facility", () => {
    const lines = renderTextTable(input).split("\n").filter((l) => /^\s+\d\. \[/.test(l));
    expect(lines).toHaveLength(18);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(125);
  });
});

describe("renderTextTable", () => {
  it("prints the verdict table", () => {
    const t = renderTextTable({ ...input, headline: undefined });
    expect(t).toContain("Verdict");
    expect(t).toContain("Bayview");
    expect(t.split("\n")).toHaveLength(5);
  });
});

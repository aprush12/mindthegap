import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prioritizeAll } from "../src/engine/priority.js";
import { screen } from "../src/engine/verdict.js";
import { loadCapacity, loadPolicy } from "../src/policy/index.js";
import { deterministicHeadline } from "../src/pipeline/headline.js";
import type { ParseRecord } from "../src/pipeline/run.js";
import { buildCallSheet } from "../src/report/call-sheet.js";
import { renderSummary, renderTextTable } from "../src/report/summary.js";
import { saveFile } from "../src/store.js";
import { ARRIVAL, NOW, elena } from "./fixtures/elena-mercado.js";
import { HAROLD_ARRIVAL, HAROLD_NOW, harold } from "./fixtures/harold-jennings.js";

const policy = loadPolicy();
const capacity = loadCapacity();
const IDS = ["A", "B", "C"] as const;
const NAMES = { A: "Bayview", B: "Harborview", C: "Maple Grove" };
const ISO = /\d{4}-\d{2}-\d{2}|T\d{2}:\d{2}|\d{2}:\d{2}:\d{2}/;

const cases = [
  { name: "Elena", ex: elena, now: NOW, arrival: ARRIVAL },
  { name: "Harold", ex: harold, now: HAROLD_NOW, arrival: HAROLD_ARRIVAL },
];

describe.each(cases)("followUpAsk ($name)", ({ ex, now }) => {
  const result = screen(ex, policy, capacity, now);
  const p = prioritizeAll(result, ex, now);

  it("is on every blocking, conditional and review item, as one plain sentence", () => {
    for (const f of IDS) {
      for (const i of [...result.facilities[f].blocking, ...result.facilities[f].conditional, ...result.facilities[f].review]) {
        expect(i.followUpAsk, `${f} ${i.ruleId}`).toBeTruthy();
        expect(i.followUpAsk).not.toMatch(ISO);
        expect(i.followUpAsk!.length).toBeLessThan(160);
        expect(i.followUpAsk).not.toMatch(/\.\s+\S/); // one sentence
      }
    }
  });

  it("flows to every priority candidate and top priority", () => {
    const h = deterministicHeadline(ex, result, p);
    for (const f of IDS) {
      expect(p[f].every((c) => !!c.followUpAsk)).toBe(true);
      expect(h.perFacility[f].topPriorities.every((t) => !!t.followUpAsk)).toBe(true);
    }
  });
});

describe("followUpAsk templates", () => {
  const r = screen(elena, policy, capacity, NOW);
  const ask = (f: "A" | "B" | "C", id: string) => [...r.facilities[f].blocking, ...r.facilities[f].conditional].find((i) => i.ruleId === id)!.followUpAsk;
  it("uses the per-rule-family wording", () => {
    expect(ask("A", "REG-01")).toBe("Fax the PASRR Level I determination");
    expect(ask("B", "RX-06")).toBe("Send the signed physician order set");
    expect(ask("A", "RX-05")).toMatch(/^Ask the prescriber for an interchange order: glargine → detemir/);
    expect(ask("C", "ACU-06")).toMatch(/^Ask the prescriber whether a simpler insulin plan/);
  });
});

describe("call sheet", () => {
  const result = screen(harold, policy, capacity, HAROLD_NOW);
  const sheet = buildCallSheet(result);
  it("lists facility-independent items once and facility items per facility, severity first", () => {
    expect(sheet[0]).toEqual({ itemId: "MEDREC:torsemide", severity: "tonight", followUpAsk: expect.stringContaining("Confirm current torsemide dose") });
    expect(sheet.filter((e) => e.itemId.startsWith("MEDREC:"))).toHaveLength(1);
    expect(sheet.filter((e) => !e.facilityId).every((e) => e.itemId.startsWith("MEDREC:") || e.itemId.startsWith("PKT-"))).toBe(true);
    expect(sheet.find((e) => e.facilityId === "A" && e.itemId === "MON-03")!.severity).toBe("capability");
    expect(sheet.find((e) => e.facilityId === "B" && e.itemId === "FUP-01")!.severity).toBe("clock");
    expect(sheet.every((e) => e.followUpAsk)).toBe(true);
  });
  it("Elena's sheet carries the two packet gaps as cautions", () => {
    const s = buildCallSheet(screen(elena, policy, capacity, NOW));
    expect(s.filter((e) => e.severity === "caution").map((e) => e.itemId)).toEqual(["PKT-HF-WEIGHTS", "PKT-HF-PLAN"]);
  });
});

describe("GET /api/parses/:id/call-sheet", () => {
  beforeEach(() => { process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "mtg-cs-")); });
  const app = createApp();
  it("serves the flat list for a complete parse; 404 unknown; 409 while processing", async () => {
    const result = screen(harold, policy, capacity, HAROLD_NOW);
    const rec: ParseRecord = { parseId: "cs1", status: "complete", createdAt: "x", result, extraction: harold };
    await saveFile("cs1", "result.json", rec);
    await saveFile("cs2", "result.json", { parseId: "cs2", status: "processing", createdAt: "x" });
    const res = await app.request("/api/parses/cs1/call-sheet");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { itemId: string; followUpAsk: string; severity: string; facilityId?: string }[];
    expect(body).toEqual(buildCallSheet(result));
    expect(body.some((e) => e.itemId === "MEDREC:torsemide" && e.facilityId === undefined)).toBe(true);
    expect((await app.request("/api/parses/nope/call-sheet")).status).toBe(404);
    expect((await app.request("/api/parses/cs2/call-sheet")).status).toBe(409);
  });
});

describe("summary rendering of the new items", () => {
  const render = ({ ex, now, arrival }: (typeof cases)[number]) => {
    const result = screen(ex, policy, capacity, now);
    const input = { parseId: "p", arrivalAt: arrival, evaluatedAt: now.toISOString(), result, headline: deterministicHeadline(ex, result, prioritizeAll(result, ex, now)), facilityNames: NAMES };
    return { html: renderSummary(input), text: renderTextTable(input) };
  };
  const h = render(cases[1]);
  const e = render(cases[0]);

  it("Harold: CONFIRM DOSE chip with the conflict and an Ask line; no packet gaps", () => {
    expect(h.html).toContain("CONFIRM DOSE");
    expect(h.html).toContain("Torsemide dose conflict: discharge list says 40 mg, last progress note says 60 mg");
    expect(h.html).toContain('<div class="ask">Ask: Confirm current torsemide dose');
    expect(h.html).not.toContain("PACKET GAP");
    expect(h.text).toContain("[CONFIRM DOSE] Torsemide dose conflict");
  });
  it("Elena: PACKET GAP chip on each card, in the criteria grid and the text table; no CONFIRM DOSE", () => {
    expect(e.html).not.toContain("CONFIRM DOSE");
    expect((e.html.match(/<h4>Packet gaps<\/h4>/g) ?? []).length).toBe(3);
    expect(e.html).toContain("Heart failure, but no daily-weights order in the packet");
    expect(e.html).toContain("Ask: Send the signed physician order for daily weights");
    expect(e.html).toContain('<div class="cflag">');
    expect((e.text.match(/\[PACKET GAP\]/g) ?? []).length).toBe(6);
    expect(e.html.indexOf("<h4>Packet gaps</h4>")).toBeGreaterThan(e.html.indexOf("</ol>"));
  });
  it("leaks no ISO timestamps", () => {
    for (const out of [h.html, h.text, e.html, e.text]) expect(out).not.toMatch(/\d{4}-\d{2}-\d{2}T|T\d{2}:\d{2}|\d{2}:\d{2}:\d{2}/);
  });
  it("renders old records (no packetGaps / followUpAsk) without crashing", () => {
    const result = screen(elena, policy, capacity, NOW);
    const old = { ...result, packetGaps: undefined as never, medRec: undefined as never };
    expect(() => renderSummary({ parseId: "p", result: old, facilityNames: NAMES })).not.toThrow();
    expect(buildCallSheet(old).length).toBeGreaterThan(0);
  });
});

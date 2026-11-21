import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createLlm, stripNewlines, type Llm, type LlmRequest } from "../src/pipeline/anthropic.js";
import { COMPUTED_RULES, CategoryResultSchema, FactsResultSchema } from "../src/pipeline/extraction.js";
import { createRecord, runPipeline, type ParseRecord } from "../src/pipeline/run.js";
import { loadFile } from "../src/store.js";
import type { ScreenResult } from "../src/engine/verdict.js";
import { makePdf } from "./fixtures/make-pdf.js";

const PDF = makePdf([
  ["Face sheet. Riverside General.", "Discharged 17 Nov 18:42, arriving 20:40."],
  ["Hospital course: heart failure.", "No tracheostomy. Not on a ventilator."],
  ["Authorization pending with payor"],
  ["Stage 2 sacral pressure injury", "Weight 71.4 kg"],
]);

const calls: LlmRequest<unknown>[] = [];

const fakeLlm: Llm = {
  async parse<T>(req: LlmRequest<T>): Promise<T> {
    calls.push(req as LlmRequest<unknown>);
    if (req.label === "document-map") {
      return { sections: [{ id: "face", title: "Face sheet", startPage: 1, endPage: 2 }, { id: "nursing", title: "Nursing", startPage: 3, endPage: 4 }] } as T;
    }
    if (req.label === "facts") {
      return FactsResultSchema.parse({
        timing: { dischargeAt: "2026-11-17T18:42:00", arrivalAt: "2026-11-17T20:40:00" },
        patient: { targetUnit: "complex_medical", medicaidPending: false, tubeFed: false, insulinRequired: false, weightKg: 71.4, ventDependent: false, trach: false, dialysis: false, elopementRisk: false },
        medications: [{ name: "Furosemide 40 mg", dose: "40 mg", route: "PO", schedule: "daily", firstDoseDue: "2026-11-18T08:00:00", controlled: false, hardCopyPresent: null, correctionScale: null, quote: "heart failure", page: 2 }],
        rx06: { ruleId: "RX-06", answered: false, fields: [], evidence: [], contradictions: [] },
      }) as T;
    }
    const cat = req.label.replace("category-", "");
    const answers: unknown[] = [];
    if (cat === "PAY") {
      answers.push({ ruleId: "PAY-01", answered: true, fields: [{ name: "status", value: "pending" }], evidence: [{ quote: "Authorization pending with payor", page: 1 }], contradictions: [] });
    }
    if (cat === "ACU") {
      answers.push({ ruleId: "ACU-02", answered: true, fields: [{ name: "present", value: false }], evidence: [{ quote: "No tracheostomy.", page: 2 }], contradictions: [] });
      // fabricated quote must come back unverified, not guessed
      answers.push({ ruleId: "ACU-01", answered: true, fields: [{ name: "present", value: false }], evidence: [{ quote: "Patient breathes room air unassisted", page: 2 }], contradictions: [] });
      answers.push({ ruleId: "ACU-09", answered: true, fields: [{ name: "weightKg", value: 71.4 }], evidence: [{ quote: "Weight 71.4 kg", page: 2 }], contradictions: [] });
    }
    if (cat === "SKN") {
      answers.push({
        ruleId: "SKN-01", answered: true, fields: [{ name: "present", value: true }, { name: "stage", value: true }],
        evidence: [{ quote: "Stage 2 sacral pressure injury", page: 4 }],
        contradictions: [{ quoteA: "Stage 2 sacral pressure injury", pageA: 4, quoteB: "Stage 3 sacral wound", pageB: 1, note: "stage differs" }],
      });
    }
    return CategoryResultSchema.parse({ answers }) as T;
  },
};

beforeEach(() => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "mtg-pipe-"));
  calls.length = 0;
});

describe("pipeline", () => {
  it("runs end-to-end with a mocked client, anchors evidence and stores a ScreenResult", async () => {
    await createRecord("p1");
    const rec = await runPipeline({ parseId: "p1", pdf: PDF, llm: fakeLlm });
    expect(rec.status).toBe("complete");

    const stored = await loadFile<ParseRecord>("p1", "result.json");
    expect(stored?.status).toBe("complete");
    expect(stored?.evaluatedAt).toBe(new Date("2026-11-17T20:40:00").toISOString());
    const pages = await loadFile<{ pageNumber: number; raw: string }[]>("p1", "pages.json");
    expect(pages).toHaveLength(4);

    const answers = new Map(stored!.extraction!.answers.map((a) => [a.ruleId, a]));
    // wrong claimed page (1) recovered to page 3, with section and offsets that reproduce the quote
    const pay = answers.get("PAY-01")!.evidence[0];
    expect(pay).toMatchObject({ verified: true, page: 3, claimedPage: 1, sectionId: "nursing" });
    expect(pages![2].raw.slice(pay.startOffset, pay.endOffset)).toBe("Authorization pending with payor");
    // fabricated quote is flagged, not anchored
    expect(answers.get("ACU-01")!.evidence[0]).toMatchObject({ verified: false });
    expect(answers.get("ACU-01")!.evidence[0].page).toBeUndefined();
    // contradiction quotes are checked too
    expect(answers.get("SKN-01")!.contradictions[0]).toMatchObject({ verifiedA: true, verifiedB: false });
    // skipped rules are explicit unknowns; computed rules are not asked of the model
    expect(answers.get("REG-01")).toMatchObject({ answered: false });
    for (const id of COMPUTED_RULES) expect(answers.has(id)).toBe(false);
    expect(answers.has("RX-06")).toBe(true);

    const result = stored!.result as ScreenResult;
    expect(Object.keys(result.facilities).sort()).toEqual(["A", "B", "C"]);
    const paySeen = result.facilities.A.blocking.find((i) => i.ruleId === "PAY-01");
    expect(paySeen?.evidence[0].verified).toBe(true);
    expect(result.facilities.A.blocking.some((i) => i.ruleId === "REG-01" && i.state === "unknown")).toBe(true);
  });

  it("shares an identical prefix across calls, warms with one call first, and never puts instructions in the prefix", async () => {
    await createRecord("p2");
    await runPipeline({ parseId: "p2", pdf: PDF, llm: fakeLlm });
    const labels = calls.map((c) => c.label);
    expect(labels[0]).toBe("document-map");
    expect(labels[1]).toBe("facts");
    expect(labels.filter((l) => l.startsWith("category-")).sort()).toEqual(["PAY", "REG", "ACU", "INF", "SKN", "THR", "NUT", "MON", "FUP", "DCP"].map((c) => `category-${c}`).sort());
    expect(new Set(calls.map((c) => c.system)).size).toBe(1);
    expect(new Set(calls.map((c) => c.pdfBase64)).size).toBe(1);
    expect(new Set(calls.map((c) => c.instruction)).size).toBe(calls.length);
    expect(calls[0].pdfBase64).not.toMatch(/\n/);
  });

  it("persists failures with an error message", async () => {
    await createRecord("p3");
    const bad: Llm = { parse: async () => { throw new Error("Model refused the call"); } };
    const rec = await runPipeline({ parseId: "p3", pdf: PDF, llm: bad });
    expect(rec).toMatchObject({ status: "failed", error: "Model refused the call" });
    expect((await loadFile<ParseRecord>("p3", "result.json"))?.status).toBe("failed");
  });
});

describe("createLlm", () => {
  const fakeClient = (resp: Record<string, unknown>) => {
    const seen: Record<string, unknown>[] = [];
    const client = { beta: { messages: { parse: async (p: Record<string, unknown>) => (seen.push(p), resp) } } };
    return { client: client as never, seen };
  };
  const req = { system: "s", pdfBase64: "AA\nBB", instruction: "i", label: "x", schema: FactsResultSchema as never };

  it("sends the cached document block first, fallbacks on, no thinking; fails on refusal", async () => {
    const { client, seen } = fakeClient({ stop_reason: "refusal", parsed_output: null });
    await expect(createLlm({ client, model: "m" }).parse(req)).rejects.toThrow(/refused/);
    const p = seen[0] as { model: string; betas: string[]; fallbacks: string; thinking?: unknown; messages: { content: { type: string; cache_control?: unknown; source?: { data: string } }[] }[] };
    expect(p.model).toBe("m");
    expect(p.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(p.fallbacks).toBe("default");
    expect(p.thinking).toBeUndefined();
    expect(p.messages[0].content[0]).toMatchObject({ type: "document", cache_control: { type: "ephemeral" } });
    expect(p.messages[0].content[0].source?.data).toBe("AABB");
    expect(p.messages[0].content[1].type).toBe("text");
  });

  it("returns parsed_output on success", async () => {
    const { client } = fakeClient({ stop_reason: "end_turn", parsed_output: { ok: 1 } });
    expect(await createLlm({ client }).parse(req)).toEqual({ ok: 1 });
    expect(stripNewlines("a\r\nb")).toBe("ab");
  });
});

describe("api", () => {
  it("accepts a PDF upload, runs in the background, and serves status and page text", async () => {
    const runs: Promise<unknown>[] = [];
    const app = createApp({ llm: () => fakeLlm, onRun: (r) => runs.push(r) });
    const form = new FormData();
    form.set("file", new File([PDF], "packet.pdf", { type: "application/pdf" }));
    const res = await app.request("/api/parses", { method: "POST", body: form });
    expect(res.status).toBe(202);
    const { parseId } = (await res.json()) as { parseId: string };
    await Promise.all(runs);

    const status = (await (await app.request(`/api/parses/${parseId}`)).json()) as ParseRecord;
    expect(status.status).toBe("complete");
    expect(status.result?.facilities.A.verdict).toBeDefined();

    const page = (await (await app.request(`/api/parses/${parseId}/document/3`)).json()) as { text: string };
    expect(page.text).toContain("Authorization pending");
    const sum = await app.request(`/api/parses/${parseId}/summary`);
    expect(sum.status).toBe(200);
    expect(await sum.text()).toContain("Referral screening summary");
    expect((await app.request(`/api/parses/${parseId}/document/99`)).status).toBe(404);
    expect((await app.request(`/api/parses/nope`)).status).toBe(404);

    const bad = new FormData();
    bad.set("file", new File(["hello"], "x.pdf"));
    expect((await app.request("/api/parses", { method: "POST", body: bad })).status).toBe(400);
  });

  it("marks the parse failed when no API key / client can be built", async () => {
    const runs: Promise<unknown>[] = [];
    const app = createApp({ llm: () => { throw new Error("ANTHROPIC_API_KEY is not set"); }, onRun: (r) => runs.push(r) });
    const form = new FormData();
    form.set("file", new File([PDF], "p.pdf"));
    const { parseId } = (await (await app.request("/api/parses", { method: "POST", body: form })).json()) as { parseId: string };
    await Promise.all(runs);
    const rec = (await (await app.request(`/api/parses/${parseId}`)).json()) as ParseRecord;
    expect(rec).toMatchObject({ status: "failed", error: "ANTHROPIC_API_KEY is not set" });
  });
});

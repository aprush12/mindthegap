import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type { ParseRecord } from "../src/pipeline/run.js";
import { makePdf } from "./fixtures/make-pdf.js";

const saved = { key: process.env.ANTHROPIC_API_KEY, data: process.env.DATA_DIR, samples: process.env.SAMPLES_DIR };
const restore = (k: string, v?: string) => (v === undefined ? delete process.env[k] : (process.env[k] = v));

beforeEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "mtg-data-"));
});
afterEach(() => {
  restore("ANTHROPIC_API_KEY", saved.key);
  restore("DATA_DIR", saved.data);
  restore("SAMPLES_DIR", saved.samples);
});

function appWithRuns() {
  const runs: Promise<unknown>[] = [];
  return { app: createApp({ onRun: (r) => runs.push(r) }), done: () => Promise.all(runs) };
}

describe("demo UI", () => {
  it("GET / serves the page and its assets", async () => {
    const { app } = appWithRuns();
    const res = await app.request("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("Mind the Gap");
    expect((await app.request("/app.js")).headers.get("content-type")).toContain("javascript");
    expect((await app.request("/app.css")).status).toBe(200);
  });

  it("sample elena without an API key completes from the fixture", async () => {
    process.env.SAMPLES_DIR = mkdtempSync(path.join(tmpdir(), "mtg-samples-"));
    writeFileSync(path.join(process.env.SAMPLES_DIR, "synthetic-elena-packet.pdf"), makePdf([["Elena packet"]]));
    const { app, done } = appWithRuns();
    const res = await app.request("/api/parses/sample/elena", { method: "POST" });
    expect(res.status).toBe(202);
    const { parseId } = (await res.json()) as { parseId: string };
    await done();
    const rec = (await (await app.request(`/api/parses/${parseId}`)).json()) as ParseRecord;
    expect(rec.status).toBe("complete");
    expect(rec.source).toBe("fixture");
    expect(rec.result!.facilities.A.verdict).toBe("conditional_accept");
    expect(rec.headline!.source).toBe("deterministic");
    expect((await app.request(`/api/parses/${parseId}/call-sheet`)).status).toBe(200);
  });

  it("a non-fixture sample without a key fails with the clear error", async () => {
    process.env.SAMPLES_DIR = mkdtempSync(path.join(tmpdir(), "mtg-samples-"));
    writeFileSync(path.join(process.env.SAMPLES_DIR, "carepatron-discharge-summary-example.pdf"), makePdf([["x"]]));
    const { app, done } = appWithRuns();
    const { parseId } = (await (await app.request("/api/parses/sample/carepatron", { method: "POST" })).json()) as { parseId: string };
    await done();
    const rec = (await (await app.request(`/api/parses/${parseId}`)).json()) as ParseRecord;
    expect(rec.status).toBe("failed");
    expect(rec.error).toBeTruthy();
  });

  it("404s with a make-sample hint when the file is missing, and for unknown names", async () => {
    process.env.SAMPLES_DIR = mkdtempSync(path.join(tmpdir(), "mtg-samples-"));
    const { app } = appWithRuns();
    const res = await app.request("/api/parses/sample/harold", { method: "POST" });
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toContain("npm run make-sample");
    expect((await app.request("/api/parses/sample/nope", { method: "POST" })).status).toBe(404);
  });

  it("fixture sample still runs when the server has no onRun hook", async () => {
    process.env.SAMPLES_DIR = mkdtempSync(path.join(tmpdir(), "mtg-samples-"));
    writeFileSync(path.join(process.env.SAMPLES_DIR, "synthetic-harold-packet.pdf"), makePdf([["Harold packet"]]));
    const app = createApp();
    const { parseId } = (await (await app.request("/api/parses/sample/harold", { method: "POST" })).json()) as { parseId: string };
    let rec: ParseRecord | undefined;
    for (let i = 0; i < 50 && rec?.status !== "complete"; i++) {
      await new Promise((r) => setTimeout(r, 50));
      rec = (await (await app.request(`/api/parses/${parseId}`)).json()) as ParseRecord;
    }
    expect(rec?.status).toBe("complete");
  });
});

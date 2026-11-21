import { readFile, writeFile } from "node:fs/promises";
import { Hono } from "hono";
import facilitiesJson from "./policy/facilities.json" with { type: "json" };
import { CapacitySchema, FacilitiesSchema, FacilityIdSchema, CapacitySnapshotSchema } from "./policy/schema.js";
import { createLlm, type Llm } from "./pipeline/anthropic.js";
import type { Page } from "./pipeline/extract-text.js";
import { createRecord, newParseId, runPipeline, type ParseRecord } from "./pipeline/run.js";
import { buildCallSheet } from "./report/call-sheet.js";
import { renderSummary } from "./report/summary.js";
import { uploadPage } from "./report/upload.js";
import { loadFile, saveFile } from "./store.js";

const facilities = FacilitiesSchema.parse(facilitiesJson);
const CAPACITY_PATH = new URL("./capacity/snapshot.json", import.meta.url);

const readCapacity = async () => CapacitySnapshotSchema.parse(JSON.parse(await readFile(CAPACITY_PATH, "utf8")));

export interface AppDeps {
  /** LLM factory, called per parse so a missing API key fails that parse, not the server. */
  llm?: () => Llm;
  /** Receives each background pipeline run (tests await it). */
  onRun?: (run: Promise<unknown>) => void;
}

export const facilityNames = () => Object.fromEntries(facilities.map((f) => [f.id, f.name]));

const validId = (id: string) => /^[\w-]+$/.test(id);
const isPdf = (b: Uint8Array) => b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;

export function createApp(deps: AppDeps = {}) {
  const app = new Hono();
  const makeLlm = deps.llm ?? (() => createLlm());

  app.get("/", (c) => c.html(uploadPage));
  /** Synthetic sample packets (built by npm run make-sample) so testers have something to upload. */
  app.get("/samples/:name", async (c) => {
    const name = c.req.param("name");
    if (!/^synthetic-(elena|harold)-packet\.pdf$/.test(name)) return c.json({ error: "not found" }, 404);
    const bytes = await readFile(new URL(`../samples/${name}`, import.meta.url)).catch(() => null);
    return bytes ? c.body(bytes, 200, { "content-type": "application/pdf", "content-disposition": `attachment; filename="${name}"` }) : c.json({ error: "sample not built" }, 404);
  });
  app.get("/health", (c) => c.json({ ok: true }));

  app.post("/api/parses", async (c) => {
    const body = await c.req.parseBody().catch(() => null);
    const file = body?.file;
    if (!(file instanceof File)) return c.json({ error: "multipart field \"file\" (a PDF) is required" }, 400);
    const pdf = new Uint8Array(await file.arrayBuffer());
    if (!isPdf(pdf)) return c.json({ error: "file is not a PDF" }, 400);
    const parseId = newParseId();
    await saveFile(parseId, "packet.pdf", pdf);
    const rec = await createRecord(parseId);
    const run = (async () => {
      let llm: Llm;
      try {
        llm = makeLlm();
      } catch (e) {
        await saveFile(parseId, "result.json", { ...rec, status: "failed", completedAt: new Date().toISOString(), error: e instanceof Error ? e.message : String(e) } satisfies ParseRecord);
        return;
      }
      await runPipeline({ parseId, pdf, llm });
    })();
    deps.onRun?.(run);
    return c.json({ parseId }, 202);
  });

  app.get("/api/parses/:id", async (c) => {
    const id = c.req.param("id");
    const rec = validId(id) ? await loadFile<ParseRecord>(id, "result.json") : undefined;
    return rec ? c.json(rec) : c.json({ error: "unknown parse" }, 404);
  });

  app.get("/api/parses/:id/summary", async (c) => {
    const id = c.req.param("id");
    const rec = validId(id) ? await loadFile<ParseRecord>(id, "result.json") : undefined;
    if (!rec) return c.json({ error: "unknown parse" }, 404);
    if (rec.status !== "complete" || !rec.result) return c.json({ error: `parse is ${rec.status}`, status: rec.status }, 409);
    return c.html(renderSummary({ parseId: rec.parseId, arrivalAt: rec.arrivalAt, evaluatedAt: rec.evaluatedAt, result: rec.result, headline: rec.headline, facilityNames: facilityNames(), warnings: rec.warnings }));
  });

  /** Flat voice-agent call sheet: every unresolved item with its one-sentence ask for the hospital. */
  app.get("/api/parses/:id/call-sheet", async (c) => {
    const id = c.req.param("id");
    const rec = validId(id) ? await loadFile<ParseRecord>(id, "result.json") : undefined;
    if (!rec) return c.json({ error: "unknown parse" }, 404);
    if (rec.status !== "complete" || !rec.result) return c.json({ error: `parse is ${rec.status}`, status: rec.status }, 409);
    return c.json(buildCallSheet(rec.result));
  });

  app.get("/api/parses/:id/document/:page", async (c) => {
    const id = c.req.param("id");
    const n = Number(c.req.param("page"));
    const pages = validId(id) ? await loadFile<Page[]>(id, "pages.json") : undefined;
    if (!pages) return c.json({ error: "no document text for this parse" }, 404);
    const page = Number.isInteger(n) ? pages.find((p) => p.pageNumber === n) : undefined;
    // raw text, so evidence startOffset/endOffset index straight into it
    return page ? c.json({ pageNumber: page.pageNumber, pageCount: pages.length, text: page.raw }) : c.json({ error: "page out of range" }, 404);
  });

  app.get("/api/facilities", (c) => c.json(facilities));

  app.get("/api/facilities/:id", async (c) => {
    const id = FacilityIdSchema.safeParse(c.req.param("id"));
    if (!id.success) return c.json({ error: "unknown facility" }, 404);
    const capacity = (await readCapacity())[id.data];
    return c.json({ ...facilities.find((f) => f.id === id.data)!, capacity });
  });

  app.put("/api/facilities/:id/capacity", async (c) => {
    const id = FacilityIdSchema.safeParse(c.req.param("id"));
    if (!id.success) return c.json({ error: "unknown facility" }, 404);
    const body = CapacitySchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid capacity", issues: body.error.issues }, 400);
    const snapshot = await readCapacity();
    snapshot[id.data] = body.data;
    await writeFile(CAPACITY_PATH, JSON.stringify(snapshot, null, 2) + "\n");
    return c.json(body.data);
  });

  return app;
}

export const app = createApp();

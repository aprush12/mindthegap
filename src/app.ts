import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Hono } from "hono";
import { runFixtureParse, type FixtureName } from "./demo/fixture.js";
import facilitiesJson from "./policy/facilities.json" with { type: "json" };
import { CapacitySchema, FacilitiesSchema, FacilityIdSchema, CapacitySnapshotSchema } from "./policy/schema.js";
import { createLlm, type Llm } from "./pipeline/anthropic.js";
import type { Page } from "./pipeline/extract-text.js";
import { createRecord, newParseId, runPipeline, type ParseRecord } from "./pipeline/run.js";
import { buildCallSheet } from "./report/call-sheet.js";
import { renderSummary } from "./report/summary.js";
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

const PUBLIC_DIR = new URL("../public/", import.meta.url);
const STATIC: Record<string, [string, string]> = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/app.css": ["app.css", "text/css; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
};
/** Demo samples: name -> file under samples/ (override the folder with SAMPLES_DIR). */
const SAMPLES: Record<string, { file: string; fixture?: FixtureName }> = {
  elena: { file: "synthetic-elena-packet.pdf", fixture: "elena" },
  harold: { file: "synthetic-harold-packet.pdf", fixture: "harold" },
  carepatron: { file: "carepatron-discharge-summary-example.pdf" },
  cdph: { file: "cdph-interfacility-transfer-comprehensive.pdf" },
};
const samplePath = (name: string) => path.resolve(process.env.SAMPLES_DIR ?? "samples", SAMPLES[name]!.file);
const sampleExists = (name: string) => readFile(samplePath(name)).then(() => true, () => false);

const validId = (id: string) => /^[\w-]+$/.test(id);
const isPdf = (b: Uint8Array) => b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;

export function createApp(deps: AppDeps = {}) {
  const app = new Hono();
  const makeLlm = deps.llm ?? (() => createLlm());

  for (const [route, [file, type]] of Object.entries(STATIC)) {
    app.get(route, async (c) => c.body(await readFile(new URL(file, PUBLIC_DIR)), 200, { "Content-Type": type }));
  }

  app.get("/api/samples", async (c) =>
    c.json(Object.fromEntries(await Promise.all(Object.keys(SAMPLES).map(async (n) => [n, await sampleExists(n)] as const)))),
  );

  app.get("/health", (c) => c.json({ ok: true }));

  async function startParse(pdf: Uint8Array, fixture?: FixtureName): Promise<string> {
    const parseId = newParseId();
    await saveFile(parseId, "packet.pdf", pdf);
    if (fixture) {
      await createRecord(parseId); // exists before the first poll
      const run = runFixtureParse(parseId, pdf, fixture); // started before the optional call: `?.()` skips evaluating its args
      deps.onRun?.(run);
      return parseId;
    }
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
    return parseId;
  }

  app.post("/api/parses", async (c) => {
    const body = await c.req.parseBody().catch(() => null);
    const file = body?.file;
    if (!(file instanceof File)) return c.json({ error: "multipart field \"file\" (a PDF) is required" }, 400);
    const pdf = new Uint8Array(await file.arrayBuffer());
    if (!isPdf(pdf)) return c.json({ error: "file is not a PDF" }, 400);
    return c.json({ parseId: await startParse(pdf) }, 202);
  });

  app.post("/api/parses/sample/:name", async (c) => {
    const name = c.req.param("name");
    if (!Object.hasOwn(SAMPLES, name)) return c.json({ error: "unknown sample" }, 404);
    const pdf = await readFile(samplePath(name)).then((b) => new Uint8Array(b), () => undefined);
    if (!pdf) return c.json({ error: `Sample PDF not found locally (${SAMPLES[name]!.file}). Run \`npm run make-sample\` to generate it.` }, 404);
    // No API key (and no injected LLM): the two synthetic packets run the offline fixture path; everything else fails with the clear error.
    const offline = !process.env.ANTHROPIC_API_KEY && !deps.llm && SAMPLES[name]!.fixture;
    return c.json({ parseId: await startParse(pdf, offline || undefined) }, 202);
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
    return c.html(renderSummary({ parseId: rec.parseId, arrivalAt: rec.arrivalAt, evaluatedAt: rec.evaluatedAt, result: rec.result, headline: rec.headline, facilityNames: facilityNames() }));
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

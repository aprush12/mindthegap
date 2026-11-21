import { prioritizeAll } from "../engine/priority.js";
import { screen } from "../engine/verdict.js";
import { buildHeadline } from "../pipeline/headline.js";
import { extractPages } from "../pipeline/extract-text.js";
import { createRecord, type ParseRecord } from "../pipeline/run.js";
import { loadCapacity, loadPolicy } from "../policy/index.js";
import { saveFile } from "../store.js";
import type { Extraction } from "../types.js";

export type FixtureName = "elena" | "harold";

/**
 * Golden test fixtures live in tests/ (outside the tsc rootDir), so they load dynamically.
 * That works under `npm run dev` / tsx / vitest; a compiled-only deploy lacks tests/ and the parse fails with a clear error.
 */
async function loadFixture(name: FixtureName): Promise<{ extraction: Extraction; arrival: string }> {
  const file = name === "elena" ? "elena-mercado" : "harold-jennings";
  const mod = await import(new URL(`../../tests/fixtures/${file}.ts`, import.meta.url).href.replace(/\.ts$/, ".js"));
  return name === "elena" ? { extraction: mod.elena, arrival: mod.ARRIVAL } : { extraction: mod.harold, arrival: mod.HAROLD_ARRIVAL };
}

/** Same as scripts/offline-demo.ts: fixture extraction stands in for the model; engine, priorities and headline are real. Never throws. */
export async function runFixtureParse(parseId: string, pdf: Uint8Array, name: FixtureName): Promise<ParseRecord> {
  const rec = await createRecord(parseId);
  try {
    const { extraction, arrival } = await loadFixture(name);
    const pages = await extractPages(pdf);
    await saveFile(parseId, "pages.json", pages);
    const now = new Date(arrival);
    const result = screen(extraction, loadPolicy(), loadCapacity(), now);
    const priorities = prioritizeAll(result, extraction, now);
    const headline = await buildHeadline(undefined, extraction, result, now, priorities); // no Llm: deterministic
    const done: ParseRecord = {
      ...rec, status: "complete", source: "fixture", completedAt: new Date().toISOString(), arrivalAt: arrival, evaluatedAt: now.toISOString(),
      pageCount: pages.length, extraction, result, packetGaps: result.packetGaps, priorities, headline,
    };
    await saveFile(parseId, "result.json", done);
    return done;
  } catch (e) {
    const failed: ParseRecord = { ...rec, status: "failed", completedAt: new Date().toISOString(), error: e instanceof Error ? e.message : String(e) };
    await saveFile(parseId, "result.json", failed);
    return failed;
  }
}

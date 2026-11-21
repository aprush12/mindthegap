// Offline demo: runs everything except the LLM extraction — no API key needed.
// The golden Elena Mercado extraction stands in for the model's answers; the engine,
// priority ranking, deterministic headline and summary are the real production code.
// Also text-extracts the synthetic packet PDF to prove the local PDF path works.
// Usage: npx tsx scripts/offline-demo.ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadCapacity, loadPolicy } from "../src/policy/index.js";
import { screen } from "../src/engine/verdict.js";
import { prioritizeAll } from "../src/engine/priority.js";
import { buildHeadline } from "../src/pipeline/headline.js";
import { extractPages } from "../src/pipeline/extract-text.js";
import { renderSummary, renderTextTable, type SummaryInput } from "../src/report/summary.js";
import { elena, ARRIVAL, NOW } from "../tests/fixtures/elena-mercado.js";

const outDir = path.resolve("data/offline-demo");
await mkdir(outDir, { recursive: true });

// 1. Real PDF text extraction over the 51-page synthetic packet
const pdfPath = path.resolve("samples/synthetic-elena-packet.pdf");
const pages = await extractPages(new Uint8Array(await readFile(pdfPath)));
const pasrrMentions = pages.filter((p) => /pasrr/i.test(p.text)).length;
console.log(`PDF text extraction: ${pages.length} pages from ${path.basename(pdfPath)}; PASRR mentions found: ${pasrrMentions} (expected 0)`);

// 2. Engine + priorities + deterministic headline on the golden extraction
const policy = loadPolicy();
const capacity = loadCapacity();
const result = screen(elena, policy, capacity, NOW);
const priorities = prioritizeAll(result, elena, NOW);
const headline = await buildHeadline(undefined, elena, result, NOW, priorities); // no Llm → deterministic
console.log(`Headline source: ${headline.source}`);

const input: SummaryInput = {
  parseId: "offline-demo",
  arrivalAt: ARRIVAL,
  evaluatedAt: NOW.toISOString(),
  result,
  headline,
  facilityNames: Object.fromEntries(policy.facilities.map((f) => [f.id, f.name])),
};

await writeFile(path.join(outDir, "result.json"), JSON.stringify({ parseId: "offline-demo", extraction: elena, result, priorities, headline }, null, 2));
await writeFile(path.join(outDir, "summary.html"), renderSummary(input));
console.log(`Wrote ${outDir}/result.json and summary.html\n`);
console.log(renderTextTable(input));

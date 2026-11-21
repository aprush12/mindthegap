import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { facilityNames } from "../src/app.js";
import { createLlm } from "../src/pipeline/anthropic.js";
import { createRecord, newParseId, runPipeline } from "../src/pipeline/run.js";
import { renderSummary, renderTextTable } from "../src/report/summary.js";
import { parseDir, saveFile } from "../src/store.js";

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const out = outIdx >= 0 ? args[outIdx + 1] : undefined;
const pdfPath = args.find((a, i) => !a.startsWith("--") && i !== outIdx + 1);

if (!pdfPath || (outIdx >= 0 && !out)) {
  console.error("usage: npm run parse <packet.pdf> [--out dir]");
  process.exit(2);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is required");
  process.exit(2);
}

const pdf = new Uint8Array(await readFile(pdfPath));
const parseId = newParseId();
await saveFile(parseId, "packet.pdf", pdf);
await createRecord(parseId);
console.error(`parse ${parseId}: running (${pdf.length} bytes)...`);

const rec = await runPipeline({ parseId, pdf, llm: createLlm() });
if (rec.status !== "complete" || !rec.result) {
  console.error(`parse failed: ${rec.error}`);
  process.exit(1);
}

const input = { parseId, arrivalAt: rec.arrivalAt, evaluatedAt: rec.evaluatedAt, result: rec.result, headline: rec.headline, facilityNames: facilityNames() };
console.log(renderTextTable(input));

const dir = out ?? parseDir(parseId);
await mkdir(dir, { recursive: true });
await writeFile(path.join(dir, "result.json"), JSON.stringify(rec, null, 2));
await writeFile(path.join(dir, "summary.html"), renderSummary(input));
console.error(`wrote ${path.join(dir, "result.json")} and ${path.join(dir, "summary.html")}`);

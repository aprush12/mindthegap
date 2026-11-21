/**
 * Generates a synthetic hospital-to-SNF referral packet PDF styled as an EHR print-out. All people, payors and
 * identifiers are invented. Each packet's self-check enforces its load-bearing presences and absences.
 *
 * Run: npm run make-sample              (Elena Mercado: paperwork missing, inverse of Harold)
 *      npm run make-sample -- harold    (Harold Jennings: paperwork complete, capability gap)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { buildPacket, selfCheck, type PacketSpec } from "./sample/layout.js";
import { elenaPacket } from "./sample/elena.js";
import { haroldPacket } from "./sample/harold.js";

const PACKETS: Record<string, PacketSpec> = { elena: elenaPacket, harold: haroldPacket };
const which = (process.argv[2] ?? "elena").toLowerCase();
const spec = PACKETS[which];
if (!spec) {
  console.error(`unknown packet "${which}"; choose one of: ${Object.keys(PACKETS).join(", ")}`);
  process.exit(2);
}

const bytes = await buildPacket(spec);
mkdirSync(dirname(spec.out), { recursive: true });
writeFileSync(spec.out, bytes);
console.log(`wrote ${spec.out} (${(bytes.length / 1024).toFixed(0)} KB)`);
process.exit((await selfCheck(bytes, spec)) ? 0 : 1);

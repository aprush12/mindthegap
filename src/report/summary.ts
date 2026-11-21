import type { FacilityResult, ScreenResult, Verdict } from "../engine/verdict.js";
import type { Item, RuleState } from "../engine/evaluate.js";
import { CRITERIA, FACILITY_IDS, type FacilityId } from "../policy/schema.js";
import type { Evidence } from "../types.js";
import type { Headline, TopPriority } from "../pipeline/headline.js";
import type { MedReport } from "../engine/formulary.js";
import { dueLabel, friendlyWhen, scrubTimes } from "./when.js";

export interface SummaryInput {
  parseId: string;
  arrivalAt?: string;
  evaluatedAt?: string;
  result: ScreenResult;
  /** "What matters most" block; the section is omitted when absent (records parsed before it existed). */
  headline?: Headline;
  /** Display names keyed by facility id; falls back to "Facility X". */
  facilityNames?: Partial<Record<FacilityId, string>>;
}

const VERDICT_LABEL: Record<Verdict, string> = {
  accept: "Accept",
  conditional_accept: "Conditional accept",
  blocked: "Blocked",
  decline: "Decline",
};
const STATE_LABEL: Record<RuleState, string> = {
  met: "Met",
  not_met: "Not met",
  unknown: "Unknown",
  contradictory: "Contradictory",
  not_applicable: "N/A",
};
const CRITERION_LABEL: Record<string, string> = {
  regulatory_screens: "Regulatory screens",
  acuity_vs_staffing: "Acuity vs staffing",
  infection_control: "Infection control",
  pharmacy_operations: "Pharmacy operations",
  skin_wounds: "Skin and wounds",
  therapy: "Therapy",
  nutrition_swallowing: "Nutrition and swallowing",
  monitoring_transitions: "Monitoring and transitions",
};

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const pad = (n: number) => String(n).padStart(2, "0");

/** Local wall-clock "17 Nov 2026 20:40" (inputs without a zone are local times, so this round-trips). */
export function fmtTime(iso?: string): string {
  if (!iso) return "unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const mon = d.toLocaleString("en-US", { month: "short" });
  return `${d.getDate()} ${mon} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const name = (input: SummaryInput, f: FacilityId) => input.facilityNames?.[f] ?? `Facility ${f}`;

function evidenceHtml(ev: Evidence): string {
  const quote = `<q>${esc(ev.quote)}</q>`;
  if (ev.verified) return `<li class="ev">${quote} <span class="pg">(page ${ev.page})</span></li>`;
  return `<li class="ev unverified">${quote} <span class="flag">UNVERIFIED: quote not found in the document text (model cited page ${ev.claimedPage})</span></li>`;
}

function detailHtml(it: Item): string {
  if (!it.detail) return "";
  // The per-medication due/supply dump lives in the collapsed "Medication timing detail" block, not here.
  const d = it.ruleId === "RX-02" ? "Some first doses may not arrive in time; see Medication timing detail for this facility." : scrubTimes(it.detail);
  return `<div class="detail">${esc(d)}</div>`;
}

function medDetailHtml(input: SummaryInput, f: FacilityResult): string {
  if (!f.formularyReport.length) return "";
  const arrival = input.arrivalAt ?? input.evaluatedAt;
  const supply = (r: MedReport) => {
    if (r.supplyAt === undefined) return r.firstDoseDue ? "in time" : "";
    if (r.supplyAt === null) return "won't arrive";
    return `won't arrive until ${friendlyWhen(r.supplyAt, arrival)}`;
  };
  const rows = f.formularyReport
    .map((r) => `<tr class="${r.firstDoseAtRisk ? "risk" : ""}"><td>${esc(r.med)}</td><td>${esc(r.status.replace("_", " "))}</td><td>${r.firstDoseDue ? esc(friendlyWhen(r.firstDoseDue, arrival)) : "not stated"}</td><td>${esc(supply(r))}</td></tr>`)
    .join("");
  return `<details class="meddetail"><summary>Medication timing detail</summary><table><thead><tr><th>Medication</th><th>At this facility</th><th>First dose due</th><th>Earliest supply</th></tr></thead><tbody>${rows}</tbody></table></details>`;
}

function itemHtml(it: Item, showClock: boolean): string {
  const clock = it.resolveBy ? `<div class="resolve">Resolve by <b>${esc(fmtTime(it.resolveBy))}</b>${it.windowHours !== undefined ? ` (${it.windowHours}h window)` : ""}</div>` : "";
  const contra = it.contradictions
    .map(
      (c) => `<li class="ev contra"><span class="flag">CONTRADICTION</span> <q>${esc(c.quoteA)}</q> <span class="pg">(page ${c.pageA}${c.verifiedA === false ? ", unverified" : ""})</span> vs <q>${esc(c.quoteB)}</q> <span class="pg">(page ${c.pageB}${c.verifiedB === false ? ", unverified" : ""})</span>${c.note ? ` &ndash; ${esc(c.note)}` : ""}</li>`,
    )
    .join("");
  const evs = it.evidence.map(evidenceHtml).join("");
  const body = evs || contra ? `<ul class="evs">${evs}${contra}</ul>` : `<div class="none">No supporting passage in the record.</div>`;
  const ask = it.followUpAsk ? `<div class="ask">Ask: ${esc(it.followUpAsk)}</div>` : "";
  return `<div class="item"><div class="q"><span class="rid">${esc(it.ruleId)}</span> ${esc(it.question)} <span class="state s-${it.state}">${STATE_LABEL[it.state]}</span></div>${detailHtml(it)}${ask}${body}${showClock ? clock : ""}</div>`;
}

function facilitySection(input: SummaryInput, f: FacilityResult): string {
  const blocks = f.blocking.length ? f.blocking.map((i) => itemHtml(i, false)).join("") : `<p class="none">No blocking items.</p>`;
  const cond = f.conditional.length ? f.conditional.map((i) => itemHtml(i, true)).join("") : `<p class="none">No conditional items.</p>`;
  return `<section class="facility"><h2>${esc(name(input, f.facilityId))} <span class="v v-${f.verdict}">${VERDICT_LABEL[f.verdict]}</span></h2>
<h3>Blocking items (${f.blocking.length})</h3>${blocks}
<h3>Items on a clock (${f.conditional.length})</h3>${cond}${medDetailHtml(input, f)}</section>`;
}

const SEV_LABEL: Record<TopPriority["severity"], string> = { tonight: "TONIGHT", block: "BLOCKED", capability: "CAN'T DO HERE", clock: "ON THE CLOCK" };
/** Dose-conflict items get their own chip; everything else uses its severity chip. */
const chipFor = (t: TopPriority) => (t.ruleIds.some((r) => r.startsWith("MEDREC:")) ? "CONFIRM DOSE" : SEV_LABEL[t.severity]);
const BADGE_LABEL: Record<Verdict, string> = { accept: "ACCEPT", conditional_accept: "CONDITIONAL", blocked: "BLOCKED", decline: "DECLINE" };

function mattersMostHtml(input: SummaryInput): string {
  const h = input.headline;
  if (!h) return "";
  const arrival = input.arrivalAt ?? input.evaluatedAt;
  const cols = FACILITY_IDS.map((id) => {
    const f = input.result.facilities[id];
    const p = h.perFacility[id];
    const items = p.topPriorities
      .map((t) => {
        const due = dueLabel(t.ruleIds, t.dueBy, arrival);
        const ask = t.followUpAsk ? `<div class="ask">Ask: ${esc(t.followUpAsk)}</div>` : "";
        return `<li class="pri sev-${t.severity}"><span class="sev${chipFor(t) === "CONFIRM DOSE" ? " sev-confirm" : ""}">${chipFor(t)}</span> <span class="ptext">${esc(t.text)}</span>${due ? ` <span class="due">${esc(due)}</span>` : ""} <span class="ids">${esc(t.ruleIds.join(", "))}</span>${ask}</li>`;
      })
      .join("");
    const gaps = input.result.packetGaps ?? [];
    const gapList = gaps.length
      ? `<div class="gaps"><h4>Packet gaps</h4><ul>${gaps.map((g) => `<li><span class="sev sev-gap">PACKET GAP</span> <span class="ptext">${esc(g.text)}</span> <span class="ids">${esc(g.id)}</span><div class="ask">Ask: ${esc(g.followUpAsk)}</div></li>`).join("")}</ul></div>`
      : "";
    return `<div class="card card-${f.verdict}"><div class="badge b-${f.verdict}">${BADGE_LABEL[f.verdict]}</div><h3>${esc(name(input, id))}</h3><p class="hl">${esc(p.headline)}</p><ol>${items}</ol>${gapList}</div>`;
  }).join("");
  const note = h.source === "deterministic" ? "Generated from the checklist without a model." : "Written by a model from the checklist; every item cites checklist rule ids.";
  return `<section class="matters"><h2>What matters most</h2><p class="snap">${esc(h.patientSnapshot)}</p><div class="mm-grid">${cols}</div><p class="none">${note} The full checklist, evidence and medication timing follow below.</p></section>`;
}

export function renderSummary(input: SummaryInput): string {
  const { result } = input;
  const fs = FACILITY_IDS.map((id) => result.facilities[id]);
  const head = fs.map((f) => `<th>${esc(name(input, f.facilityId))}</th>`).join("");
  const row = (label: string, cell: (f: FacilityResult) => string) => `<tr><th scope="row">${label}</th>${fs.map((f) => `<td>${cell(f)}</td>`).join("")}</tr>`;
  const table = `<table class="verdicts"><thead><tr><th></th>${head}</tr></thead><tbody>
${row("Verdict", (f) => `<span class="v v-${f.verdict}">${VERDICT_LABEL[f.verdict]}</span>`)}
${row("Blocking items", (f) => String(f.blocking.length))}
${row("Items on a clock", (f) => String(f.conditional.length))}
${row("First dose at risk", (f) => (f.firstDoseAtRisk ? "Yes" : "No"))}
</tbody></table>`;

  const grid = `<table class="criteria"><thead><tr><th>Criterion</th>${head}</tr></thead><tbody>${CRITERIA.map(
    (c) => `<tr><th scope="row">${esc(CRITERION_LABEL[c] ?? c)}</th>${FACILITY_IDS.map((id) => {
      const cell = result.criteriaView[c][id];
      const flags = (cell.flags ?? []).map((fl) => `<div class="cflag"><span class="sev sev-gap">${fl.chip}</span> ${esc(fl.text)}</div>`).join("");
      return `<td class="s-${cell.worstState}">${STATE_LABEL[cell.worstState]}${flags}</td>`;
    }).join("")}</tr>`,
  ).join("")}</tbody></table>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Referral screening summary ${esc(input.parseId)}</title>
<style>
:root{--ink:#1a1d21;--muted:#5b6470;--line:#d5dae0;--bg:#fff;--ok:#1b7f3b;--warn:#a65d00;--bad:#b3261e;--unk:#5b3fa0}
*{box-sizing:border-box}
body{font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);background:var(--bg);margin:0 auto;max-width:960px;padding:24px 16px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:0 0 8px}h3{font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin:16px 0 6px}
.meta{color:var(--muted);margin-bottom:16px}
table{border-collapse:collapse;width:100%;margin:8px 0 20px}
th,td{border:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}
thead th{background:#f3f5f7}tbody th{font-weight:600;width:22%}
.v{display:inline-block;padding:1px 8px;border-radius:10px;font-weight:600;font-size:13px;border:1px solid currentColor}
.v-accept{color:var(--ok)}.v-conditional_accept{color:var(--warn)}.v-blocked{color:var(--bad)}.v-decline{color:var(--bad);background:#fdecea}
.facility{margin-bottom:24px}
.item{border-left:3px solid var(--line);padding:4px 0 4px 10px;margin:8px 0}
.rid{font-family:ui-monospace,Menlo,monospace;font-weight:700}
.state{font-size:12px;font-weight:600;margin-left:6px}
.s-met{color:var(--ok)}.s-not_met{color:var(--bad)}.s-unknown{color:var(--unk)}.s-contradictory{color:var(--warn)}.s-not_applicable{color:var(--muted)}
.detail,.none{color:var(--muted)}.evs{margin:4px 0 0;padding-left:18px}.ev q{font-style:italic}.pg{color:var(--muted)}
.unverified{background:#fff6e5}.flag{color:var(--bad);font-weight:700;font-size:12px}
.resolve{margin-top:4px;color:var(--warn)}
.matters{margin:0 0 28px}
.snap{font-size:17px;font-weight:600;margin:4px 0 14px}.hl{font-size:15px;margin:6px 0 10px}
.mm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:14px}
.card{border:2px solid var(--line);border-radius:10px;padding:12px 14px;background:#fff}
.card h3{margin:8px 0 0;font-size:15px;text-transform:none;letter-spacing:0;color:var(--ink)}
.card ol{margin:0;padding-left:22px}
.card-accept{border-color:var(--ok)}.card-conditional_accept{border-color:#e0a000}.card-blocked{border-color:#e8590c}.card-decline{border-color:var(--bad)}
.badge{display:inline-block;font-size:24px;font-weight:800;letter-spacing:.03em;padding:4px 14px;border-radius:8px;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.b-accept{background:var(--ok)}.b-conditional_accept{background:#f2a900;color:#1a1d21}.b-blocked{background:#e8590c}.b-decline{background:var(--bad)}
.pri{margin:7px 0;padding:3px 0 3px 6px;border-left:3px solid var(--line)}
.sev{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.05em;padding:1px 6px;border-radius:3px;color:#fff;vertical-align:1px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.due{color:var(--warn);font-weight:600;white-space:nowrap}.ids{font-family:ui-monospace,Menlo,monospace;font-size:10px;color:var(--muted)}
.sev-tonight{border-left:6px solid var(--bad);background:#fdecea;font-weight:700;font-size:15px;padding:5px 6px}.sev-tonight .sev{background:var(--bad)}
.sev-block{border-left-color:#e8590c}.sev-block .sev{background:#e8590c}
.sev-capability{border-left-color:var(--bad)}.sev-capability .sev{background:#7a1a14}
.sev-clock{border-left-color:#e0a000;color:#333}.sev-clock .sev{background:#8a6a00}
.ask{font-size:12px;font-weight:400;color:var(--muted);margin-top:2px}
.sev-confirm,.sev-gap{background:#5b3fa0}
.gaps{margin-top:12px;border-top:1px dashed var(--line);padding-top:6px}.gaps h4{margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
.gaps ul{margin:0;padding-left:0;list-style:none}.gaps li{margin:5px 0;font-size:13px}
.cflag{font-weight:400;font-size:12px;color:var(--ink);margin-top:4px}
.meddetail{margin:14px 0 0}.meddetail summary{cursor:pointer;font-weight:600;color:var(--muted)}.meddetail table{font-size:13px}.meddetail .risk td{background:#fff6e5}
.criteria td{font-weight:600}
@media print{body{max-width:none;padding:0}.card{break-inside:avoid}.facility{break-before:page}.item{break-inside:avoid}table{break-inside:avoid}thead{display:table-header-group}}
</style></head><body>
<header><h1>Referral screening summary</h1>
<div class="meta">Parse <code>${esc(input.parseId)}</code> &middot; Arrival ${esc(fmtTime(input.arrivalAt ?? input.evaluatedAt))}${input.arrivalAt ? "" : " (not stated in the record; wall clock used)"}</div></header>
${mattersMostHtml(input)}
<h2>Verdicts</h2>
${table}
${fs.map((f) => facilitySection(input, f)).join("\n")}
<section class="grid"><h2>Criteria view</h2>${grid}</section>
</body></html>
`;
}

/** Plain-text verdict table for the CLI. */
export function renderTextTable(input: SummaryInput): string {
  const fs = FACILITY_IDS.map((id) => input.result.facilities[id]);
  const rows: string[][] = [
    ["", ...fs.map((f) => name(input, f.facilityId))],
    ["Verdict", ...fs.map((f) => VERDICT_LABEL[f.verdict])],
    ["Blocking items", ...fs.map((f) => String(f.blocking.length))],
    ["Items on a clock", ...fs.map((f) => String(f.conditional.length))],
    ["First dose at risk", ...fs.map((f) => (f.firstDoseAtRisk ? "Yes" : "No"))],
  ];
  const w = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
  const table = rows.map((r) => r.map((c, i) => c.padEnd(w[i])).join("  ").trimEnd()).join("\n");
  const h = input.headline;
  if (!h) return table;
  const arrival = input.arrivalAt ?? input.evaluatedAt;
  const MAX_LINE = 120;
  const blocks = FACILITY_IDS.map((id) => {
    const p = h.perFacility[id];
    const lines = p.topPriorities.slice(0, 6).map((t, i) => {
      const base = `  ${i + 1}. [${chipFor(t)}] ${t.text}`;
      const due = dueLabel(t.ruleIds, t.dueBy, arrival);
      return due && base.length + due.length + 3 <= MAX_LINE ? `${base} (${due})` : base;
    });
    const gaps = (input.result.packetGaps ?? []).map((g) => `  - [PACKET GAP] ${g.text}`);
    return [`${name(input, id)}: ${p.headline}`, ...lines, ...gaps].join("\n");
  });
  return `${table}\n\nWhat matters most\n${h.patientSnapshot}\n\n${blocks.join("\n\n")}`;
}

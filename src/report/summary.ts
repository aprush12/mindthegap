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
/** The big answer on each facility card, and the line under it. */
const VERDICT_WORD: Record<Verdict, [string, string]> = {
  accept: ["Yes", "Can take this patient"],
  conditional_accept: ["Yes, if…", "Can take this patient once a few things are sorted"],
  blocked: ["Not yet", "Something must be fixed before the patient travels"],
  decline: ["No", "Can't provide the care this patient needs"],
};
const STATE_LABEL: Record<RuleState, string> = {
  met: "OK",
  not_met: "Problem",
  unknown: "Not in packet",
  contradictory: "Packet disagrees",
  not_applicable: "Doesn't apply",
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
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// ---- small inline icons (stroke = currentColor), so the page stays one self-contained file ----
const svg = (body: string) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const ICON = {
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  ask: svg('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>'),
  page: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'),
  bed: svg('<path d="M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="2"/>'),
  pill: svg('<rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-45 12 12)"/><path d="M9.5 9.5l5 5"/>'),
  alert: svg('<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.5v.01"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7"/>'),
  arrive: svg('<path d="M3 12h13M12 7l5 5-5 5"/><path d="M20 4v16"/>'),
};

// ---- chips: the human label for each kind of priority ----
const CHIP: Record<TopPriority["severity"], [string, string]> = {
  tonight: ["Urgent", "c-tonight"],
  block: ["Must fix first", "c-block"],
  capability: ["Can't do here", "c-cap"],
  clock: ["Soon", "c-clock"],
};
/** CLI labels (text table). */
const SEV_LABEL: Record<TopPriority["severity"], string> = { tonight: "TONIGHT", block: "BLOCKED", capability: "CAN'T DO HERE", clock: "ON THE CLOCK" };
const chipFor = (t: TopPriority) => (t.ruleIds.some((r) => r.startsWith("MEDREC:")) ? "CONFIRM DOSE" : SEV_LABEL[t.severity]);
const isDose = (ids: string[]) => ids.some((r) => r.startsWith("MEDREC:"));
const chipHtml = (t: TopPriority) => {
  const [label, cls] = isDose(t.ruleIds) ? ["Check dose", "c-dose"] : CHIP[t.severity];
  return `<span class="chip ${cls}">${label}</span>`;
};

/** A verbatim packet quote, styled like a torn-out page. */
function quoteCard(quote: string, page: number | undefined, label?: string, unverified = false): string {
  const where = label ? `${label}${page !== undefined ? ` · page ${page}` : ""}` : page !== undefined ? `Page ${page}` : "In the packet";
  return `<figure class="quote${unverified ? " unverified" : ""}"><figcaption>${ICON.page}${esc(where)}</figcaption><blockquote>“${esc(quote)}”</blockquote>${unverified ? `<p class="warn">Couldn't find this wording in the packet text, so double-check it (the model pointed to page ${page ?? "?"}).</p>` : ""}</figure>`;
}

function priorityHtml(t: TopPriority, n: number, arrival?: string): string {
  const due = dueLabel(t.ruleIds, t.dueBy, arrival);
  const ask = t.followUpAsk ? `<div class="ask">${ICON.ask}<p><b>Ask the hospital:</b> ${esc(t.followUpAsk)}</p></div>` : "";
  const ev = t.evidence ?? [];
  const labels = isDose(t.ruleIds) ? ["Discharge list", "Later note"] : [];
  const quotes = ev.length
    ? `<details class="where"><summary>Where the packet says this</summary><div class="quotes">${ev.map((e, i) => quoteCard(e.quote, e.page, labels[i])).join("")}</div></details>`
    : "";
  return `<li class="pri sev-${t.severity}${isDose(t.ruleIds) ? " sev-dose" : ""}"><span class="num">${n}</span><div class="pbody"><div class="ptop">${chipHtml(t)}${due ? `<span class="due">${ICON.clock}${esc(due)}</span>` : ""}</div><p class="ptext">${esc(t.text)}</p>${ask}${quotes}<span class="ids" title="Rules this comes from">${esc(t.ruleIds.join(" · "))}</span></div></li>`;
}

function statsHtml(f: FacilityResult): string {
  const bits = [
    f.beds.available !== null ? `${ICON.bed}${f.beds.available === 0 ? "No beds open" : plural(f.beds.available, "bed") + " open"}` : "",
    f.blocking.length ? `${ICON.alert}${plural(f.blocking.length, "thing")} to fix` : `${ICON.check}Nothing blocking`,
    f.conditional.length ? `${ICON.clock}${plural(f.conditional.length, "deadline")}` : "",
    f.firstDoseAtRisk ? `${ICON.pill}First doses at risk` : "",
  ].filter(Boolean);
  return `<ul class="stats">${bits.map((b) => `<li>${b}</li>`).join("")}</ul>`;
}

function snapshotHtml(snapshot: string): string {
  const facts = snapshot.split(/\s*[,;]\s*/).map((x) => x.trim()).filter(Boolean);
  const list = facts.length > 1 ? facts : [snapshot];
  return `<ul class="facts" title="${esc(snapshot)}">${list.map((x) => `<li>${esc(x.charAt(0).toUpperCase() + x.slice(1))}</li>`).join("")}</ul>`;
}

function facilityCard(input: SummaryInput, id: FacilityId, n: number): string {
  const f = input.result.facilities[id];
  const p = input.headline!.perFacility[id];
  const arrival = input.arrivalAt ?? input.evaluatedAt;
  const [word, sub] = VERDICT_WORD[f.verdict];
  const pris = p.topPriorities.map((t, i) => priorityHtml(t, i + 1, arrival)).join("");
  return `<article class="card card-${f.verdict} rise" style="--i:${n}">
<div class="badge b-${f.verdict}"><span class="word">${esc(word)}</span><span class="sub">${esc(sub)}</span></div>
<h2>${esc(name(input, id))}</h2>
<p class="hl">${esc(p.headline)}</p>
${statsHtml(f)}
${pris ? `<h3 class="dofirst">Do these first</h3><ol class="pris">${pris}</ol>` : `<p class="calm">${ICON.check}Nothing to chase for this facility.</p>`}
</article>`;
}

function gapsHtml(input: SummaryInput): string {
  const gaps = input.result.packetGaps ?? [];
  if (!gaps.length) return "";
  return `<section class="gaps"><p class="eyebrow">For every facility</p><h2>Missing from the packet</h2>
<p class="lede-s">These aren't deal-breakers yet, but nobody will be able to find them later.</p>
<div class="gapgrid">${gaps
    .map((g) => `<div class="gap"><span class="chip c-gap">Missing</span><p class="ptext">${esc(g.text)}</p><div class="ask">${ICON.ask}<p><b>Ask the hospital:</b> ${esc(g.followUpAsk)}</p></div><span class="ids">${esc(g.id)}</span></div>`)
    .join("")}</div></section>`;
}

function mattersMostHtml(input: SummaryInput): string {
  if (!input.headline) return "";
  const cards = FACILITY_IDS.map((id, i) => facilityCard(input, id, i)).join("");
  return `<section class="matters"><p class="eyebrow">What matters most</p><h2 class="sr">What matters most</h2><div class="cards">${cards}</div></section>${gapsHtml(input)}`;
}

// ---- the full checklist (collapsed by default) ----

function evidenceHtml(ev: Evidence): string {
  if (ev.verified) return quoteCard(ev.quote, ev.page);
  return `<figure class="quote unverified"><figcaption>${ICON.page}UNVERIFIED</figcaption><blockquote>“${esc(ev.quote)}”</blockquote><p class="warn">UNVERIFIED: quote not found in the document text (model cited page ${ev.claimedPage}).</p></figure>`;
}

function detailHtml(it: Item): string {
  if (!it.detail) return "";
  // The per-medication due/supply dump lives in the collapsed "Medication timing detail" block, not here.
  const d = it.ruleId === "RX-02" ? "Some first doses may not arrive in time; see Medication timing detail for this facility." : scrubTimes(it.detail);
  return `<p class="detail">${esc(d)}</p>`;
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
  const clock = it.resolveBy ? `<p class="resolve">${ICON.clock}Resolve by <b>${esc(fmtTime(it.resolveBy))}</b>${it.windowHours !== undefined ? ` (${it.windowHours}h window)` : ""}</p>` : "";
  const contra = it.contradictions
    .map(
      (c) => `<div class="contra"><span class="chip c-block">Packet disagrees</span>${c.note ? ` <span>${esc(c.note)}</span>` : ""}<div class="quotes">${quoteCard(c.quoteA, c.pageA, undefined, c.verifiedA === false)}${quoteCard(c.quoteB, c.pageB, undefined, c.verifiedB === false)}</div></div>`,
    )
    .join("");
  const evs = it.evidence.map(evidenceHtml).join("");
  const body = evs || contra ? `<div class="quotes">${evs}</div>${contra}` : `<p class="none">No supporting passage in the record.</p>`;
  const ask = it.followUpAsk ? `<div class="ask">${ICON.ask}<p><b>Ask the hospital:</b> ${esc(it.followUpAsk)}</p></div>` : "";
  return `<div class="item"><div class="q"><span class="state s-${it.state}">${STATE_LABEL[it.state]}</span><span class="qt">${esc(it.question)}</span><span class="rid">${esc(it.ruleId)}</span></div>${detailHtml(it)}${ask}${body}${showClock ? clock : ""}</div>`;
}

function facilitySection(input: SummaryInput, f: FacilityResult): string {
  const blocks = f.blocking.length ? f.blocking.map((i) => itemHtml(i, false)).join("") : `<p class="none">No blocking items.</p>`;
  const cond = f.conditional.length ? f.conditional.map((i) => itemHtml(i, true)).join("") : `<p class="none">No conditional items.</p>`;
  return `<details class="facility"><summary><span class="dot d-${f.verdict}"></span>${esc(name(input, f.facilityId))}<span class="v v-${f.verdict}">${VERDICT_LABEL[f.verdict]}</span><span class="count">${f.blocking.length} blocking · ${f.conditional.length} on a clock</span></summary>
<h3>Blocking items (${f.blocking.length})</h3>${blocks}
<h3>Items on a clock (${f.conditional.length})</h3>${cond}${medDetailHtml(input, f)}</details>`;
}

const FONT_CSS = `@font-face{font-family:"Space Grotesk";src:url("/fonts/space-grotesk.woff2") format("woff2");font-weight:300 700;font-display:swap}
@font-face{font-family:"Inter";src:url("/fonts/inter.woff2") format("woff2");font-weight:100 900;font-display:swap}`;

/** Shared palette and type, matching the Mind the Gap deck. */
export const BASE_CSS = `${FONT_CSS}
:root{--dark:#14213D;--dark2:#1F2E50;--light:#F6F4EF;--alt:#E9E6DD;--paper:#FBFBF8;--accent:#E07A3F;--accent-ink:#9A4514;--blue:#2F6FDB;--muted:#4A5568;--soft:#BFCBE0;--green:#237A4B;
--head:"Space Grotesk",ui-sans-serif,system-ui,sans-serif;--body:"Inter",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--light);color:var(--dark);font:16px/1.5 var(--body)}
h1,h2,h3,h4{font-family:var(--head);margin:0;line-height:1.15}
.eyebrow{font:600 13px/1.2 var(--body);letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin:0 0 10px}
.ic{width:1.1em;height:1.1em;flex:none;vertical-align:-.18em}
.rise{animation:rise .6s ease-out both;animation-delay:calc(var(--i,0) * 110ms)}
@keyframes rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.rise{animation:none}}`;

const PAGE_CSS = `${BASE_CSS}
.wrap{max-width:1280px;margin:0 auto;padding:0 28px}
.hero{background:var(--dark);color:var(--light);padding:44px 0 92px}
.hero h1{font-size:clamp(32px,4.4vw,54px);font-weight:700;max-width:900px}
.rule{width:96px;height:6px;background:var(--accent);margin:22px 0}
.facts{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:10px}
.facts li{background:var(--dark2);color:var(--light);border:1px solid #33456E;border-radius:999px;padding:8px 16px;font-weight:600;font-size:15px}
.meta{display:flex;flex-wrap:wrap;gap:8px 24px;margin-top:22px;color:var(--soft);font-size:14px}
.meta span{display:inline-flex;align-items:center;gap:8px}.meta code{color:var(--soft);font-size:12px}
.matters{margin-top:-60px}.matters>.eyebrow{display:none}.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px;align-items:start}
@media (max-width:1040px){.cards{grid-template-columns:1fr}}
.card{background:var(--paper);border-radius:20px;padding:0 24px 24px;box-shadow:0 12px 40px rgba(20,33,61,.12);overflow:hidden}
.badge{margin:0 -24px 20px;padding:20px 24px 18px;display:flex;flex-direction:column;gap:2px;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.badge .word{font:700 44px/1 var(--head)}.badge .sub{font-size:14px;font-weight:600;opacity:.92}
.b-accept{background:var(--green)}.b-conditional_accept{background:var(--blue)}.b-blocked{background:var(--accent);color:var(--dark)}.b-decline{background:var(--dark)}
.card h2{font-size:26px;font-weight:700}
.hl{font-size:17px;line-height:1.45;color:var(--muted);margin:8px 0 14px}
.stats{list-style:none;padding:0;margin:0 0 18px;display:flex;flex-wrap:wrap;gap:8px}
.stats li{display:inline-flex;align-items:center;gap:6px;background:var(--alt);border-radius:999px;padding:5px 12px;font-size:13px;font-weight:600}
.dofirst{font:600 12px/1 var(--body);letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:0 0 10px;padding-top:16px;border-top:2px solid var(--alt)}
.pris{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}
.pri{display:flex;gap:12px;background:var(--light);border-radius:14px;padding:14px;border-left:6px solid var(--soft)}
.pri.sev-tonight{border-left-color:var(--accent);background:#FBEDE3}
.pri.sev-block{border-left-color:var(--accent)}
.pri.sev-capability{border-left-color:var(--dark)}
.pri.sev-clock{border-left-color:var(--blue)}
.pri.sev-dose{border-left-color:var(--blue);background:#E9F0FC}
.num{flex:none;width:28px;height:28px;border-radius:50%;background:var(--dark);color:var(--light);display:grid;place-items:center;font:700 14px/1 var(--head)}
.pbody{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}
.ptop{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.ptext{margin:0;font-size:16px;font-weight:600;line-height:1.4}
.chip{display:inline-block;font:700 11px/1 var(--body);letter-spacing:.08em;text-transform:uppercase;padding:6px 9px;border-radius:999px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.c-tonight{background:var(--accent);color:var(--dark)}.c-block{background:#F5D3BE;color:var(--accent-ink)}.c-cap{background:var(--dark);color:var(--light)}
.c-clock{background:#D6E2F7;color:#1B4A9E}.c-dose{background:var(--blue);color:#fff}.c-gap{background:var(--alt);color:var(--muted)}
.due{display:inline-flex;align-items:center;gap:5px;font-weight:700;font-size:13px;color:var(--accent-ink)}
.ask{display:flex;gap:10px;align-items:flex-start;background:var(--paper);border-radius:10px;padding:10px 12px;color:var(--blue)}
.ask p{margin:0;color:var(--dark);font-size:14px;line-height:1.45}.ask b{color:var(--blue)}
.ids{font:11px/1 ui-monospace,Menlo,monospace;color:#8792A6}
.where>summary,.meddetail>summary{cursor:pointer;font-size:13px;font-weight:600;color:var(--blue);list-style:none;display:inline-flex;align-items:center;gap:6px}
.where>summary::before,.meddetail>summary::before{content:"";width:0;height:0;border:5px solid transparent;border-left:7px solid currentColor;transition:transform .2s}
.where[open]>summary::before,.meddetail[open]>summary::before{transform:rotate(90deg) translateX(2px)}
.where>summary::-webkit-details-marker,.meddetail>summary::-webkit-details-marker,.facility>summary::-webkit-details-marker{display:none}
.quotes{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-top:10px}
.quote{margin:0;background:var(--paper);border-radius:10px;padding:12px 14px;border-left:5px solid var(--accent);box-shadow:0 4px 14px rgba(20,33,61,.07)}
.quote figcaption{display:flex;align-items:center;gap:6px;font:700 11px/1 var(--body);letter-spacing:.1em;text-transform:uppercase;color:var(--accent-ink);margin-bottom:6px}
.quote blockquote{margin:0;font:italic 15px/1.45 Georgia,"Times New Roman",serif}
.quote.unverified{border-left-color:#B42318;background:#FFF4EE}.warn{margin:6px 0 0;font-size:12px;color:#B42318;font-weight:600}
.calm{display:flex;gap:8px;align-items:center;color:var(--green);font-weight:600}
.gaps{margin-top:40px;background:var(--alt);border-radius:20px;padding:28px}
.gaps h2{font-size:28px}.lede-s{color:var(--muted);margin:6px 0 18px}
.gapgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.gap{background:var(--light);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:10px;align-items:flex-start}
.full{margin:56px 0 72px}
.full>h2{font-size:30px}.full>.lede-s{max-width:760px}
.panel{background:var(--paper);border-radius:20px;padding:24px;margin-top:20px;overflow-x:auto}
.panel h3{font-size:20px;margin-bottom:12px}
table{border-collapse:separate;border-spacing:0;width:100%;font-size:14px}
th,td{padding:10px 12px;text-align:left;vertical-align:top;border-bottom:1px solid var(--alt)}
thead th{font:600 12px/1.2 var(--body);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
tbody th{font-weight:600;width:24%}
.v{display:inline-block;padding:3px 10px;border-radius:999px;font-weight:700;font-size:12px;color:#fff}
.v-accept{background:var(--green)}.v-conditional_accept{background:var(--blue)}.v-blocked{background:var(--accent);color:var(--dark)}.v-decline{background:var(--dark)}
.criteria td{font-weight:600}
.criteria td::before{content:"";display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:8px;background:var(--soft);vertical-align:0}
td.s-met::before{background:var(--green)}td.s-not_met::before{background:var(--accent)}td.s-unknown::before{background:#8792A6}td.s-contradictory::before{background:#B42318}td.s-not_applicable::before{background:var(--alt)}
.cflag{font-weight:400;font-size:13px;margin-top:6px;color:var(--muted)}
.facility{background:var(--paper);border-radius:20px;margin-top:14px;padding:0 24px}
.facility>summary{cursor:pointer;list-style:none;display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:20px 0;font:700 20px/1.2 var(--head)}
.facility>summary .count{font:500 14px var(--body);color:var(--muted);margin-left:auto}
.facility[open]{padding-bottom:20px}
.dot{width:12px;height:12px;border-radius:50%}.d-accept{background:var(--green)}.d-conditional_accept{background:var(--blue)}.d-blocked{background:var(--accent)}.d-decline{background:var(--dark)}
.facility h3{font:600 12px/1 var(--body);letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:18px 0 10px}
.item{border-top:1px solid var(--alt);padding:14px 0;display:flex;flex-direction:column;gap:8px}
.q{display:flex;flex-wrap:wrap;gap:10px;align-items:baseline}.qt{font-weight:600;flex:1;min-width:240px}
.rid{font:11px ui-monospace,Menlo,monospace;color:#8792A6}
.state{font:700 11px/1 var(--body);letter-spacing:.06em;text-transform:uppercase;padding:5px 8px;border-radius:999px;background:var(--alt);color:var(--muted)}
.state.s-met{background:#D9EEE2;color:var(--green)}.state.s-not_met{background:#F5D3BE;color:var(--accent-ink)}.state.s-contradictory{background:#FBDAD6;color:#B42318}
.detail,.none{color:var(--muted);margin:0;font-size:14px}
.resolve{display:flex;gap:6px;align-items:center;margin:0;color:var(--accent-ink);font-size:14px}
.contra{display:flex;flex-direction:column;gap:4px;font-size:14px}
.meddetail{margin-top:18px}.meddetail table{margin-top:10px}.meddetail .risk td{background:#FBEDE3}
footer{color:var(--muted);font-size:13px;padding:0 0 40px}
@media (max-width:640px){.wrap{padding:0 16px}.card{padding:0 16px 18px}.badge{margin:0 -16px 16px}.facility{padding:0 16px}}
@media print{body{background:#fff}.hero{padding:24px 0}.matters{margin-top:16px}.card{box-shadow:none;border:1px solid var(--alt);break-inside:avoid}.cards{grid-template-columns:repeat(3,1fr)}.rise{animation:none}.facility{break-before:page}.item{break-inside:avoid}table{break-inside:avoid}thead{display:table-header-group}.gaps{break-inside:avoid}}`;

export function renderSummary(input: SummaryInput): string {
  const { result } = input;
  const fs = FACILITY_IDS.map((id) => result.facilities[id]);
  const arrival = input.arrivalAt ?? input.evaluatedAt;
  const head = fs.map((f) => `<th>${esc(name(input, f.facilityId))}</th>`).join("");
  const row = (label: string, cell: (f: FacilityResult) => string) => `<tr><th scope="row">${label}</th>${fs.map((f) => `<td>${cell(f)}</td>`).join("")}</tr>`;
  const table = `<table class="verdicts"><thead><tr><th></th>${head}</tr></thead><tbody>
${row("Verdict", (f) => `<span class="v v-${f.verdict}">${VERDICT_LABEL[f.verdict]}</span>`)}
${row("Blocking items", (f) => String(f.blocking.length))}
${row("Items on a clock", (f) => String(f.conditional.length))}
${row("First dose at risk", (f) => (f.firstDoseAtRisk ? "Yes" : "No"))}
</tbody></table>`;

  const grid = `<table class="criteria"><thead><tr><th>Area</th>${head}</tr></thead><tbody>${CRITERIA.map(
    (c) => `<tr><th scope="row">${esc(CRITERION_LABEL[c] ?? c)}</th>${FACILITY_IDS.map((id) => {
      const cell = result.criteriaView[c][id];
      const flags = (cell.flags ?? []).map((fl) => `<div class="cflag"><span class="chip c-gap">${esc(fl.chip)}</span> ${esc(fl.text)}</div>`).join("");
      return `<td class="s-${cell.worstState}">${STATE_LABEL[cell.worstState]}${flags}</td>`;
    }).join("")}</tr>`,
  ).join("")}</tbody></table>`;

  const snapshot = input.headline ? snapshotHtml(input.headline.patientSnapshot) : "";
  const arrivalText = input.arrivalAt ? `Arriving ${friendlyWhen(input.arrivalAt, arrival)} (${fmtTime(input.arrivalAt)})` : `Arrival ${fmtTime(input.evaluatedAt)} (not stated in the record; wall clock used)`;
  const note = !input.headline ? "" : input.headline.source === "deterministic" ? "Summary built straight from the checklist." : "Summary written by AI from the checklist; every item links back to the rules and quotes below.";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Referral screening summary ${esc(input.parseId)}</title>
<style>
${PAGE_CSS}
</style></head><body>
<header class="hero"><div class="wrap">
<p class="eyebrow">Referral screening</p>
<h1>Which facility can safely take this patient tonight?</h1>
<div class="rule"></div>
${snapshot}
<div class="meta"><span>${ICON.arrive}${esc(arrivalText)}</span><span>Parse <code>${esc(input.parseId)}</code></span></div>
</div></header>
<main class="wrap">
${mattersMostHtml(input)}
<section class="full"><p class="eyebrow">The detail</p><h2>The full checklist</h2>
<p class="lede-s">Every rule each facility checks, with the exact words from the packet behind each answer. ${esc(note)}</p>
<div class="panel"><h3>Verdicts</h3>${table}</div>
${fs.map((f) => facilitySection(input, f)).join("\n")}
<div class="panel grid"><h3>Criteria view</h3>${grid}</div>
</section>
</main>
<footer class="wrap">Demo with synthetic facilities and packets. Always confirm against the source record before acting.</footer>
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

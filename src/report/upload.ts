/**
 * Single-page upload UI served at `/`: pick a referral PDF, then watch the screen build up step by step
 * (each model call shows as a checklist line, and what it found appears as soon as it lands).
 */
export const uploadPage = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mind the Gap</title>
<style>
  :root { --bg:#f6f7f9; --card:#fff; --ink:#16181d; --muted:#5b6270; --line:#dfe3e8; --accent:#1f5eff; --bad:#b42318; --ok:#067647; --warn:#9a6700; --warnbg:#fff7e0;
          --v-accept:#067647; --v-conditional_accept:#9a6700; --v-blocked:#b42318; --v-decline:#6b7280; }
  @media (prefers-color-scheme: dark) { :root { --bg:#111317; --card:#1a1d23; --ink:#eceef2; --muted:#9aa2b1; --line:#2c313a; --accent:#6d95ff; --bad:#ff7b72; --ok:#4ade80; --warn:#f5c451; --warnbg:#2a2412;
          --v-accept:#4ade80; --v-conditional_accept:#f5c451; --v-blocked:#ff7b72; --v-decline:#9aa2b1; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif; }
  main { max-width:720px; margin:0 auto; padding:48px 16px; }
  h1 { font-size:28px; margin:0 0 4px; }
  h2 { font-size:15px; margin:0 0 10px; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); }
  p.lede { color:var(--muted); margin:0 0 28px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:24px; margin-bottom:16px; }
  .drop { display:block; border:2px dashed var(--line); border-radius:10px; padding:36px 16px; text-align:center; cursor:pointer; color:var(--muted); }
  .drop.over, .drop:hover { border-color:var(--accent); color:var(--ink); }
  .drop strong { color:var(--ink); display:block; margin-bottom:4px; word-break:break-all; }
  input[type=file] { display:none; }
  button, .btn { display:inline-block; margin-top:16px; width:100%; padding:12px; border:0; border-radius:8px; background:var(--accent); color:#fff; font:inherit; font-weight:600; cursor:pointer; text-align:center; text-decoration:none; }
  button:disabled { opacity:.5; cursor:default; }
  button.ghost { background:transparent; color:var(--accent); border:1px solid var(--line); }
  .hidden { display:none !important; }
  .note { font-size:13px; color:var(--muted); margin-top:20px; }
  .note a { color:var(--accent); }
  .links { margin-top:12px; font-size:14px; }
  .links a { color:var(--accent); margin-right:16px; }

  .head { display:flex; justify-content:space-between; align-items:baseline; gap:12px; }
  .head b { font-size:17px; }
  .timer { color:var(--muted); font-variant-numeric:tabular-nums; font-size:14px; white-space:nowrap; }
  .bar { height:6px; background:var(--line); border-radius:3px; overflow:hidden; margin:12px 0 16px; }
  .bar i { display:block; height:100%; width:0; background:var(--accent); transition:width .4s ease; }
  ol.steps { list-style:none; margin:0; padding:0; }
  ol.steps li { display:grid; grid-template-columns:22px 1fr auto; gap:8px; padding:6px 0; border-top:1px solid var(--line); font-size:15px; align-items:start; }
  ol.steps li:first-child { border-top:0; }
  ol.steps .ic { width:18px; height:18px; margin-top:2px; border-radius:50%; border:2px solid var(--line); display:inline-flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; }
  ol.steps li.pending { color:var(--muted); }
  ol.steps li.running .ic { border-color:var(--line); border-top-color:var(--accent); animation:s .8s linear infinite; }
  ol.steps li.done .ic { border-color:var(--ok); color:var(--ok); }
  ol.steps li.failed .ic { border-color:var(--bad); color:var(--bad); }
  ol.steps .detail { display:block; font-size:13px; color:var(--muted); }
  ol.steps li.failed .detail { color:var(--bad); }
  ol.steps .dur { font-size:12px; color:var(--muted); font-variant-numeric:tabular-nums; padding-top:2px; }
  @keyframes s { to { transform:rotate(360deg); } }
  .spin { display:inline-block; width:14px; height:14px; border:2px solid var(--line); border-top-color:var(--accent); border-radius:50%; animation:s .8s linear infinite; vertical-align:-2px; margin-right:8px; }

  .found section { padding:12px 0; border-top:1px solid var(--line); }
  .found section:first-of-type { border-top:0; padding-top:0; }
  .found h3 { font-size:14px; margin:0 0 6px; }
  .chips { display:flex; flex-wrap:wrap; gap:6px; }
  .chip { font-size:13px; padding:2px 8px; border-radius:999px; border:1px solid var(--line); }
  .chip.flag { border-color:var(--warn); color:var(--warn); }
  ul.plain { margin:0; padding-left:18px; font-size:14px; }
  ul.plain li { margin:2px 0; }
  .change { color:var(--warn); font-weight:600; }
  .muted { color:var(--muted); font-size:14px; }
  .warnbox { background:var(--warnbg); border:1px solid var(--warn); color:var(--ink); border-radius:8px; padding:10px 14px; margin-bottom:16px; font-size:14px; }
  .warnbox ul { margin:4px 0 0; padding-left:18px; }
  .err { color:var(--bad); }
  details summary { cursor:pointer; color:var(--muted); font-size:13px; margin-top:8px; }
  details pre { white-space:pre-wrap; word-break:break-word; font-size:12px; color:var(--muted); }

  .verdicts { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:10px; }
  .verdict { border:1px solid var(--line); border-radius:10px; padding:12px; }
  .verdict .name { font-size:14px; font-weight:600; }
  .verdict .v { font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:.03em; }
  .verdict .why { font-size:13px; color:var(--muted); margin-top:4px; }
</style>
</head>
<body>
<main>
  <h1>Mind the Gap</h1>
  <p class="lede">Upload a hospital-to-SNF referral packet (PDF) to screen it against the facilities' acceptance policies.</p>

  <div class="card" id="pick">
    <form id="f">
      <label class="drop" id="drop" for="file">
        <strong id="fname">Drop a PDF here or click to choose</strong>
        <span>Referral packet, about 60 pages</span>
      </label>
      <input type="file" id="file" accept="application/pdf,.pdf">
      <button id="go" disabled>Screen packet</button>
    </form>
    <div id="upmsg" class="note"></div>
  </div>

  <div id="run" class="hidden">
    <div id="warn"></div>
    <div class="card" id="outcome"></div>
    <div class="card">
      <div class="head"><b id="title">Screening the packet</b><span class="timer" id="timer"></span></div>
      <div class="bar"><i id="bar"></i></div>
      <ol class="steps" id="steps"></ol>
    </div>
    <div class="card found" id="found"><h2 id="foundTitle">Found so far</h2><div id="foundBody" class="muted">Findings show up here as each part of the packet is read.</div></div>
    <button class="ghost" id="again" type="button">Screen another packet</button>
  </div>

  <p class="note">No packet handy? Download a synthetic one: <a href="/samples/synthetic-elena-packet.pdf">Elena Mercado</a> · <a href="/samples/synthetic-harold-packet.pdf">Harold Jennings</a></p>
  <p class="note">Demo uses synthetic facilities and packets only. Do not upload real patient data.</p>
</main>
<script>
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const input = $("file"), drop = $("drop"), go = $("go");
const VERDICT = { accept:"Accept", conditional_accept:"Conditional accept", blocked:"Blocked", decline:"Decline" };
const FLAGS = { tubeFed:"Tube feeding", insulinRequired:"Insulin", ventDependent:"Ventilator", trach:"Trach", dialysis:"Dialysis", elopementRisk:"Elopement risk", medicaidPending:"Medicaid pending" };
let file = null, facilityNames = {}, runToken = 0, timerId = null;

fetch("/api/facilities").then((r) => r.json()).then((fs) => { for (const f of fs) facilityNames[f.id] = f.name; }).catch(() => {});

function pick(f) { if (!f) return; file = f; $("fname").textContent = f.name; go.disabled = false; }
input.addEventListener("change", () => pick(input.files[0]));
["dragenter","dragover"].forEach((e) => drop.addEventListener(e, (ev) => { ev.preventDefault(); drop.classList.add("over"); }));
["dragleave","drop"].forEach((e) => drop.addEventListener(e, (ev) => { ev.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", (ev) => pick(ev.dataTransfer.files[0]));
$("again").addEventListener("click", () => { runToken++; clearInterval(timerId); history.replaceState(null, "", location.pathname); $("run").classList.add("hidden"); $("pick").classList.remove("hidden"); go.disabled = !file; });

$("f").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (!file) return;
  go.disabled = true;
  $("upmsg").innerHTML = '<span class="spin"></span>Uploading…';
  try {
    const body = new FormData(); body.append("file", file);
    const r = await fetch("/api/parses", { method: "POST", body });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Upload failed (" + r.status + ")");
    $("upmsg").textContent = "";
    follow(j.parseId);
  } catch (e) {
    $("upmsg").innerHTML = '<span class="err">' + esc(e && e.message ? e.message : e) + "</span>";
    go.disabled = false;
  }
});

// ---- live view ----
const fmtDur = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };

async function follow(id) {
  const token = ++runToken;
  history.replaceState(null, "", "#parse=" + id); // a reload picks the run back up
  $("pick").classList.add("hidden");
  $("run").classList.remove("hidden");
  $("outcome").classList.add("hidden");
  $("warn").innerHTML = "";
  $("steps").innerHTML = '<li class="pending"><span class="ic"></span><span>Starting…</span><span></span></li>';
  $("foundBody").innerHTML = "Findings show up here as each part of the packet is read.";
  let startedAt = Date.now(), finished = false, misses = 0;
  clearInterval(timerId);
  timerId = setInterval(() => { if (!finished) $("timer").textContent = fmtDur(Date.now() - startedAt); }, 500);
  while (token === runToken) {
    let rec;
    try {
      const r = await fetch("/api/parses/" + encodeURIComponent(id));
      if (r.status === 404) { rec = { status: "failed", error: "This screen is no longer on the server (it may have restarted). Upload the packet again." }; }
      else rec = await r.json();
      misses = 0;
    } catch {
      if (++misses > 10) { rec = { status: "failed", error: "Lost contact with the server. Check your connection and try again." }; }
      else { await sleep(2000); continue; }
    }
    if (token !== runToken) return;
    if (rec.createdAt) startedAt = Date.parse(rec.createdAt);
    render(rec);
    if (rec.status !== "processing") {
      finished = true; clearInterval(timerId);
      $("timer").textContent = rec.completedAt ? fmtDur(Date.parse(rec.completedAt) - startedAt) : "";
      return;
    }
    await sleep(1500);
  }
}

function render(rec) {
  const steps = rec.steps || [];
  const done = steps.filter((s) => s.status === "done" || s.status === "failed").length;
  $("bar").style.width = (rec.status === "complete" ? 100 : steps.length ? Math.round((done / steps.length) * 100) : 3) + "%";
  $("title").textContent = rec.status === "complete" ? "Screen complete" : rec.status === "failed" ? "Screen stopped" : "Screening the packet… " + done + " of " + (steps.length || "?") + " steps";
  if (steps.length) $("steps").innerHTML = steps.map(stepHtml).join("");
  renderFound(rec.partial || {});
  $("foundTitle").textContent = rec.status === "processing" ? "Found so far" : "What the packet says";
  const w = rec.warnings || [];
  $("warn").innerHTML = w.length ? '<div class="warnbox"><b>Parts of the packet couldn\\'t be read.</b><ul>' + w.map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul></div>" : "";
  if (rec.status === "complete") renderOutcome(rec);
  if (rec.status === "failed") renderFailure(rec);
}

function stepHtml(s) {
  const icon = s.status === "done" ? "✓" : s.status === "failed" ? "✕" : "";
  const dur = s.startedAt && s.finishedAt ? fmtDur(Date.parse(s.finishedAt) - Date.parse(s.startedAt))
    : s.startedAt && s.status === "running" ? fmtDur(Date.now() - Date.parse(s.startedAt)) : "";
  const detail = s.status === "failed" ? "Couldn't read this part" : s.status === "running" ? "Reading…" : s.detail || "";
  return '<li class="' + s.status + '"><span class="ic">' + icon + "</span><span>" + esc(s.label) + (detail ? '<span class="detail">' + esc(detail) + "</span>" : "") + '</span><span class="dur">' + dur + "</span></li>";
}

function renderFound(p) {
  const parts = [];
  const pt = p.patient, tm = p.timing || {};
  if (pt) {
    const flags = Object.keys(FLAGS).filter((k) => pt[k] === true).map((k) => '<span class="chip flag">' + FLAGS[k] + "</span>");
    if (pt.diagnoses && pt.diagnoses.heartFailure) flags.push('<span class="chip flag">Heart failure</span>');
    const facts = [];
    if (pt.targetUnit) facts.push('<span class="chip">Needs: ' + esc(String(pt.targetUnit).replace(/_/g, " ")) + "</span>");
    if (pt.weightKg) facts.push('<span class="chip">' + esc(pt.weightKg) + " kg</span>");
    if (tm.arrivalAt) facts.push('<span class="chip">Arrives ' + esc(when(tm.arrivalAt)) + "</span>");
    parts.push("<section><h3>Patient</h3><div class=\\"chips\\">" + (facts.concat(flags).join("") || '<span class="muted">No special-care flags in the record.</span>') + "</div></section>");
  }
  if (p.medications) {
    const changes = p.medications.filter((m) => m.doseChanges && m.doseChanges.length);
    const list = p.medications.slice(0, 40).map((m) => "<li>" + esc(m.name) + (m.dose && !m.name.includes(m.dose) ? " " + esc(m.dose) : "") + (m.schedule ? ' <span class="muted">' + esc(m.schedule) + "</span>" : "") +
      (m.doseChanges || []).map((d) => ' <span class="change">— list says ' + esc(d.listedDose) + ", a later note says " + esc(d.noteDose) + "</span>").join("") + "</li>").join("");
    parts.push("<section><h3>Medications (" + p.medications.length + ")" + (changes.length ? ' · <span class="change">' + changes.length + " to confirm</span>" : "") + "</h3>" +
      (list ? '<details' + (changes.length ? " open" : "") + '><summary>Show list</summary><ul class="plain">' + list + "</ul></details>" : '<span class="muted">None listed.</span>') + "</section>");
  }
  if (p.categories && Object.keys(p.categories).length) {
    const rows = Object.values(p.categories).map((c) => "<li>" + esc(c.label) + ': <span class="muted">' + c.answered + " of " + c.total + " answered by the record" + (c.answered < c.total ? ", " + (c.total - c.answered) + " not addressed" : "") + "</span></li>").join("");
    parts.push('<section><h3>Policy questions</h3><ul class="plain">' + rows + "</ul></section>");
  }
  if (p.sections && p.sections.length) {
    parts.push('<section><h3>Packet sections (' + (p.pageCount || "?") + ' pages)</h3><details><summary>Show sections</summary><ul class="plain">' +
      p.sections.map((s) => "<li>" + esc(s.title) + ' <span class="muted">pp. ' + s.startPage + (s.endPage !== s.startPage ? "–" + s.endPage : "") + "</span></li>").join("") + "</ul></details></section>");
  }
  if (parts.length) $("foundBody").className = "", $("foundBody").innerHTML = parts.join("");
}

function renderOutcome(rec) {
  const fs = rec.result ? rec.result.facilities : {};
  const hl = rec.headline || {};
  const cards = Object.keys(fs).sort().map((id) => {
    const f = fs[id], why = hl.perFacility && hl.perFacility[id] ? hl.perFacility[id].headline : "";
    return '<div class="verdict"><div class="name">' + esc(facilityNames[id] || "Facility " + id) + '</div><div class="v" style="color:var(--v-' + f.verdict + ')">' + VERDICT[f.verdict] + "</div>" + (why ? '<div class="why">' + esc(why) + "</div>" : "") + "</div>";
  }).join("");
  $("outcome").innerHTML = "<h2>Result</h2>" + (hl.patientSnapshot ? '<p style="margin:0 0 12px">' + esc(hl.patientSnapshot) + "</p>" : "") + '<div class="verdicts">' + cards + "</div>" +
    '<a class="btn" href="/api/parses/' + rec.parseId + '/summary">Open the full summary</a>' +
    '<div class="links"><a href="/api/parses/' + rec.parseId + '/call-sheet">Call sheet (JSON)</a><a href="/api/parses/' + rec.parseId + '">Full result (JSON)</a></div>';
  $("outcome").classList.remove("hidden");
}

function renderFailure(rec) {
  const failed = (rec.steps || []).find((s) => s.status === "failed");
  const where = failed ? "while reading “" + esc(failed.label) + "”" : "";
  $("outcome").innerHTML = '<h2>Screen stopped</h2><p class="err" style="margin:0">The screen couldn\\'t finish ' + where + ". Anything found before that is shown below.</p>" +
    "<details><summary>Technical details</summary><pre>" + esc(rec.error || "unknown error") + "</pre></details>" +
    (file ? '<button id="retry" type="button">Try again</button>' : "");
  $("outcome").classList.remove("hidden");
  const retry = $("retry");
  if (retry) retry.addEventListener("click", () => { $("run").classList.add("hidden"); $("pick").classList.remove("hidden"); $("f").requestSubmit(); });
}

function when(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const resume = /#parse=([\\w-]+)/.exec(location.hash);
if (resume) follow(resume[1]);
</script>
</body>
</html>`;

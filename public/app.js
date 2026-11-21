(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const BADGE = { accept: "ACCEPT", conditional_accept: "CONDITIONAL", blocked: "BLOCKED", decline: "DECLINE" };
  const SEV = { tonight: "TONIGHT", block: "BLOCKED", capability: "CAN'T DO HERE", clock: "ON THE CLOCK" };
  const SAMPLES = [
    ["elena", "Elena Mercado — HF, insulin, paperwork gaps (51 pp)"],
    ["harold", "Harold Jennings — CHF, telemetry, dose conflict (40 pp)"],
    ["carepatron", "Real discharge summary (2 pp)"],
    ["cdph", "Blank CA transfer form"],
  ];
  const state = { facility: "all", parseId: null, rec: null, timer: null, facilities: [], available: {} };

  // ---- friendly times (port of src/report/when.ts; never show ISO) ----
  const DAY = 864e5, sod = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const clock = (d) => `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${d.getHours() < 12 ? "AM" : "PM"}`;
  function when(iso, arrIso) {
    const d = new Date(iso);
    if (!iso || isNaN(d)) return "";
    const arr = arrIso && !isNaN(new Date(arrIso)) ? new Date(arrIso) : new Date();
    const days = Math.round((sod(d) - sod(arr)) / DAY), t = clock(d), eve = arr.getHours() >= 17;
    if (days < 0) return `already past (${t})`;
    if (days === 0) return `${d.getHours() >= 17 || d.getHours() < 5 ? "tonight" : "today"} ${t}`;
    if (days === 1) return `${eve && d.getHours() < 5 ? "tonight" : "tomorrow"} ${t}`;
    if (days < 7) return `${d.toLocaleString("en-US", { weekday: "short" })} ${t}`;
    return `${d.toLocaleString("en-US", { month: "short" })} ${d.getDate()} ${t}`;
  }
  const scrub = (text, arr) => String(text ?? "").replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?/g, (m) => when(m, arr));

  // ---- entry points ----
  async function start(promise) {
    clearTimeout(state.timer);
    $("results").innerHTML = `<h2>3. Result</h2><div class="status"><span class="spin"></span>Reading the packet...</div>`;
    try {
      const r = await promise;
      const body = await r.json().catch(() => ({}));
      if (!r.ok) return showError(body.error || "Something went wrong. Try again.");
      state.parseId = body.parseId;
      poll();
    } catch {
      showError("Couldn't reach the server. Check it's running, then try again.");
    }
  }
  const upload = (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    start(fetch("/api/parses", { method: "POST", body: fd }));
  };
  async function poll() {
    try {
      const rec = await (await fetch(`/api/parses/${state.parseId}`)).json();
      state.rec = rec;
      render();
      if (rec.status === "processing") state.timer = setTimeout(poll, 1500);
    } catch {
      state.timer = setTimeout(poll, 3000);
    }
  }

  // ---- results ----
  function showError(msg) {
    $("results").innerHTML = `<h2>3. Result</h2><div class="status err"><b>That didn't work.</b><br>${esc(msg)}<br><small>Try again, or pick a sample packet.</small></div>`;
  }
  const facName = (id) => (state.facilities.find((f) => f.id === id) || {}).name || `Facility ${id}`;
  const shortName = (id) => facName(id).split(" ")[0];

  function priority(t, arr) {
    const confirm = t.ruleIds.some((r) => r.startsWith("MEDREC:"));
    const chip = confirm ? "CONFIRM DOSE" : SEV[t.severity];
    const due = t.dueBy ? (t.ruleIds.includes("ACU-06") ? "before first meal" : `by ${when(t.dueBy, arr)}`) : "";
    return `<li class="pri sev-${t.severity}${confirm ? " sev-confirm" : ""}"><span class="sev">${chip}</span> ${esc(scrub(t.text, arr))}${due ? ` <span class="due">${esc(due)}</span>` : ""}${t.followUpAsk ? `<div class="ask">Ask: ${esc(t.followUpAsk)}</div>` : ""}</li>`;
  }

  function card(rec, id) {
    const f = rec.result.facilities[id], p = rec.headline.perFacility[id], arr = rec.arrivalAt || rec.evaluatedAt;
    const gaps = rec.result.packetGaps || [];
    return `<div class="card card-${f.verdict}"><div class="badge b-${f.verdict}">${BADGE[f.verdict]}</div><h3>${esc(facName(id))}</h3>
<p class="hl">${esc(scrub(p.headline, arr))}</p>
${f.firstDoseAtRisk ? `<div class="risk">First dose may not arrive in time.</div>` : ""}
<ol>${p.topPriorities.map((t) => priority(t, arr)).join("")}</ol>
${gaps.length ? `<div class="sub-h">Missing from the packet</div><ul>${gaps.map((g) => `<li class="sev-gap"><span class="sev">PACKET GAP</span> ${esc(g.text)}<div class="ask">Ask: ${esc(g.followUpAsk)}</div></li>`).join("")}</ul>` : ""}</div>`;
  }

  function confirmBlock(rec) {
    const m = rec.result.medRec || [];
    if (!m.length) return "";
    return `<div class="card" style="margin-top:14px"><div class="sub-h" style="border:0;margin-top:0">Confirm with the hospital</div><ul class="sev-confirm" style="list-style:none;padding:0;margin:0">${m.map((x) => `<li style="margin:6px 0"><span class="sev">CONFIRM DOSE</span> ${esc(scrub(x.text, rec.arrivalAt))}<div class="ask">Ask: ${esc(x.followUpAsk)}</div></li>`).join("")}</ul></div>`;
  }

  function render() {
    const rec = state.rec, box = $("results");
    if (!rec) return;
    if (rec.status === "processing") return void (box.innerHTML = `<h2>3. Result</h2><div class="status"><span class="spin"></span>Reading the packet... this can take a minute.</div>`);
    if (rec.status === "failed") return showError(rec.error || "The packet couldn't be read.");
    const ids = state.facility === "all" ? ["A", "B", "C"] : [state.facility];
    const banner = rec.source === "fixture" ? `<div class="banner">Demo result from the golden test fixture — live document extraction runs once an API key is configured.</div>` : "";
    box.innerHTML = `<h2>3. Result</h2>${banner}<p class="snap">${esc(scrub(rec.headline.patientSnapshot, rec.arrivalAt))}</p>
<div class="cols ${ids.length === 3 ? "n3" : ""}">${ids.map((id) => card(rec, id)).join("")}</div>${confirmBlock(rec)}
<div class="links"><a href="/api/parses/${rec.parseId}/summary" target="_blank" rel="noopener">Printable summary</a><a href="#" id="print">Print this page</a></div>
<details id="cs"><summary>Call sheet: what to ask the hospital</summary><div id="cs-body" class="none">Loading...</div></details>`;
    $("print").onclick = (e) => { e.preventDefault(); window.print(); };
    $("cs").addEventListener("toggle", loadCallSheet, { once: true });
  }

  async function loadCallSheet() {
    const body = $("cs-body"), rec = state.rec;
    try {
      const rows = await (await fetch(`/api/parses/${rec.parseId}/call-sheet`)).json();
      body.className = "";
      body.innerHTML = `<ul>${rows.map((r) => `<li><b>${esc(r.facilityId ? shortName(r.facilityId) : "All")}</b> · ${esc(SEV[r.severity] || r.severity.toUpperCase())}: ${esc(r.followUpAsk)}</li>`).join("")}</ul>`;
    } catch { body.textContent = "Couldn't load the call sheet."; }
  }

  // ---- facility selector ----
  function renderFacilities() {
    const first = (s) => s.split(/(?<=\.)\s/)[0];
    const opts = [...state.facilities.map((f) => ({ id: f.id, name: f.name.split(" ")[0], desc: first(f.description) })), { id: "all", name: "All three", desc: "Compare side by side" }];
    $("facilities").innerHTML = opts.map((o) => `<button type="button" role="radio" class="fac" data-id="${o.id}" aria-checked="${o.id === state.facility}"><b>${esc(o.name)}</b><span>${esc(o.desc)}</span></button>`).join("");
    $("facilities").querySelectorAll("button").forEach((b) => (b.onclick = () => { state.facility = b.dataset.id; renderFacilities(); render(); }));
  }

  // ---- init ----
  function renderSamples() {
    $("samples").innerHTML = SAMPLES.map(([n, t]) => `<button type="button" class="sample" data-n="${n}"${state.available[n] === false ? ' disabled title="Not on this machine. Run npm run make-sample."' : ""}>${esc(t)}</button>`).join("");
    $("samples").querySelectorAll("button").forEach((b) => (b.onclick = () => start(fetch(`/api/parses/sample/${b.dataset.n}`, { method: "POST" }))));
  }
  const drop = $("drop");
  $("file").onchange = (e) => upload(e.target.files[0]);
  drop.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("file").click(); } };
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add("over"); };
  drop.ondragleave = () => drop.classList.remove("over");
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove("over"); upload(e.dataTransfer.files[0]); };

  renderSamples();
  Promise.all([fetch("/api/facilities").then((r) => r.json()), fetch("/api/samples").then((r) => r.json())]).then(([f, s]) => { state.facilities = f; state.available = s; renderFacilities(); renderSamples(); }).catch(() => {});
})();

import { BASE_CSS } from "./summary.js";

/** Single-page upload UI served at `/`: pick a referral PDF (or a synthetic sample), poll the parse, open the summary. */
export const uploadPage = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mind the Gap</title>
<style>
${BASE_CSS}
.hero{background:var(--dark);color:var(--light);padding:56px 0 120px}
.wrap{max-width:1040px;margin:0 auto;padding:0 24px}
.hero h1{font-size:clamp(44px,7vw,84px);font-weight:700;line-height:1}
.rule{width:96px;height:6px;background:var(--accent);margin:24px 0}
.lede{font-size:clamp(18px,2.2vw,22px);line-height:1.45;color:var(--soft);max-width:720px;margin:0}
.path{display:block;width:100%;height:auto;margin-top:40px}
main.wrap{margin-top:-72px;padding-bottom:56px}
.grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:22px;align-items:start}
@media (max-width:860px){.grid{grid-template-columns:1fr}}
.card{background:var(--paper);border-radius:20px;padding:28px;box-shadow:0 12px 40px rgba(20,33,61,.12)}
.card h2{font-size:24px;margin-bottom:6px}
.card .sub{color:var(--muted);margin:0 0 20px}
.drop{display:flex;flex-direction:column;align-items:center;gap:6px;border:2px dashed var(--soft);border-radius:16px;padding:34px 16px;text-align:center;cursor:pointer;color:var(--muted);background:var(--light);transition:border-color .2s,background .2s}
.drop.over,.drop:hover{border-color:var(--blue);background:#EEF3FC}
.drop svg{width:44px;height:44px;color:var(--blue)}
.drop strong{color:var(--dark);font-size:17px;overflow-wrap:anywhere}
input[type=file]{display:none}
.go{margin-top:16px;width:100%;padding:15px;border:0;border-radius:12px;background:var(--accent);color:var(--dark);font:700 17px var(--head);cursor:pointer;transition:transform .1s,opacity .2s}
.go:hover:not(:disabled){transform:translateY(-1px)}
.go:disabled{opacity:.45;cursor:default}
.samples{display:flex;flex-direction:column;gap:12px}
.sample{display:flex;gap:14px;align-items:flex-start;background:var(--light);border-radius:14px;padding:16px;border-left:6px solid var(--blue)}
.sample.h{border-left-color:var(--accent)}
.avatar{flex:none;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font:700 18px var(--head);color:var(--light);background:var(--blue)}
.sample.h .avatar{background:var(--accent);color:var(--dark)}
.sample h3{font-size:18px}.sample p{margin:4px 0 10px;color:var(--muted);font-size:14px;line-height:1.45}
.sample .row{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center}
.try{border:0;border-radius:999px;padding:8px 16px;background:var(--dark);color:var(--light);font:600 14px var(--body);cursor:pointer}
.try:disabled{opacity:.45;cursor:default}
.sample a{font-size:13px;color:var(--blue);font-weight:600}
.note{font-size:13px;color:var(--muted);margin:18px 0 0}
#progress{display:none;margin-top:22px}
#progress.on{display:block}
.steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}
.step{display:flex;gap:12px;align-items:center;color:var(--muted);font-weight:600}
.step .dot{flex:none;width:26px;height:26px;border-radius:50%;border:3px solid var(--soft);display:grid;place-items:center}
.step.now{color:var(--dark)}.step.now .dot{border-color:var(--accent);border-top-color:transparent;animation:spin .9s linear infinite}
.step.done{color:var(--dark)}.step.done .dot{border-color:var(--blue);background:var(--blue)}
.step.done .dot::after{content:"";width:9px;height:5px;border:solid #fff;border-width:0 0 2.5px 2.5px;transform:rotate(-45deg) translate(1px,-1px)}
@keyframes spin{to{transform:rotate(360deg)}}
.timer{margin-top:14px;font-size:14px;color:var(--muted)}
#err{display:none;margin-top:18px;background:#FFF4EE;border-left:5px solid #B42318;border-radius:12px;padding:14px 16px}
#err.on{display:block}
#err b{color:#B42318}#err p{margin:4px 0 0;font-size:14px}
#err details{margin-top:8px;font-size:12px;color:var(--muted)}#err code{white-space:pre-wrap;word-break:break-word}
footer{color:var(--muted);font-size:13px;padding-bottom:40px}
</style>
</head>
<body>
<header class="hero"><div class="wrap">
  <p class="eyebrow">Hospital to skilled nursing, tonight</p>
  <h1>Mind the Gap</h1>
  <div class="rule"></div>
  <p class="lede">Drop in a hospital referral packet. In a few minutes you'll see which facilities can safely take the patient, what has to happen first, and what to ask the hospital.</p>
  <svg class="path" viewBox="0 0 1664 140" aria-label="A hospital on the left and a nursing facility on the right, joined by a dotted path with a gap in the middle">
    <rect x="0" y="30" width="120" height="104" rx="6" fill="#2F6FDB"/><rect x="50" y="48" width="20" height="56" fill="#FBFBF8"/><rect x="32" y="66" width="56" height="20" fill="#FBFBF8"/><rect x="48" y="110" width="24" height="24" fill="#14213D"/>
    <line x1="150" y1="90" x2="740" y2="90" stroke="#BFCBE0" stroke-width="6" stroke-dasharray="4 18" stroke-linecap="round"/>
    <line x1="760" y1="70" x2="760" y2="110" stroke="#E07A3F" stroke-width="8" stroke-linecap="round"/><line x1="904" y1="70" x2="904" y2="110" stroke="#E07A3F" stroke-width="8" stroke-linecap="round"/>
    <line x1="924" y1="90" x2="1514" y2="90" stroke="#BFCBE0" stroke-width="6" stroke-dasharray="4 18" stroke-linecap="round"/>
    <path d="M1538 54 L1601 18 L1664 54 Z" fill="#E07A3F"/><rect x="1546" y="54" width="110" height="80" rx="4" fill="#BFCBE0"/><rect x="1560" y="68" width="20" height="18" fill="#14213D"/><rect x="1622" y="68" width="20" height="18" fill="#14213D"/><rect x="1590" y="100" width="24" height="34" fill="#14213D"/>
  </svg>
</div></header>
<main class="wrap">
  <div class="grid">
    <section class="card rise" style="--i:0">
      <h2>Screen a packet</h2>
      <p class="sub">A PDF of the referral packet, usually 40 to 60 pages.</p>
      <form id="f">
        <label class="drop" id="drop" for="file">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 18v-6M9.5 14.5 12 12l2.5 2.5"/></svg>
          <strong id="fname">Drop a PDF here or click to choose</strong>
          <span>Referral packet (PDF)</span>
        </label>
        <input type="file" id="file" accept="application/pdf,.pdf">
        <button class="go" id="go" disabled>Screen this packet</button>
      </form>
      <div id="progress" aria-live="polite">
        <ol class="steps">
          <li class="step" data-at="0"><span class="dot"></span>Uploading the packet</li>
          <li class="step" data-at="4"><span class="dot"></span>Reading every page</li>
          <li class="step" data-at="45"><span class="dot"></span>Checking each facility's rules</li>
          <li class="step" data-at="150"><span class="dot"></span>Writing up what matters most</li>
        </ol>
        <p class="timer" id="timer"></p>
      </div>
      <div id="err" role="alert"><b>That didn't work.</b><p id="errmsg"></p><details><summary>Technical details</summary><code id="errraw"></code></details></div>
    </section>
    <section class="card rise" style="--i:1">
      <h2>No packet handy?</h2>
      <p class="sub">Try one of our made-up patients. Their packets are synthetic, built to look like the real thing.</p>
      <div class="samples">
        <div class="sample"><span class="avatar">E</span><div><h3>Elena Mercado</h3><p>Heart failure and insulin. Leaving tonight with paperwork missing from her packet.</p>
          <div class="row"><button class="try" data-sample="elena">Try Elena</button><a href="/samples/synthetic-elena-packet.pdf">Download PDF</a></div></div></div>
        <div class="sample h"><span class="avatar">H</span><div><h3>Harold Jennings</h3><p>His paperwork is complete, but he needs care that not every facility can give.</p>
          <div class="row"><button class="try" data-sample="harold">Try Harold</button><a href="/samples/synthetic-harold-packet.pdf">Download PDF</a></div></div></div>
      </div>
      <p class="note">This demo uses synthetic facilities and packets. Please don't upload real patient data.</p>
    </section>
  </div>
</main>
<footer class="wrap">Mind the Gap · a prototype for hospital-to-SNF handoffs</footer>
<script>
const $ = (id) => document.getElementById(id);
const input = $("file"), drop = $("drop"), go = $("go");
const tries = Array.from(document.querySelectorAll(".try"));
let file = null, busy = false;
function pick(f) {
  if (!f || busy) return;
  file = f; $("fname").textContent = f.name; go.disabled = false;
}
input.addEventListener("change", () => pick(input.files[0]));
["dragenter","dragover"].forEach((e) => drop.addEventListener(e, (ev) => { ev.preventDefault(); drop.classList.add("over"); }));
["dragleave","drop"].forEach((e) => drop.addEventListener(e, (ev) => { ev.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", (ev) => pick(ev.dataTransfer.files[0]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function lock(on) {
  busy = on; go.disabled = on || !file; tries.forEach((b) => (b.disabled = on));
  $("progress").classList.toggle("on", on);
}
function showSteps(secs) {
  const steps = Array.from(document.querySelectorAll(".step"));
  let current = 0;
  steps.forEach((s, i) => { if (secs >= Number(s.dataset.at)) current = i; });
  steps.forEach((s, i) => { s.className = "step" + (i < current ? " done" : i === current ? " now" : ""); });
  const m = Math.floor(secs / 60), s = secs % 60;
  $("timer").textContent = (m ? m + " min " : "") + s + " s so far. This usually takes 2 to 5 minutes; you can leave this tab open.";
}
function friendly(msg) {
  if (/grammar is too large|invalid_request/i.test(msg)) return "The AI service rejected one of our requests. This is a bug on our side, not a problem with your packet.";
  if (/authentication|api key|401/i.test(msg)) return "The server's AI key isn't working. Whoever runs this demo needs to check it.";
  if (/rate|429|overloaded|529/i.test(msg)) return "The AI service is busy right now. Wait a minute and try again.";
  if (/not a PDF/i.test(msg)) return "That file isn't a PDF. Choose the packet's PDF and try again.";
  return "Something went wrong while screening this packet. Try again, and if it keeps happening, share the details below.";
}
async function screenFile(f) {
  $("err").classList.remove("on");
  lock(true);
  const t0 = Date.now();
  const tick = setInterval(() => showSteps(Math.round((Date.now() - t0) / 1000)), 1000);
  showSteps(0);
  try {
    const body = new FormData(); body.append("file", f);
    const r = await fetch("/api/parses", { method: "POST", body });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "upload failed");
    const id = j.parseId;
    for (;;) {
      await sleep(2500);
      const s = await fetch("/api/parses/" + id).then((x) => x.json());
      if (s.status === "complete") {
        document.querySelectorAll(".step").forEach((el) => (el.className = "step done"));
        $("timer").textContent = "Done. Opening the summary…";
        location.href = "/api/parses/" + id + "/summary";
        return;
      }
      if (s.status === "failed") throw new Error(s.error || "parse failed");
    }
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    $("errmsg").textContent = friendly(msg); $("errraw").textContent = msg;
    $("err").classList.add("on");
  } finally {
    clearInterval(tick);
    lock(false);
  }
}
$("f").addEventListener("submit", (ev) => { ev.preventDefault(); if (file && !busy) screenFile(file); });
tries.forEach((b) => b.addEventListener("click", async () => {
  if (busy) return;
  const name = "synthetic-" + b.dataset.sample + "-packet.pdf";
  try {
    const r = await fetch("/samples/" + name);
    if (!r.ok) throw new Error("sample not available (" + r.status + ")");
    const f = new File([await r.blob()], name, { type: "application/pdf" });
    file = f; $("fname").textContent = name;
    screenFile(f);
  } catch (e) {
    $("errmsg").textContent = "Couldn't load the sample packet."; $("errraw").textContent = String(e && e.message || e);
    $("err").classList.add("on");
  }
}));
</script>
</body>
</html>`;

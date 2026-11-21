/** Single-page upload UI served at `/`: pick a referral PDF, poll the parse, show the summary. */
export const uploadPage = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mind the Gap</title>
<style>
  :root { --bg:#f6f7f9; --card:#fff; --ink:#16181d; --muted:#5b6270; --line:#dfe3e8; --accent:#1f5eff; --bad:#b42318; }
  @media (prefers-color-scheme: dark) { :root { --bg:#111317; --card:#1a1d23; --ink:#eceef2; --muted:#9aa2b1; --line:#2c313a; --accent:#6d95ff; --bad:#ff7b72; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif; }
  main { max-width:640px; margin:0 auto; padding:48px 16px; }
  h1 { font-size:28px; margin:0 0 4px; }
  p.lede { color:var(--muted); margin:0 0 28px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:24px; }
  .drop { display:block; border:2px dashed var(--line); border-radius:10px; padding:36px 16px; text-align:center; cursor:pointer; color:var(--muted); }
  .drop.over, .drop:hover { border-color:var(--accent); color:var(--ink); }
  .drop strong { color:var(--ink); display:block; margin-bottom:4px; word-break:break-all; }
  input[type=file] { display:none; }
  button { margin-top:16px; width:100%; padding:12px; border:0; border-radius:8px; background:var(--accent); color:#fff; font:inherit; font-weight:600; cursor:pointer; }
  button:disabled { opacity:.5; cursor:default; }
  #status { margin-top:16px; min-height:24px; color:var(--muted); }
  #status.err { color:var(--bad); }
  .spin { display:inline-block; width:14px; height:14px; border:2px solid var(--line); border-top-color:var(--accent); border-radius:50%; animation:s 0.8s linear infinite; vertical-align:-2px; margin-right:8px; }
  @keyframes s { to { transform:rotate(360deg); } }
  .note { font-size:13px; color:var(--muted); margin-top:20px; }
  .links { margin-top:12px; font-size:14px; }
  .links a { color:var(--accent); margin-right:16px; }
</style>
</head>
<body>
<main>
  <h1>Mind the Gap</h1>
  <p class="lede">Upload a hospital-to-SNF referral packet (PDF) to screen it against the facilities' acceptance policies.</p>
  <div class="card">
    <form id="f">
      <label class="drop" id="drop" for="file">
        <strong id="fname">Drop a PDF here or click to choose</strong>
        <span>Referral packet, about 60 pages</span>
      </label>
      <input type="file" id="file" accept="application/pdf,.pdf">
      <button id="go" disabled>Screen packet</button>
    </form>
    <div id="status"></div>
    <div class="links" id="links"></div>
  </div>
  <p class="note">No packet handy? Download a synthetic one: <a href="/samples/synthetic-elena-packet.pdf">Elena Mercado</a> · <a href="/samples/synthetic-harold-packet.pdf">Harold Jennings</a></p>
  <p class="note">Demo uses synthetic facilities and packets only. Do not upload real patient data.</p>
</main>
<script>
const $ = (id) => document.getElementById(id);
const input = $("file"), drop = $("drop"), go = $("go"), status = $("status");
let file = null;
function pick(f) {
  if (!f) return;
  file = f; $("fname").textContent = f.name; go.disabled = false;
}
input.addEventListener("change", () => pick(input.files[0]));
["dragenter","dragover"].forEach((e) => drop.addEventListener(e, (ev) => { ev.preventDefault(); drop.classList.add("over"); }));
["dragleave","drop"].forEach((e) => drop.addEventListener(e, (ev) => { ev.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", (ev) => pick(ev.dataTransfer.files[0]));
function say(html, err) { status.innerHTML = html; status.className = err ? "err" : ""; }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
$("f").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (!file) return;
  go.disabled = true; $("links").innerHTML = "";
  say('<span class="spin"></span>Uploading…');
  try {
    const body = new FormData(); body.append("file", file);
    const r = await fetch("/api/parses", { method: "POST", body });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "upload failed");
    const id = j.parseId, t0 = Date.now();
    for (;;) {
      const secs = Math.round((Date.now() - t0) / 1000);
      say('<span class="spin"></span>Reading the packet and checking every rule… ' + secs + 's (usually 1–3 minutes)');
      await sleep(2000);
      const s = await fetch("/api/parses/" + id).then((x) => x.json());
      if (s.status === "complete") {
        say("Done. Opening summary…");
        $("links").innerHTML = '<a href="/api/parses/' + id + '/summary">Summary</a><a href="/api/parses/' + id + '/call-sheet">Call sheet (JSON)</a><a href="/api/parses/' + id + '">Full result (JSON)</a>';
        location.href = "/api/parses/" + id + "/summary";
        return;
      }
      if (s.status === "failed") throw new Error(s.error || "parse failed");
    }
  } catch (e) {
    say("Error: " + (e && e.message ? e.message : e), true);
    go.disabled = false;
  }
});
</script>
</body>
</html>`;

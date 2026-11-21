# Product demo page

`index.html` is a self-contained demo page built from the real engine output for the two synthetic cases (Elena Mercado, Harold Jennings).

- `data.json`: screening results (verdicts, ranked priorities, evidence, follow-up asks), generated from the test fixtures with the production engine and deterministic headline.
- `template.html`: the page source; `__DATA__` is replaced with `data.json` to produce `index.html`.

Rebuild after editing the template:

```bash
node -e 'const fs=require("fs");fs.writeFileSync("demo/index.html",fs.readFileSync("demo/template.html","utf8").replace("__DATA__",()=>fs.readFileSync("demo/data.json","utf8")))'
```

## Clickable prototype

`prototype.html` (built from `prototype.template.html` the same way) is a lighter, screen-by-screen prototype: referral inbox, one referral with a recommendation, one facility's open items, an evidence sheet, and the call sheet. A five-step walkthrough bar drives it for live demos and can be hidden.

```bash
node -e 'const fs=require("fs");fs.writeFileSync("demo/prototype.html",fs.readFileSync("demo/prototype.template.html","utf8").replace("__DATA__",()=>fs.readFileSync("demo/data.json","utf8")))'
```

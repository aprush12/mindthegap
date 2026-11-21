# Product demo page

`index.html` is a self-contained demo page built from the real engine output for the two synthetic cases (Elena Mercado, Harold Jennings).

- `data.json`: screening results (verdicts, ranked priorities, evidence, follow-up asks), generated from the test fixtures with the production engine and deterministic headline.
- `template.html`: the page source; `__DATA__` is replaced with `data.json` to produce `index.html`.

Rebuild after editing the template:

```bash
node -e 'const fs=require("fs");fs.writeFileSync("demo/index.html",fs.readFileSync("demo/template.html","utf8").replace("__DATA__",()=>fs.readFileSync("demo/data.json","utf8")))'
```

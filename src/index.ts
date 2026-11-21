import { serve } from "@hono/node-server";
import { app } from "./app.js";

// Load .env if present (Node 20.12+); real env vars win.
try { process.loadEnvFile(); } catch {}

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, (info) => console.log(`mindthegap listening on :${info.port}`));

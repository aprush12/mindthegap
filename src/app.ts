import { readFile, writeFile } from "node:fs/promises";
import { Hono } from "hono";
import facilitiesJson from "./policy/facilities.json" with { type: "json" };
import { CapacitySchema, FacilitiesSchema, FacilityIdSchema, CapacitySnapshotSchema } from "./policy/schema.js";

const facilities = FacilitiesSchema.parse(facilitiesJson);
const CAPACITY_PATH = new URL("./capacity/snapshot.json", import.meta.url);

const readCapacity = async () => CapacitySnapshotSchema.parse(JSON.parse(await readFile(CAPACITY_PATH, "utf8")));

export const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));

const notYet = (c: { json: (b: unknown, s: 501) => Response }) => c.json({ error: "pipeline lands in a later stage" }, 501);
app.post("/api/parses", notYet);
app.get("/api/parses/:id", notYet);
app.get("/api/parses/:id/summary", notYet);
app.get("/api/parses/:id/document/:page", notYet);

app.get("/api/facilities", (c) => c.json(facilities));

app.get("/api/facilities/:id", async (c) => {
  const id = FacilityIdSchema.safeParse(c.req.param("id"));
  if (!id.success) return c.json({ error: "unknown facility" }, 404);
  const capacity = (await readCapacity())[id.data];
  return c.json({ ...facilities.find((f) => f.id === id.data)!, capacity });
});

app.put("/api/facilities/:id/capacity", async (c) => {
  const id = FacilityIdSchema.safeParse(c.req.param("id"));
  if (!id.success) return c.json({ error: "unknown facility" }, 404);
  const body = CapacitySchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "invalid capacity", issues: body.error.issues }, 400);
  const snapshot = await readCapacity();
  snapshot[id.data] = body.data;
  await writeFile(CAPACITY_PATH, JSON.stringify(snapshot, null, 2) + "\n");
  return c.json(body.data);
});

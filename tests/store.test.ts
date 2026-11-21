import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { list, load, save } from "../src/store.js";

it("round-trips JSON and rejects path-like ids", async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "mtg-"));
  await save("abc-1", { a: 1 });
  expect(await load("abc-1")).toEqual({ a: 1 });
  expect(await load("missing")).toBeUndefined();
  expect(await list()).toEqual(["abc-1"]);
  await expect(save("../x", {})).rejects.toThrow();
});

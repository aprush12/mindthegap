import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const dir = () => process.env.DATA_DIR ?? "data";
const file = (id: string) => {
  if (!/^[\w-]+$/.test(id)) throw new Error("invalid id");
  return path.join(dir(), `${id}.json`);
};

export async function save<T>(id: string, value: T): Promise<void> {
  await mkdir(dir(), { recursive: true });
  await writeFile(file(id), JSON.stringify(value, null, 2));
}

export async function load<T>(id: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(file(id), "utf8")) as T;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw e;
  }
}

export async function list(): Promise<string[]> {
  try {
    return (await readdir(dir())).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
  } catch {
    return [];
  }
}

// ---- per-parse directories: data/{parseId}/{packet.pdf,pages.json,result.json} ----
export function parseDir(id: string): string {
  if (!/^[\w-]+$/.test(id)) throw new Error("invalid id");
  return path.join(dir(), id);
}

export async function saveFile(id: string, name: string, value: unknown): Promise<void> {
  await mkdir(parseDir(id), { recursive: true });
  const body = value instanceof Uint8Array ? value : JSON.stringify(value, null, 2);
  // write-then-rename so a reader polling result.json never sees a half-written file
  const target = path.join(parseDir(id), name);
  const tmp = `${target}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(tmp, body);
  await rename(tmp, target);
}

export async function loadFile<T>(id: string, name: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path.join(parseDir(id), name), "utf8")) as T;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw e;
  }
}

export async function readPacket(id: string): Promise<Uint8Array | undefined> {
  try {
    return await readFile(path.join(parseDir(id), "packet.pdf"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw e;
  }
}

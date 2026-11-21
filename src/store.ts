import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
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

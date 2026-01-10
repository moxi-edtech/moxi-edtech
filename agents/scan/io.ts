import fs from "node:fs/promises";
import path from "node:path";

export async function readText(filePath: string) {
  return fs.readFile(filePath, "utf8");
}

export async function writeText(filePath: string, content: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

export async function writeJson(filePath: string, data: unknown) {
  await writeText(filePath, JSON.stringify(data, null, 2));
}

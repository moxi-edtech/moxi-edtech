import fs from "node:fs/promises";
import path from "node:path";
import type { PatchPlanItem } from "../scan/types";
import type { ApplyMode, ApplyResult } from "./types";

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function applyPlan(opts: {
  repoRoot: string;
  plan: PatchPlanItem[];
  gateStatus: "PASS" | "FAIL";
  mode: ApplyMode;
}) {
  const result: ApplyResult = { timestamp: new Date().toISOString(), applied: [], skipped: [] };

  if (opts.gateStatus === "FAIL") {
    for (const patch of opts.plan) {
      result.skipped.push({ id: patch.id, reason: "PERF_GATE=FAIL (hard-block)" });
    }
    return result;
  }

  for (const patch of opts.plan.sort((a, b) => a.priority - b.priority)) {
    if (opts.mode === "safe" && patch.safety.requires_manual_review) {
      result.skipped.push({ id: patch.id, reason: "Manual review required (safe mode)" });
      continue;
    }

    const changed: string[] = [];

    for (const file of patch.files) {
      const fullPath = path.join(opts.repoRoot, file.path);

      if (opts.mode === "dry-run") {
        changed.push(file.path);
        continue;
      }

      if (file.action === "CREATE") {
        if (await fileExists(fullPath)) continue;
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, file.content ?? "", "utf8");
        changed.push(file.path);
      }

      if (file.action === "UPDATE") {
        if (!(await fileExists(fullPath))) continue;
        const prev = await fs.readFile(fullPath, "utf8");
        if (!file.patch) continue;
        if (!prev.includes(file.patch.find)) continue;
        const next = prev.replace(file.patch.find, file.patch.replace);
        if (next !== prev) {
          await fs.writeFile(fullPath, next, "utf8");
          changed.push(file.path);
        }
      }

      if (file.action === "APPEND") {
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        const prev = (await fileExists(fullPath)) ? await fs.readFile(fullPath, "utf8") : "";
        const addition = file.content ?? "";
        if (!prev.includes(addition.trim().slice(0, 40))) {
          await fs.writeFile(fullPath, `${prev}\n${addition}`, "utf8");
          changed.push(file.path);
        }
      }
    }

    if (changed.length) {
      result.applied.push({ id: patch.id, changedFiles: changed });
    } else {
      result.skipped.push({ id: patch.id, reason: "No changes (already present or patch not applicable)" });
    }
  }

  return result;
}

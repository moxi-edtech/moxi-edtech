import type { PatchPlanItem } from "../scan/types";

export type ApplyMode = "safe" | "dry-run";

export type ApplyResult = {
  timestamp: string;
  applied: Array<{ id: string; changedFiles: string[] }>;
  skipped: Array<{ id: string; reason: string }>;
  plan?: PatchPlanItem[];
};

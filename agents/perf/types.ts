import type { Finding } from "../scan/types";

export type GateStatus = "PASS" | "FAIL";

export type PerfGate = {
  timestamp: string;
  status: GateStatus;
  blocking_findings: Finding[];
  notes: string[];
};

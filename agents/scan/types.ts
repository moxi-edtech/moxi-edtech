export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type FindingStatus = "VALIDATED" | "PARTIAL" | "MISSING" | "FAIL_CRITICAL";

export type Evidence = { file: string; note: string };

export type Finding = {
  id: string;
  title: string;
  severity: Severity;
  status: FindingStatus;
  evidence: Evidence[];
  recommendation: string;
};

export type ScanReport = {
  timestamp: string;
  repoRoot: string;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  findings: Finding[];
};

export type PatchPlanItem = {
  id: string;
  priority: number;
  type: "SQL_MIGRATION" | "NEXT_CONFIG" | "PWA_PUBLIC_FILES" | "CODEMOD" | "DEPENDENCY" | "DOC";
  title: string;
  rationale: string;
  files: Array<{
    path: string;
    action: "CREATE" | "UPDATE" | "APPEND";
    content?: string;
    patch?: { find: string; replace: string };
  }>;
  safety: {
    destructive: false;
    requires_manual_review: boolean;
  };
};

import { hasAnyPermission, type Permission } from "@/lib/permissions";
import type { BalcaoActionId } from "@/lib/balcao/action-registry";

export type ExplorerActionId = Extract<BalcaoActionId,
  "enrollment" | "reenrollment" | "payment" | "document" | "profile" | "grade">;

export const EXPLORER_STUDENT_ACTION_IDS: readonly ExplorerActionId[] = [
  "enrollment", "reenrollment", "payment", "document", "profile", "grade",
];

/** Permissions from the existing K12 matrix; these are discovery gates only.
 * The canonical destination must independently enforce its own authorization.
 * No extra role, financial state, or student eligibility is inferred here.
 */
const ACTION_PERMISSIONS: Record<ExplorerActionId, Permission[]> = {
  enrollment: ["criar_matricula"],
  reenrollment: ["editar_matricula", "criar_matricula"],
  payment: ["registrar_pagamento"],
  document: ["emitir_documentos"],
  profile: ["visualizar_academico", "editar_matricula"],
  grade: ["lançar_notas"],
};

export function resolveExplorerStudentCapabilities(role: string | null, isSuperAdmin = false) {
  return Object.fromEntries(EXPLORER_STUDENT_ACTION_IDS.map((id) => [
    id, Boolean(isSuperAdmin || (role && hasAnyPermission(role, ACTION_PERMISSIONS[id]))),
  ])) as Record<ExplorerActionId, boolean>;
}

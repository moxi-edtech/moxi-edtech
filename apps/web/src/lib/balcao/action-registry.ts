import { buildPortalHref } from "@/lib/navigation";

export type BalcaoActionId =
  | "desk"
  | "payment"
  | "document"
  | "reenrollment"
  | "profile"
  | "grade";

export type BalcaoFocusAction = Extract<BalcaoActionId, "payment" | "document" | "reenrollment">;

export type BalcaoActionSurface = "command-center";

export type BalcaoActionDefinition = {
  id: BalcaoActionId;
  label: string;
  shortLabel: string;
  description: string;
  requiresStudent: boolean;
  surface: BalcaoActionSurface;
  focusAction?: BalcaoFocusAction;
};

export const BALCAO_ACTION_REGISTRY: Record<BalcaoActionId, BalcaoActionDefinition> = {
  desk: {
    id: "desk",
    label: "Visão geral",
    shortLabel: "Visão geral",
    description: "Resumo operativo do aluno e próximos passos.",
    requiresStudent: true,
    surface: "command-center",
  },
  payment: {
    id: "payment",
    label: "Pagar propina",
    shortLabel: "Pagar",
    description: "Regularizar propinas e outros itens financeiros no mesmo atendimento.",
    requiresStudent: true,
    surface: "command-center",
    focusAction: "payment",
  },
  document: {
    id: "document",
    label: "Emitir documento",
    shortLabel: "Documento",
    description: "Selecionar, cobrar quando aplicável e emitir documentos do aluno.",
    requiresStudent: true,
    surface: "command-center",
    focusAction: "document",
  },
  reenrollment: {
    id: "reenrollment",
    label: "Rematrícula",
    shortLabel: "Rematrícula",
    description: "Verificar elegibilidade e concluir a rematrícula no mesmo atendimento.",
    requiresStudent: true,
    surface: "command-center",
    focusAction: "reenrollment",
  },
  profile: {
    id: "profile",
    label: "Consultar ficha",
    shortLabel: "Perfil",
    description: "Abrir a ficha rápida do aluno.",
    requiresStudent: true,
    surface: "command-center",
  },
  grade: {
    id: "grade",
    label: "Lançar nota",
    shortLabel: "Nota",
    description: "Abrir o fluxo académico de notas.",
    requiresStudent: true,
    surface: "command-center",
  },
};

export const STUDENT_BALCAO_ACTION_IDS: BalcaoActionId[] = [
  "desk",
  "payment",
  "document",
  "reenrollment",
  "profile",
  "grade",
];

export const BALCAO_WORKSPACE_ACTION_IDS: BalcaoActionId[] = [
  "desk",
  "payment",
  "document",
  "reenrollment",
  "profile",
  "grade",
];

export function getBalcaoAction(actionId: BalcaoActionId) {
  return BALCAO_ACTION_REGISTRY[actionId];
}

export function getStudentBalcaoActions() {
  return STUDENT_BALCAO_ACTION_IDS.map((id) => BALCAO_ACTION_REGISTRY[id]);
}

export function getBalcaoWorkspaceActions() {
  return BALCAO_WORKSPACE_ACTION_IDS.map((id) => BALCAO_ACTION_REGISTRY[id]);
}

export function buildBalcaoActionHref(params: {
  escolaParam?: string | null;
  actionId: BalcaoActionId;
  alunoId?: string | null;
  alunoLabel?: string | null;
  portal?: "secretaria" | "financeiro" | "admin" | "operacoes" | "professor" | "aluno" | "gestor" | "superadmin";
}) {
  const { escolaParam, actionId, alunoId } = params;
  const search = new URLSearchParams();
  if (alunoId) search.set("alunoId", alunoId);
  if (actionId !== "desk") search.set("action", actionId);
  const qs = search.toString();
  return buildPortalHref(escolaParam, `/secretaria/balcao${qs ? `?${qs}` : ""}`);
}

import { buildPortalHref } from "@/lib/navigation";

export type BalcaoActionId =
  | "desk"
  | "payment"
  | "document"
  | "reenrollment"
  | "enrollment"
  | "profile"
  | "grade";

export type BalcaoFocusAction = Extract<BalcaoActionId, "payment" | "document" | "reenrollment">;

export type BalcaoActionSurface = "command-center";
export type CommandCenterPanelKind = "balcao" | "enrollment" | "profile" | "grade";
export type CommandCenterBalcaoView = "overview" | "payment" | "document" | "reenrollment";

export type BalcaoActionDefinition = {
  id: BalcaoActionId;
  label: string;
  shortLabel: string;
  description: string;
  requiresStudent: boolean;
  surface: BalcaoActionSurface;
  panel: CommandCenterPanelKind;
  balcaoView?: CommandCenterBalcaoView;
  focusAction?: BalcaoFocusAction;
};

export const BALCAO_ACTION_REGISTRY: Record<BalcaoActionId, BalcaoActionDefinition> = {
  desk: {
    id: "desk",
    label: "Visão geral",
    shortLabel: "Visão geral",
    description: "Pesquisar aluno ou iniciar uma nova operação.",
    requiresStudent: false,
    surface: "command-center",
    panel: "balcao",
    balcaoView: "overview",
  },
  payment: {
    id: "payment",
    label: "Pagar propina",
    shortLabel: "Pagar",
    description: "Regularizar propinas e outros itens financeiros no mesmo atendimento.",
    requiresStudent: true,
    surface: "command-center",
    panel: "balcao",
    balcaoView: "payment",
    focusAction: "payment",
  },
  document: {
    id: "document",
    label: "Emitir documento",
    shortLabel: "Documento",
    description: "Selecionar, cobrar quando aplicável e emitir documentos do aluno.",
    requiresStudent: true,
    surface: "command-center",
    panel: "balcao",
    balcaoView: "document",
    focusAction: "document",
  },
  reenrollment: {
    id: "reenrollment",
    label: "Rematrícula",
    shortLabel: "Rematrícula",
    description: "Verificar elegibilidade e concluir a rematrícula no mesmo atendimento.",
    requiresStudent: true,
    surface: "command-center",
    panel: "balcao",
    balcaoView: "reenrollment",
    focusAction: "reenrollment",
  },
  enrollment: {
    id: "enrollment",
    label: "Matrícula",
    shortLabel: "Matrícula",
    description: "Criar uma nova matrícula sem sair do Command Center.",
    requiresStudent: false,
    surface: "command-center",
    panel: "enrollment",
  },
  profile: {
    id: "profile",
    label: "Consultar ficha",
    shortLabel: "Perfil",
    description: "Abrir a ficha rápida do aluno.",
    requiresStudent: true,
    surface: "command-center",
    panel: "profile",
  },
  grade: {
    id: "grade",
    label: "Lançar nota",
    shortLabel: "Nota",
    description: "Abrir o fluxo académico de notas.",
    requiresStudent: true,
    surface: "command-center",
    panel: "grade",
  },
};

export const STUDENT_BALCAO_ACTION_IDS: BalcaoActionId[] = [
  "desk",
  "enrollment",
  "payment",
  "document",
  "reenrollment",
  "profile",
  "grade",
];

export const BALCAO_WORKSPACE_ACTION_IDS: BalcaoActionId[] = [
  "desk",
  "enrollment",
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
  const { escolaParam, actionId, alunoId, alunoLabel, portal } = params;
  const commandCenterPortal = portal == null || portal === "secretaria" || portal === "operacoes";

  if (commandCenterPortal) {
    const search = new URLSearchParams();
    if (alunoId) search.set("alunoId", alunoId);
    if (actionId !== "desk") search.set("action", actionId);
    const qs = search.toString();
    return buildPortalHref(escolaParam, `/secretaria/balcao${qs ? `?${qs}` : ""}`);
  }

  const encodedAlunoId = alunoId ? encodeURIComponent(alunoId) : "";
  const encodedLabel = alunoLabel ? encodeURIComponent(alunoLabel) : "";

  if (actionId === "enrollment") {
    return buildPortalHref(escolaParam, "/secretaria/admissoes/nova");
  }

  if (actionId === "profile") {
    return buildPortalHref(escolaParam, `/secretaria/alunos/${encodedAlunoId}`);
  }

  if (actionId === "payment") {
    return buildPortalHref(
      escolaParam,
      `/financeiro/pagamentos?alunoId=${encodedAlunoId}&q=${encodedLabel}`,
    );
  }

  if (actionId === "grade") {
    return portal === "professor"
      ? buildPortalHref(escolaParam, `/professor/notas?alunoId=${encodedAlunoId}`)
      : buildPortalHref(escolaParam, `/secretaria/notas?alunoId=${encodedAlunoId}`);
  }

  const search = new URLSearchParams();
  if (alunoId) search.set("alunoId", alunoId);
  if (actionId !== "desk") search.set("action", actionId);
  return buildPortalHref(escolaParam, `/secretaria/balcao?${search.toString()}`);
}

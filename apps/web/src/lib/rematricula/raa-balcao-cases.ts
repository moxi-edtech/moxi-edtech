import type { RaaBalcaoAction } from "./raa-balcao-resolution";
import { isRaaTrimestre, type RaaCasePeriod, type RaaTrimestre } from "./raa-balcao-temporal-context";

export type RaaBalcaoCase = {
  id: string;
  kind: "nota" | "justificacao" | "pedido" | "exame" | "disciplina" | "orientacao";
  titulo: string;
  resumo: string;
  estado: "pendente" | "em_analise" | "registado";
  /** Verified academic period or an explicit no-trimester classification. */
  periodo: RaaCasePeriod;
  referenceId?: string;
};
export type RaaBalcaoCaseSources = {
  action: RaaBalcaoAction;
  title: string;
  disciplinaIds?: readonly string[];
  faltas?: readonly { id: string; data_falta: string; status: string; motivo: string; trimestre?: RaaTrimestre | null }[];
  pedidos?: readonly { id: string; protocolo_publico: string; estado: string; motivo: string }[];
  eventos?: readonly { id: string; categoria: string; estado: string; descricao: string }[];
  sessoes?: readonly { id: string; tipo: string; estado: string; data_inicio: string }[];
};

export function buildRaaBalcaoCases(source: RaaBalcaoCaseSources): RaaBalcaoCase[] {
  const items: RaaBalcaoCase[] = [];
  const { action } = source;
  if (action === "nota") {
    (source.disciplinaIds ?? []).forEach((id, i) => items.push({
      id: "nota:" + id, referenceId: id, kind: "nota",
      titulo: "Disciplina pendente " + (i + 1),
      resumo: "Verifique as notas desta disciplina e conclua o que falta",
      estado: "pendente", periodo: "nao_identificado",
    }));
  }
  if (action === "justificacao") {
    (source.faltas ?? []).forEach((item) => items.push({
      id: "falta:" + item.id, referenceId: item.id, kind: "justificacao",
      titulo: "Falta de " + item.data_falta,
      resumo: item.motivo,
      estado: item.status === "pending" ? "pendente" : "registado",
      periodo: isRaaTrimestre(item.trimestre) ? item.trimestre : "nao_identificado",
    }));
  }
  if (action === "reapreciacao") {
    (source.pedidos ?? []).forEach(item => items.push({
      id: "pedido:" + item.id, referenceId: item.id, kind: "pedido",
      titulo: item.protocolo_publico || "Pedido de reapreciação",
      resumo: item.motivo,
      estado: item.estado === "pendente" ? "pendente"
        : item.estado === "em_analise" ? "em_analise" : "registado",
      periodo: "ano_letivo",
    }));
    (source.sessoes ?? []).forEach(item => items.push({
      id: "exame:" + item.id, referenceId: item.id, kind: "exame",
      titulo: item.tipo === "extraordinario" ? "Exame extraordinário" : "Exame de recurso",
      resumo: "Sessão " + item.data_inicio + " · " + item.estado + " · resultado oficial por validar",
      estado: "pendente", periodo: "ano_letivo",
    }));
  }
  if (action === "disciplina") {
    (source.eventos ?? []).forEach(item => items.push({
      id: "evento:" + item.id, referenceId: item.id, kind: "disciplina",
      titulo: item.categoria,
      resumo: item.descricao,
      estado: ["resolvido","cancelado"].includes(item.estado) ? "registado"
        : item.estado === "em_analise" ? "em_analise" : "pendente",
      periodo: "ano_letivo",
    }));
  }
  if (items.length === 0) {
    // One canonical RAA blocker is always visible, including when its supporting
    // evidence has not yet been filed or another authority must decide it.
    items.push({
      id: "raa:decisao", kind: "orientacao", titulo: source.title,
      resumo: "Consulte o resultado e resolva os pontos em aberto",
      estado: "pendente", periodo: "ano_letivo",
    });
  }
  return items;
}

export function raaBalcaoProgress(items: readonly RaaBalcaoCase[]) {
  return {
    total: items.length,
    registados: items.filter(item => item.estado === "registado").length,
    pendentes: items.filter(item => item.estado !== "registado").length,
  };
}


/**
 * A unified PROCESS list. Evidence may coexist: a student can have missing
 * grades and an attendance petition in the same source school year.
 *
 * We never manufacture a case for an empty data source. The primary canonical
 * RAA blocker is retained as an orientation when there is no attached record,
 * so the operator still sees why the official eligibility remains blocked.
 * The progress counter describes evidence decisions, NOT approval to enroll.
 */
export function buildRaaBalcaoWorkspaceCases(
  source: Omit<RaaBalcaoCaseSources, "action"> & { primaryAction: RaaBalcaoAction },
): RaaBalcaoCase[] {
  if (source.primaryAction === "documentos") return buildRaaBalcaoCases({ ...source, action: "documentos" });
  const kinds = ["justificacao", "nota", "reapreciacao", "disciplina"] as const;
  const all = kinds.flatMap((action) =>
    buildRaaBalcaoCases({ ...source, action }).filter((item) => item.kind !== "orientacao"),
  );
  const deduplicated = Array.from(new Map(all.map((item) => [item.id, item])).values());
  const primary = buildRaaBalcaoCases({ ...source, action: source.primaryAction });
  const fallback = primary.find((item) => item.kind === "orientacao");
  if (fallback) deduplicated.push(fallback);
  if (deduplicated.length === 0) return primary;
  return deduplicated;
}

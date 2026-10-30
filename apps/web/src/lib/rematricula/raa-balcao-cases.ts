import type { RaaBalcaoAction } from "./raa-balcao-resolution";

export type RaaBalcaoCase = {
  id: string;
  kind: "nota" | "justificacao" | "pedido" | "exame" | "disciplina" | "orientacao";
  titulo: string;
  resumo: string;
  estado: "pendente" | "em_analise" | "registado";
  referenceId?: string;
};
export type RaaBalcaoCaseSources = {
  action: RaaBalcaoAction;
  title: string;
  disciplinaIds?: readonly string[];
  faltas?: readonly { id: string; data_falta: string; status: string; motivo: string }[];
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
      resumo: "Verificar notas e fórmula da avaliação oficial",
      estado: "pendente",
    }));
  }
  if (action === "justificacao") {
    (source.faltas ?? []).forEach((item) => items.push({
      id: "falta:" + item.id, referenceId: item.id, kind: "justificacao",
      titulo: "Falta de " + item.data_falta,
      resumo: item.motivo,
      estado: item.status === "pending" ? "pendente" : "registado",
    }));
  }
  if (action === "reapreciacao") {
    (source.pedidos ?? []).forEach(item => items.push({
      id: "pedido:" + item.id, referenceId: item.id, kind: "pedido",
      titulo: item.protocolo_publico || "Pedido de reapreciação",
      resumo: item.motivo,
      estado: item.estado === "pendente" ? "pendente"
        : item.estado === "em_analise" ? "em_analise" : "registado",
    }));
    (source.sessoes ?? []).forEach(item => items.push({
      id: "exame:" + item.id, referenceId: item.id, kind: "exame",
      titulo: item.tipo === "extraordinario" ? "Exame extraordinário" : "Exame de recurso",
      resumo: "Sessão " + item.data_inicio + " · " + item.estado + " · resultado oficial por validar",
      estado: "pendente",
    }));
  }
  if (action === "disciplina") {
    (source.eventos ?? []).forEach(item => items.push({
      id: "evento:" + item.id, referenceId: item.id, kind: "disciplina",
      titulo: item.categoria,
      resumo: item.descricao,
      estado: ["resolvido","cancelado"].includes(item.estado) ? "registado"
        : item.estado === "em_analise" ? "em_analise" : "pendente",
    }));
  }
  if (items.length === 0) {
    // One canonical RAA blocker is always visible, including when its supporting
    // evidence has not yet been filed or another authority must decide it.
    items.push({
      id: "raa:decisao", kind: "orientacao", titulo: source.title,
      resumo: "Requer análise da decisão RAA e respetivas evidências",
      estado: "pendente",
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

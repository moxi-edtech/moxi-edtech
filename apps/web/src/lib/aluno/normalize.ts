import type {
  RawDossier,
  RawDossierHistoricoItem,
  RawDossierMensalidade,
  AlunoNormalizado,
  DossierPerfil,
  DossierMatricula,
  DossierMensalidade,
  DossierFinanceiro,
  DossierPendencia,
  DossierStatus,
} from "./types";

const STATUS_ATIVO = new Set(["ativo", "ativa", "active"]);

function isMatriculaAtiva(status?: string | null): boolean {
  return STATUS_ATIVO.has((status ?? "").toLowerCase().trim());
}

function normalizarStatus(status?: string | null): DossierStatus {
  const s = (status ?? "pendente").toLowerCase().trim();
  if (STATUS_ATIVO.has(s)) return "ativo";
  if (s === "arquivado" || s === "archived") return "arquivado";
  if (s === "inativo" || s === "inactive") return "inativo";
  return s;
}

function normalizarMensalidade(m: RawDossierMensalidade): DossierMensalidade {
  const mes = Number(m.mes ?? m.mes_referencia ?? 0);
  const ano = Number(m.ano ?? m.ano_referencia ?? 0);
  const valor = Number(m.valor ?? 0);
  const pago = Number(m.pago ?? m.valor_pago_total ?? 0);
  const saldo = Math.max(0, valor - pago);

  const vencimento = m.vencimento ?? m.data_vencimento ?? null;
  const atrasada = vencimento ? new Date(vencimento) < new Date() : false;

  return {
    id: String(m.id ?? `${ano}-${mes}`),
    status: (m.status ?? "pendente").toLowerCase(),
    mes,
    ano,
    valor,
    pago,
    saldo,
    vencimento,
    pago_em: m.pago_em ?? null,
    atrasada,
  };
}

function normalizarHistoricoItem(item: RawDossierHistoricoItem, isAtual: boolean): DossierMatricula {
  return {
    ano_letivo: String(item.ano_letivo ?? "—"),
    turma: item.turma ?? "—",
    turma_codigo: item.turma_codigo ?? item.turma_code ?? null,
    turno: item.turno ?? null,
    numero_matricula: item.numero_matricula ?? null,
    matricula_id: item.matricula_id ?? null,
    classe: item.classe ?? null,
    curso: item.curso ?? item.curso_nome ?? null,
    curso_codigo: item.curso_codigo ?? item.curso_code ?? null,
    status: normalizarStatus(item.status),
    is_atual: isAtual,
  };
}

function calcularPendencias(
  perfil: DossierPerfil,
  historico: DossierMatricula[],
  financeiro: DossierFinanceiro
): DossierPendencia[] {
  const pendencias: DossierPendencia[] = [];
  if (!perfil.bi_numero) pendencias.push({ tipo: "bi_em_falta", label: "BI em falta", nivel: "critico" });
  if (!perfil.responsavel_nome) pendencias.push({ tipo: "responsavel_em_falta", label: "Responsável", nivel: "critico" });
  if (!perfil.responsavel_tel) pendencias.push({ tipo: "contacto_em_falta", label: "Contacto", nivel: "aviso" });
  if (!perfil.endereco) pendencias.push({ tipo: "endereco_em_falta", label: "Endereço", nivel: "aviso" });
  if (financeiro.total_em_atraso > 0) pendencias.push({ tipo: "financeiro_em_atraso", label: "Financeiro em atraso", nivel: "critico" });
  if (historico.length === 0) pendencias.push({ tipo: "sem_historico_matricula", label: "Sem histórico de matrícula", nivel: "aviso" });
  return pendencias;
}

export function normalizeDossier(alunoId: string, raw: unknown): AlunoNormalizado | null {
  if (!raw || typeof raw !== "object") return null;

  const dossier = raw as RawDossier;
  const { perfil: p, historico: h = [], financeiro: f = {} } = dossier;
  if (!p) return null;

  const perfil: DossierPerfil = {
    nome: p.nome_completo || p.nome || "Aluno",
    foto_url: p.foto_url ?? null,
    status: normalizarStatus(p.status),
    numero_processo: p.numero_processo ?? null,
    bi_numero: p.bi_numero ?? null,
    data_nascimento: p.data_nascimento ?? null,
    responsavel_nome: p.encarregado_nome || p.responsavel || null,
    responsavel_tel: p.encarregado_telefone || p.telefone_responsavel || null,
    endereco: p.endereco ?? null,
    endereco_bairro: p.endereco_bairro ?? null,
    provincia: p.provincia || p.provincia_residencia || null,
  };

  const historico: DossierMatricula[] = Array.isArray(h)
    ? h.map((item) => normalizarHistoricoItem(item, isMatriculaAtiva(item.status)))
    : [];

  const matricula_atual = historico.find((m) => m.is_atual) ?? historico[0] ?? null;

  const total_em_atraso = Number(f.total_em_atraso ?? 0);
  const total_pago = Number(f.total_pago ?? 0);

  const todasMensalidades: DossierMensalidade[] = Array.isArray(f.mensalidades)
    ? f.mensalidades.map(normalizarMensalidade)
    : [];

  const mensalidades_pendentes = todasMensalidades.filter(
    (m) => ["pendente", "pago_parcial"].includes(m.status) && m.saldo > 0
  );
  const mensalidades_atrasadas = mensalidades_pendentes.filter((m) => m.atrasada);

  const financeiro: DossierFinanceiro = {
    total_em_atraso,
    total_pago,
    situacao: total_em_atraso > 0 ? "inadimplente" : "em_dia",
    mensalidades: todasMensalidades,
    mensalidades_pendentes,
    mensalidades_atrasadas,
  };

  return {
    id: alunoId,
    perfil,
    historico,
    financeiro,
    matricula_atual,
    pendencias: calcularPendencias(perfil, historico, financeiro),
  };
}

export function toMensalidadeAcoes(m: DossierMensalidade) {
  return {
    id: m.id,
    mes: m.mes,
    ano: m.ano,
    valor: m.valor,
    status: m.status,
    vencimento: m.vencimento ?? undefined,
  };
}

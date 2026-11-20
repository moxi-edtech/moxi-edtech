import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { authorizeTurmasManage } from "@/lib/escola/disciplinas";
import { applyKf2ListInvariants } from "@/lib/kf2";
import {
  compareNominalSortableRows, modoPadraoDaSessao, selectMatriculasDaLista,
  type ListaNominalMode, type ListaNominalCategoria,
} from "@/lib/documentos/listaNominalPolicy";
import type { NominalXlsxRow } from "@/lib/documentos/listaNominalXlsx";

type Client = SupabaseClient<Database>;

export class NominalRosterError extends Error {
  constructor(message: string, public readonly status = 409) {
    super(message);
    this.name = "NominalRosterError";
  }
}

export type NominalTurma = {
  id: string;
  nome: string | null;
  escola_id: string;
  curso_id: string | null;
  classe_id: string | null;
  session_id: string | null;
  ano_letivo: number | null;
  turno: string | null;
  sala: string | null;
};
export type NominalEscola = {
  id: string;
  nome: string | null;
  nif: string | null;
  endereco: string | null;
  logo_url: string | null;
};
export type NominalAluno = {
  id: string;
  nome: string | null;
  numero_processo: string | null;
  sexo?: string | null;
  bi_numero?: string | null;
  data_nascimento?: string | null;
  naturalidade?: string | null;
  provincia?: string | null;
  telefone?: string | null;
  responsavel?: string | null;
  telefone_responsavel?: string | null;
  profiles?: { avatar_url?: string | null } | null;
};
export type NominalMatricula = {
  id: string;
  turma_id: string | null;
  numero_chamada: number | null;
  status: string;
  ativo: boolean | null;
  alunos: NominalAluno | NominalAluno[] | null;
};
export type NominalSelection = {
  incluidos: NominalMatricula[];
  excluidos: Record<ListaNominalCategoria, number>;
  totalOrigem: number;
};
export type NominalRoster = {
  turma: NominalTurma;
  turmaIds: string[];
  turmaById: Map<string, NominalTurma>;
  classeNome: string;
  cursoNome: string;
  escola: NominalEscola;
  sessao: { ano: number | null; ativo: boolean | null };
  sessionId: string;
  anoLabel: string;
  mode: ListaNominalMode;
  isClasseScope: boolean;
  seleccao: NominalSelection;
  sortedMatriculas: NominalMatricula[];
};

function alunoDaMatricula(matricula: NominalMatricula): NominalAluno | null {
  return (Array.isArray(matricula.alunos) ? matricula.alunos[0] : matricula.alunos) ?? null;
}

/**
 * Verificação única de vínculo escola/utilizador para as rotas HTTP nominal PDF/XLSX.
 * Acesso por polo continua limitado pela RLS RESTRICTIVE da consulta autenticada.
 * O worker de lotes não usa esta função: a sua autorização é feita ao enfileirar.
 */
export async function authorizeNominalExport(
  supabase: Client,
  userId: string,
  scope: { turmaId: string; classeId?: never } | { classeId: string; turmaId?: never },
): Promise<string> {
  const { data: row, error } = scope.turmaId
    ? await supabase.from("turmas").select("escola_id").eq("id", scope.turmaId).maybeSingle()
    : await supabase.from("classes").select("escola_id").eq("id", scope.classeId ?? "").maybeSingle();
  if (error || !row?.escola_id) {
    throw new NominalRosterError(scope.turmaId ? "Turma não encontrada" : "Classe não encontrada", 404);
  }
  const escolaId = await resolveEscolaIdForUser(supabase, userId, row.escola_id);
  if (!escolaId || escolaId !== row.escola_id) throw new NominalRosterError("Sem acesso à escola", 403);
  const authz = await authorizeTurmasManage(supabase, escolaId, userId);
  if (!authz.allowed) throw new NominalRosterError("Sem permissão para emitir listas", 403);
  return escolaId;
}

/**
 * Mesma política, ordenação e contagem para a turma/classe em PDF e XLSX.
 * Esta função é pura: os dados nunca são guardados numa segunda fonte.
 */
export function selectAndSortNominalMatriculas(
  matriculas: readonly NominalMatricula[],
  options: {
    mode: ListaNominalMode;
    includeAllStatus?: boolean;
    isClasseScope: boolean;
    turmaById: ReadonlyMap<string, Pick<NominalTurma, "nome">>;
  },
): { seleccao: NominalSelection; sortedMatriculas: NominalMatricula[] } {
  const seleccao = selectMatriculasDaLista(matriculas, options.mode, options.includeAllStatus);
  const sortedMatriculas = options.isClasseScope
    ? [...seleccao.incluidos].sort((a, b) => {
        const alunoA = alunoDaMatricula(a);
        const alunoB = alunoDaMatricula(b);
        return compareNominalSortableRows(
          { turma: options.turmaById.get(a.turma_id ?? "")?.nome ?? "",
            chamada: a.numero_chamada, nome: alunoA?.nome ?? "",
            processo: alunoA?.numero_processo ?? "" },
          { turma: options.turmaById.get(b.turma_id ?? "")?.nome ?? "",
            chamada: b.numero_chamada, nome: alunoB?.nome ?? "",
            processo: alunoB?.numero_processo ?? "" },
        ) || a.id.localeCompare(b.id);
      })
    : seleccao.incluidos;
  return { seleccao, sortedMatriculas };
}

/** Formato de saída é uma projeção do resultado canónico, sem nova consulta. */
export function toNominalXlsxRows(roster: NominalRoster): NominalXlsxRow[] {
  return roster.sortedMatriculas.map((matricula, index) => {
    const aluno = alunoDaMatricula(matricula);
    return {
      chamada: matricula.numero_chamada ?? (roster.isClasseScope ? null : index + 1),
      processo: aluno?.numero_processo?.trim() || "NÃO ATRIBUÍDO",
      nome: aluno?.nome ?? "—",
      turma: roster.turmaById.get(matricula.turma_id ?? "")?.nome ?? "—",
      ano: roster.anoLabel,
      situacao: matricula.status ?? "desconhecido",
    };
  });
}

/**
 * Serviço canónico de leitura. Usa apenas as tabelas existentes; cliente autenticado
 * respeita RLS. Perfis PDF são pedidos exclusivamente quando necessários; XLSX
 * nunca consulta BI, nascimento, contactos, naturalidade nem avatares.
 */
export async function loadNominalRoster({
  supabase, escolaId, turmaId, classeId, year,
  mode: requestedMode, includeAllStatus = false,
  pdfFields = false, extendedStudentFields = false, jsonFields = false,
}: {
  supabase: Client;
  escolaId: string;
  turmaId?: string | null;
  classeId?: string | null;
  year?: string | null;
  mode?: ListaNominalMode;
  includeAllStatus?: boolean;
  pdfFields?: boolean;
  extendedStudentFields?: boolean;
  /** Projecção JSON sem obter perfis ou dados sensíveis desnecessários. */
  jsonFields?: boolean;
}): Promise<NominalRoster> {
  if (jsonFields && pdfFields) throw new NominalRosterError("Projecção nominal inválida", 400);
  if (!turmaId && !classeId) throw new NominalRosterError("Informe turma ou classe", 400);
  if (turmaId && classeId) throw new NominalRosterError("Selecione apenas um escopo", 400);
  const isClasseScope = Boolean(classeId);
  let classeNome = "—";
  let cursoNome = "";
  let turma: NominalTurma;
  let turmasClasse: NominalTurma[];

  if (isClasseScope && classeId) {
    const yearValue = year || String(new Date().getFullYear());
    if (!/^[0-9]{4}$/.test(yearValue) || Number(yearValue) < 2000 || Number(yearValue) > 2100) {
      throw new NominalRosterError("Ano letivo inválido", 400);
    }
    const { data: classe, error: classeError } = await supabase.from("classes")
      .select("id,nome,curso_id,cursos(nome)")
      .eq("id", classeId).eq("escola_id", escolaId).maybeSingle();
    if (classeError || !classe) throw new NominalRosterError("Classe não encontrada", 404);
    classeNome = classe.nome ?? "—";
    cursoNome = (classe as any).cursos?.nome ?? "";
    const { data: rows, error: turmaError } = await supabase.from("turmas")
      .select("id,nome,escola_id,curso_id,classe_id,session_id,ano_letivo,turno,sala")
      .eq("escola_id", escolaId).eq("classe_id", classeId)
      .eq("ano_letivo", Number(yearValue))
      .order("turno", { ascending: true }).order("nome", { ascending: true })
      .order("id", { ascending: true }).limit(201);
    if (turmaError) throw new NominalRosterError("Não foi possível consultar as turmas", 503);
    turmasClasse = (rows ?? []) as unknown as NominalTurma[];
    if (!turmasClasse.length) throw new NominalRosterError("Nenhuma turma nesta classe e ano letivo", 404);
    if (turmasClasse.length > 200) throw new NominalRosterError("Classe demasiado grande para emissão", 413);
    const ids = new Set(turmasClasse.map((row) => row.session_id));
    if (ids.size !== 1 || ids.has(null)) {
      throw new NominalRosterError("As turmas não pertencem à mesma sessão académica", 409);
    }
    turma = {
      id: "classe:" + classeId, nome: "Todas as turmas (" + turmasClasse.length + ")",
      escola_id: escolaId, curso_id: classe.curso_id ?? turmasClasse[0].curso_id,
      classe_id: classeId, session_id: turmasClasse[0].session_id,
      ano_letivo: Number(yearValue), turno: null, sala: null,
    };
  } else if (turmaId) {
    const { data: row, error } = await supabase.from("turmas")
      .select("id,nome,escola_id,curso_id,classe_id,session_id,ano_letivo,turno,sala")
      .eq("id", turmaId).eq("escola_id", escolaId).maybeSingle();
    if (error || !row) throw new NominalRosterError("Turma não encontrada", 404);
    turma = row as unknown as NominalTurma;
    turmasClasse = [turma];
  } else {
    throw new NominalRosterError("Escopo nominal inválido", 400);
  }

  const turmaIds = turmasClasse.map((row) => row.id);
  const turmaById = new Map(turmasClasse.map((row) => [row.id, row]));
  const sessionIds = new Set(turmasClasse.map((row) => row.session_id));
  if (!turma.session_id || sessionIds.size !== 1 || sessionIds.has(null)) {
    throw new NominalRosterError("As turmas não possuem uma sessão académica única", 409);
  }
  const sessionId = turma.session_id;

  const [escolaRes, sessaoRes, classeRes] = await Promise.all([
    supabase.from("escolas").select("id,nome,nif,endereco,logo_url")
      .eq("id", escolaId).maybeSingle(),
    supabase.from("anos_letivos").select("ano,ativo")
      .eq("id", sessionId).eq("escola_id", escolaId).maybeSingle(),
    !isClasseScope && turma.classe_id
      ? supabase.from("classes").select("nome")
          .eq("id", turma.classe_id).eq("escola_id", escolaId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (escolaRes.error || !escolaRes.data) throw new NominalRosterError("Escola não encontrada", 409);
  if (sessaoRes.error || !sessaoRes.data) throw new NominalRosterError("Ano letivo não encontrado", 409);
  if (classeRes.error) throw new NominalRosterError("Classe não encontrada", 409);
  const escola = escolaRes.data as NominalEscola;
  const sessao = sessaoRes.data as { ano: number | null; ativo: boolean | null };
  const ano = Number(sessao.ano);
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100 ||
      (isClasseScope && ano !== Number(year || new Date().getFullYear()))) {
    throw new NominalRosterError("Ano letivo incoerente com a sessão", 409);
  }
  if (!isClasseScope) classeNome = classeRes.data?.nome ?? "—";
  const mode = requestedMode ?? modoPadraoDaSessao(sessao.ativo);

  const optionalPdfFields = pdfFields
    ? ",sexo," + (extendedStudentFields
      ? "bi_numero,data_nascimento,naturalidade,provincia,telefone,responsavel,telefone_responsavel,"
      : "") + "profiles!alunos_profile_id_fkey(avatar_url)"
    : "";
  const optionalJsonFields = jsonFields
    ? ",sexo" + (extendedStudentFields
      ? ",bi_numero,naturalidade,provincia,telefone,responsavel,telefone_responsavel"
      : "")
    : "";
  const selection = "id,turma_id,numero_chamada,status,ativo,alunos(id,nome,numero_processo"
    + (jsonFields ? optionalJsonFields : optionalPdfFields) + ")";
  const matriculas: NominalMatricula[] = [];
  const pageSize = 500;
  const maxRoster = 10000;
  // Uma linha adicional detecta mais de 10.000 sem rejeitar exactamente 10.000.
  for (let offset = 0; offset <= maxRoster; offset += pageSize) {
    const limit = offset === maxRoster ? 1 : pageSize;
    let query = supabase.from("matriculas").select(selection)
      .eq("escola_id", escolaId).eq("session_id", sessionId)
      .order("numero_chamada", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    query = isClasseScope ? query.in("turma_id", turmaIds) : query.eq("turma_id", turmaIds[0]);
    query = applyKf2ListInvariants(query, {
      limit, maxLimit: pageSize, offset, order: [{ column: "id", ascending: true }],
    });
    const { data, error } = await query;
    if (error) throw new NominalRosterError("Não foi possível consultar as matrículas", 503);
    if (offset === maxRoster && (data?.length ?? 0)) {
      throw new NominalRosterError("Lista demasiado grande para emissão segura", 413);
    }
    matriculas.push(...((data ?? []) as unknown as NominalMatricula[]));
    if ((data?.length ?? 0) < limit) break;
  }
  const { seleccao, sortedMatriculas } = selectAndSortNominalMatriculas(matriculas, {
    mode, includeAllStatus, isClasseScope, turmaById,
  });
  return {
    turma, turmaIds, turmaById, classeNome, cursoNome, escola, sessao,
    sessionId, anoLabel: ano + "/" + (ano + 1), mode, isClasseScope,
    seleccao, sortedMatriculas,
  };
}

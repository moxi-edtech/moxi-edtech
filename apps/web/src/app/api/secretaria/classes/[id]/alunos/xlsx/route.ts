import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { authorizeTurmasManage } from "@/lib/escola/disciplinas";
import { applyKf2ListInvariants } from "@/lib/kf2";
import { modoPadraoDaSessao, resumoExclusoes, selectMatriculasDaLista, type ListaNominalMode } from "@/lib/documentos/listaNominalPolicy";
import { renderNominalXlsx, sortClasseNominalRows, type NominalXlsxRow } from "@/lib/documentos/listaNominalXlsx";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type Turma = { id: string; nome: string | null; session_id: string | null };
type Aluno = { id: string; nome: string | null; numero_processo: string | null };
type Matricula = {
  id: string;
  turma_id: string | null;
  numero_chamada: number | null;
  status: string | null;
  ativo: boolean | null;
  alunos: Aluno | Aluno[] | null;
};

function deny(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, {
    status, headers: { "Cache-Control": "private, no-store" },
  });
}

/**
 * Uma classe, todas as suas turmas no ano académico seleccionado.
 * Mesma selecção de estados do PDF. Nunca exporta notas nem campos sensíveis.
 * Isolamento intra-escola por polo ainda depende de RLS canónica; não o pressupor.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const url = new URL(req.url);
  if (url.searchParams.has("polo_id") || url.searchParams.has("poloId")) {
    return deny("Exportação por polo indisponível sem vínculo canónico", 403);
  }
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return deny("Origem da exportação não autorizada", 403);
  }
  const requestedMode = url.searchParams.get("mode");
  if (requestedMode && requestedMode !== "ano_letivo" && requestedMode !== "operacional") {
    return deny("Modo de lista inválido", 400);
  }
  const yearValue = url.searchParams.get("year") ?? String(new Date().getFullYear());
  const year = Number(yearValue);
  if (!/^[0-9]{4}$/.test(yearValue) || !Number.isInteger(year) || year < 2000 || year > 2100) {
    return deny("Ano letivo inválido", 400);
  }
  const includeAllStatus = url.searchParams.get("all_status") === "true";

  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return deny("Sessão terminada", 401);

    const { id: classeId } = await params;
    const { data: classeScope, error: scopeError } = await supabase.from("classes")
      .select("escola_id").eq("id", classeId).maybeSingle();
    if (scopeError || !classeScope?.escola_id) return deny("Classe não encontrada", 404);
    const escolaId = await resolveEscolaIdForUser(supabase, user.id, classeScope.escola_id);
    if (!escolaId || escolaId !== classeScope.escola_id) return deny("Sem acesso à escola", 403);
    const authz = await authorizeTurmasManage(supabase, escolaId, user.id);
    if (!authz.allowed) return deny("Sem permissão para emitir listas", 403);

    const [{ data: classe, error: classeError }, { data: turmas, error: turmasError }] = await Promise.all([
      supabase.from("classes").select("id,nome").eq("id", classeId).eq("escola_id", escolaId).maybeSingle(),
      supabase.from("turmas")
        .select("id,nome,session_id").eq("escola_id", escolaId)
        .eq("classe_id", classeId).eq("ano_letivo", year)
        .order("nome", { ascending: true }).order("id", { ascending: true }).limit(201),
    ]);
    if (classeError || !classe) return deny("Classe não encontrada", 404);
    if (turmasError) return deny("Não foi possível consultar as turmas", 503);
    const turmasClasse = (turmas ?? []) as Turma[];
    if (turmasClasse.length === 0) return deny("Nenhuma turma nesta classe e ano letivo", 404);
    if (turmasClasse.length > 200) return deny("Classe demasiado grande para uma emissão", 413);
    const sessionIds = new Set(turmasClasse.map((turma) => turma.session_id));
    if (sessionIds.size !== 1 || sessionIds.has(null)) {
      return deny("As turmas não pertencem à mesma sessão académica", 409);
    }
    const sessionId = turmasClasse[0].session_id;
    if (!sessionId) return deny("Sessão académica ausente", 409);

    const [{ data: sessao, error: sessaoError }, { data: escola, error: escolaError }] = await Promise.all([
      supabase.from("anos_letivos").select("ano,ativo").eq("id", sessionId).maybeSingle(),
      supabase.from("escolas").select("nome").eq("id", escolaId).maybeSingle(),
    ]);
    if (sessaoError || !sessao || Number(sessao.ano) !== year) return deny("Ano letivo incoerente com a sessão", 409);
    if (escolaError || !escola) return deny("Escola não encontrada", 409);
    const mode: ListaNominalMode = requestedMode === "ano_letivo" || requestedMode === "operacional"
      ? requestedMode : modoPadraoDaSessao(sessao.ativo);

    const turmaIds = turmasClasse.map((turma) => turma.id);
    const turmaById = new Map(turmasClasse.map((turma) => [turma.id, turma]));
    const matriculas: Matricula[] = [];
    const pageSize = 500;
    const maxRoster = 10000;
    for (let offset = 0; offset < maxRoster; offset += pageSize) {
      let query = supabase.from("matriculas")
        .select("id,turma_id,numero_chamada,status,ativo,alunos(id,nome,numero_processo)")
        .eq("escola_id", escolaId)
        .eq("session_id", sessionId)
        .in("turma_id", turmaIds)
        .order("numero_chamada", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      query = applyKf2ListInvariants(query, {
        limit: pageSize, maxLimit: pageSize, offset, order: [{ column: "id", ascending: true }],
      });
      const { data, error } = await query;
      if (error) return deny("Não foi possível consultar as matrículas", 503);
      matriculas.push(...((data ?? []) as Matricula[]));
      if ((data?.length ?? 0) < pageSize) break;
      if (offset + pageSize >= maxRoster) return deny("Lista demasiado grande para emissão segura", 413);
    }

    const selecionados = selectMatriculasDaLista(matriculas, mode, includeAllStatus);
    const anoLabel = year + "/" + (year + 1);
    const rows: NominalXlsxRow[] = sortClasseNominalRows(selecionados.incluidos.map((m) => {
      const aluno = Array.isArray(m.alunos) ? m.alunos[0] : m.alunos;
      return {
        chamada: m.numero_chamada,
        processo: aluno?.numero_processo?.trim() || "NÃO ATRIBUÍDO",
        nome: aluno?.nome ?? "—",
        turma: turmaById.get(m.turma_id ?? "")?.nome ?? "—",
        ano: anoLabel,
        situacao: m.status ?? "desconhecido",
      };
    }));
    const workbook = renderNominalXlsx({
      escola: escola.nome ?? "Escola", classe: classe.nome ?? "—",
      turma: "Todas as turmas", quantidadeTurmas: turmasClasse.length,
      ano: anoLabel, mode, totalOrigem: selecionados.totalOrigem,
      exclusoes: resumoExclusoes(selecionados.excluidos), rows,
    });

    // Falha de auditoria impede entrega, mesmo que o ficheiro tenha sido gerado.
    const { error: auditError } = await supabase.from("audit_logs").insert({
      escola_id: escolaId, portal: "secretaria",
      acao: "LISTA_NOMINAL_XLSX_EXPORTADA",
      tabela: "classes", entity: "classes", entity_id: classeId,
      details: {
        actor_id: user.id, classe_id: classeId, ano_letivo_id: sessionId,
        ano: year, modo: mode, turmas: turmasClasse.length,
        linhas: rows.length, total_originais: selecionados.totalOrigem,
        total_excluidos: selecionados.totalOrigem - rows.length,
        campos_sensiveis: false,
      },
    });
    if (auditError) return deny("Auditoria indisponível. Excel não emitido.", 503);
    return new NextResponse(new Uint8Array(workbook), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="lista_classe_' + classeId + "_" + year + "-" + (year + 1) + '.xlsx"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Lista-Mode": mode,
      },
    });
  } catch {
    return deny("Não foi possível gerar o Excel da classe", 500);
  }
}

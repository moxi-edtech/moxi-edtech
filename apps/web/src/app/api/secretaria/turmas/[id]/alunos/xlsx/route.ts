import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { authorizeTurmasManage } from "@/lib/escola/disciplinas";
import { applyKf2ListInvariants } from "@/lib/kf2";
import {
  modoPadraoDaSessao, resumoExclusoes, selectMatriculasDaLista,
  type ListaNominalMode,
} from "@/lib/documentos/listaNominalPolicy";
import { renderNominalXlsx, type NominalXlsxRow } from "@/lib/documentos/listaNominalXlsx";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type MatriculaRow = {
  id: string;
  numero_chamada: number | null;
  status: string | null;
  ativo: boolean | null;
  alunos: {
    id: string;
    nome: string | null;
    numero_processo: string | null;
  } | Array<{
    id: string;
    nome: string | null;
    numero_processo: string | null;
  }> | null;
};

function deny(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

/**
 * Lista nominal XLSX: mesma autorização e selecção de matrículas da lista PDF.
 * Não é a pauta digital nem o CSV avançado sujeito à política CC-013.
 *
 * O vínculo canónico operador-polo-turma ainda não existe; não aceitar
 * filtros de polo e manter esta PR sem merge até homologar o RLS entre polos.
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
  const includeAllStatus = url.searchParams.get("all_status") === "true";

  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return deny("Sessão terminada", 401);

    const { id: turmaId } = await params;
    const { data: turmaScope } = await supabase.from("turmas")
      .select("escola_id").eq("id", turmaId).maybeSingle();
    if (!turmaScope?.escola_id) return deny("Turma não encontrada", 404);

    const escolaId = await resolveEscolaIdForUser(supabase, user.id, turmaScope.escola_id);
    if (!escolaId || escolaId !== turmaScope.escola_id) return deny("Sem acesso à escola", 403);
    const authz = await authorizeTurmasManage(supabase, escolaId, user.id);
    if (!authz.allowed) return deny("Sem permissão para emitir listas", 403);

    const { data: turma, error: turmaError } = await supabase.from("turmas")
      .select("id,nome,escola_id,session_id,ano_letivo")
      .eq("id", turmaId).eq("escola_id", escolaId).maybeSingle();
    if (turmaError || !turma) return deny("Turma não encontrada", 404);
    if (!turma.session_id) return deny("Turma sem sessão académica", 409);

    const [{ data: sessao, error: sessaoError }, { data: escola, error: escolaError }] = await Promise.all([
      supabase.from("anos_letivos").select("ano,ativo").eq("id", turma.session_id).maybeSingle(),
      supabase.from("escolas").select("nome").eq("id", escolaId).maybeSingle(),
    ]);
    if (sessaoError || !sessao) return deny("Ano letivo não encontrado", 409);
    if (escolaError || !escola) return deny("Escola não encontrada", 409);

    const mode: ListaNominalMode = requestedMode === "ano_letivo" || requestedMode === "operacional"
      ? requestedMode : modoPadraoDaSessao(sessao.ativo);
    const ano = Number(sessao.ano ?? turma.ano_letivo);
    if (!Number.isInteger(ano) || ano < 2000) return deny("Ano letivo inválido", 409);
    const anoLabel = `${ano}/${ano + 1}`;

    // Idêntico ao PDF: paginação sem truncagem silenciosa, sessão real,
    // ordenação estável e invariantes de lista (incluindo registos eliminados).
    const pageSize = 500;
    const maxRoster = 10000;
    const matriculas: MatriculaRow[] = [];
    for (let offset = 0; offset < maxRoster; offset += pageSize) {
      let query = supabase.from("matriculas")
        .select("id,numero_chamada,status,ativo,alunos(id,nome,numero_processo)")
        .eq("escola_id", escolaId)
        .eq("turma_id", turmaId)
        .eq("session_id", turma.session_id)
        .order("numero_chamada", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      query = applyKf2ListInvariants(query, {
        limit: pageSize, maxLimit: pageSize, offset,
        order: [{ column: "id", ascending: true }],
      });
      const { data, error } = await query;
      if (error) return deny("Não foi possível consultar as matrículas", 503);
      matriculas.push(...((data ?? []) as MatriculaRow[]));
      if ((data?.length ?? 0) < pageSize) break;
      if (offset + pageSize === maxRoster) {
        // Falhar fechado: nunca exportar uma lista potencialmente truncada.
        return deny("Lista demasiado grande para emissão segura", 413);
      }
    }

    const selecionados = selectMatriculasDaLista(matriculas, mode, includeAllStatus);
    const rows: NominalXlsxRow[] = selecionados.incluidos.map((m, index) => {
      const aluno = Array.isArray(m.alunos) ? m.alunos[0] : m.alunos;
      return {
        chamada: m.numero_chamada ?? index + 1,
        processo: aluno?.numero_processo?.trim() || "NÃO ATRIBUÍDO",
        nome: aluno?.nome || "—",
        turma: turma.nome ?? "—",
        ano: anoLabel,
        situacao: m.status ?? "desconhecido",
      };
    });

    const workbook = renderNominalXlsx({
      escola: escola.nome ?? "Escola",
      turma: turma.nome ?? "—",
      ano: anoLabel,
      mode,
      totalOrigem: selecionados.totalOrigem,
      exclusoes: resumoExclusoes(selecionados.excluidos),
      rows,
    });

    // Sem auditoria persistida, o documento não é entregue ao navegador.
    const { error: auditError } = await supabase.from("audit_logs").insert({
      escola_id: escolaId, portal: "secretaria",
      acao: "LISTA_NOMINAL_XLSX_EXPORTADA",
      tabela: "turmas", entity: "turmas", entity_id: turmaId,
      details: {
        actor_id: user.id, turma_id: turmaId,
        ano_letivo_id: turma.session_id, modo: mode,
        linhas: rows.length, total_originais: selecionados.totalOrigem,
        total_excluidos: selecionados.totalOrigem - selecionados.incluidos.length,
        campos_sensiveis: false,
      },
    });
    if (auditError) return deny("Auditoria indisponível. Excel não emitido.", 503);

    return new NextResponse(workbook, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="lista_turma_${turmaId}_${ano}-${ano + 1}.xlsx"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Lista-Mode": mode,
      },
    });
  } catch {
    return deny("Não foi possível gerar o Excel da lista nominal", 500);
  }
}

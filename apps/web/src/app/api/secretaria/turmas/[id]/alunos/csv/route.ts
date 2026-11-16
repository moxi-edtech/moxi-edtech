import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { authorizeTurmasManage } from "@/lib/escola/disciplinas";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveRosterExportPolicy, safeCsvCell } from "@/lib/command-center/roster-export-policy";
import { LISTA_NOMINAL_MODES, modoPadraoDaSessao, selectMatriculasDaLista } from "@/lib/documentos/listaNominalPolicy";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type MatriculaCsv = {
  id: string;
  numero_chamada: number | null;
  status: string | null;
  ativo: boolean | null;
  alunos: { id: string; nome: string | null; numero_processo: string | null }
    | Array<{ id: string; nome: string | null; numero_processo: string | null }> | null;
};

function deny(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, {
    status, headers: { "Cache-Control": "private, no-store" },
  });
}

/**
 * Formato opcional: CSV compatível com Excel/LibreOffice, com política CC-013.
 * Não expõe campos sensíveis nem ignora a sessão académica/estado da matrícula.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const url = new URL(req.url);
  if (url.searchParams.has("poloId") || url.searchParams.has("polo_id")) {
    return deny("Exportação por polo indisponível sem vínculo canónico", 403);
  }
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return deny("Origem da exportação não autorizada", 403);
  }

  try {
    const supabase = await supabaseRouteClient<Database>();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return deny("Sessão terminada", 401);

    const { id: turmaId } = await params;
    const { data: scope } = await supabase.from("turmas")
      .select("escola_id").eq("id", turmaId).maybeSingle();
    if (!scope?.escola_id) return deny("Turma não encontrada", 404);

    const escolaId = await resolveEscolaIdForUser(supabase, user.id, scope.escola_id);
    if (!escolaId) return deny("Sem acesso à escola", 403);
    const authz = await authorizeTurmasManage(supabase, escolaId, user.id);
    if (!authz.allowed) return deny("Sem permissão", 403);

    const policy = resolveRosterExportPolicy(
      escolaId, process.env.KLASSE_CC_ROSTER_EXPORT_POLICY_JSON,
    );
    if (!policy.enabled) return deny("CSV desactivado para esta escola (CC-013)", 403);
    const role = await requireRoleInSchool({
      supabase, escolaId, productContext: "k12", roles: policy.roles,
    });
    if (role.error) return role.error;

    const requestedMode = url.searchParams.get("mode");
    if (requestedMode && requestedMode !== "ano_letivo" && requestedMode !== "operacional") {
      return deny("Modo de lista inválido", 400);
    }
    const includeAllStatus = url.searchParams.get("all_status") === "true";
    const { data: turma } = await supabase.from("turmas")
      .select("id,nome,session_id,ano_letivo")
      .eq("id", turmaId).eq("escola_id", escolaId).maybeSingle();
    if (!turma?.session_id) return deny("Turma sem sessão académica", 409);
    const { data: sessao } = await supabase.from("anos_letivos")
      .select("ano,ativo").eq("id", turma.session_id).maybeSingle();
    if (!sessao) return deny("Ano letivo não encontrado", 409);
    const mode = requestedMode === "ano_letivo" || requestedMode === "operacional"
      ? requestedMode : modoPadraoDaSessao(sessao.ativo);

    // Limite explícito sem truncagem silenciosa; evita exportação excessiva.
    const { data, error } = await supabase.from("matriculas")
      .select("id,numero_chamada,status,ativo,alunos(id,nome,numero_processo)")
      .eq("escola_id", escolaId)
      .eq("turma_id", turmaId)
      .eq("session_id", turma.session_id)
      .order("numero_chamada", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(501);
    if (error) return deny("Não foi possível consultar a turma", 503);
    if ((data?.length ?? 0) > 500) return deny("Turma demasiado grande para exportação segura", 413);
    const selected = selectMatriculasDaLista((data ?? []) as unknown as MatriculaCsv[], mode, includeAllStatus);
    if (selected.incluidos.length > policy.maxRows) {
      return deny("Lista acima do limite de exportação da escola", 413);
    }

    const labelAno = String(sessao.ano) + "/" + String(Number(sessao.ano) + 1);
    const header = ["Nº de chamada", "Nº de processo", "Nome completo", "Turma", "Ano letivo", "Situação"];
    const rows: string[][] = [];
    let sequencia = 0;
    for (const matricula of selected.incluidos) {
      const alunos = matricula.alunos
        ? Array.isArray(matricula.alunos) ? matricula.alunos : [matricula.alunos]
        : [];
      for (const aluno of alunos) {
        sequencia += 1;
        rows.push([
          String(matricula.numero_chamada ?? sequencia),
          aluno.numero_processo?.trim() || "NÃO ATRIBUÍDO",
          aluno.nome ?? "—",
          turma.nome ?? "—",
          labelAno,
          matricula.status ?? "desconhecido",
        ]);
      }
    }

    // A auditoria é parte da transacção lógica da exportação: falha = sem CSV.
    const timestamp = new Date().toISOString();
    const { count, error: rateError } = await supabase.from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("escola_id", escolaId).eq("acao", "LISTA_NOMINAL_CSV_EXPORTADA")
      .contains("details", { actor_id: user.id })
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
    if (rateError) return deny("Não foi possível verificar o limite da exportação", 503);
    if ((count ?? 0) >= 10) {
      return NextResponse.json({ ok: false, error: "Limite de 10 exportações por hora" }, {
        status: 429, headers: { "Retry-After": "3600", "Cache-Control": "private, no-store" },
      });
    }

    const { error: auditError } = await supabase.from("audit_logs").insert({
      escola_id: escolaId, portal: "secretaria",
      acao: "LISTA_NOMINAL_CSV_EXPORTADA",
      tabela: "turmas", entity: "turmas", entity_id: turmaId,
      details: {
        actor_id: user.id, turma_id: turmaId, ano_letivo_id: turma.session_id,
        modo: mode, linhas: rows.length, campos_sensiveis: false,
        total_originais: selected.totalOrigem,
        total_excluidos: selected.totalOrigem - selected.incluidos.length,
        emitido_em: timestamp,
      },
    });
    if (auditError) return deny("Falha de auditoria. CSV não emitido", 503);

    const csv = "\uFEFF" + [
      header.map(safeCsvCell).join(","),
      ...rows.map(row => row.map(safeCsvCell).join(",")),
    ].join("\r\n") + "\r\n";

    const filename = "lista_escola_" + escolaId + "_turma_" + turmaId + "_" +
      labelAno.replace("/", "-") + "_" + timestamp.slice(0, 10) + ".csv";
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="' + filename + '"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Lista-Mode": LISTA_NOMINAL_MODES[mode] === "Lista operacional actual" ? "operacional" : "ano_letivo",
      },
    });
  } catch {
    return deny("Não foi possível exportar a lista nominal", 500);
  }
}

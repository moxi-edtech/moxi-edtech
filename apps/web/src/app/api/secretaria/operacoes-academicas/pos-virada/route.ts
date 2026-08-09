import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleInSchool } from "@/lib/authz";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Session = { id: string; ano: number; ativo: boolean; data_inicio: string | null; data_fim: string | null };
type Row = Record<string, any>;

async function context() {
  const supabase = await supabaseServerTyped<Database>();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }) };
  const escolaId = await resolveEscolaIdForUser(supabase, user.id);
  if (!escolaId) return { error: NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 }) };
  const authz = await requireRoleInSchool({
    supabase,
    escolaId,
    roles: ["secretaria", "secretaria_financeiro", "admin_financeiro", "admin_secretaria", "admin", "admin_escola", "staff_admin", "diretor"],
  });
  if (authz.error) return { error: authz.error };
  return { supabase: supabase as any, escolaId };
}

async function sessions(db: any, escolaId: string) {
  const { data, error } = await db.from("anos_letivos").select("id,ano,ativo,data_inicio,data_fim").eq("escola_id", escolaId).order("ano", { ascending: false });
  if (error) throw error;
  const list = (data ?? []) as Session[];
  const current = list.find((item) => item.ativo) ?? list[0] ?? null;
  const previous = current ? list.find((item) => item.ano < current.ano) ?? null : null;
  return { current, previous };
}

export async function GET(request: Request) {
  const c = await context();
  if ("error" in c) return c.error;
  const { supabase: db, escolaId } = c;
  try {
    const { current, previous } = await sessions(db, escolaId);
    if (!current || !previous) {
      return NextResponse.json({ ok: true, sessions: { current, previous }, rows: [], summary: { total: 0, debt: 0, finalists: 0, review: 0 } });
    }

    const optionsForMatriculaId = new URL(request.url).searchParams.get("options_for_matricula_id");
    if (optionsForMatriculaId) {
      const { data: source, error: sourceError } = await db
        .from("matriculas")
        .select("id,turma_id,session_id")
        .eq("escola_id", escolaId)
        .eq("id", optionsForMatriculaId)
        .eq("session_id", previous.id)
        .maybeSingle();
      if (sourceError) throw sourceError;
      if (!source?.turma_id) {
        return NextResponse.json({ ok: false, error: "Matrícula de origem sem turma identificada." }, { status: 404 });
      }

      const { data: sourceTurma, error: sourceTurmaError } = await db
        .from("turmas")
        .select("id,curso_id,classe_num,turno,letra,nome")
        .eq("escola_id", escolaId)
        .eq("id", source.turma_id)
        .maybeSingle();
      if (sourceTurmaError) throw sourceTurmaError;
      const { data: sourceClassNumber, error: sourceClassError } = await db.rpc("turma_classe_numero", { p_turma_id: source.turma_id });
      if (sourceClassError) throw sourceClassError;
      if (!sourceTurma?.curso_id || sourceClassNumber === null) {
        return NextResponse.json({ ok: true, source: sourceTurma, options: [] });
      }

      const { data: targetTurmas, error: targetError } = await db
        .from("turmas")
        .select("id,nome,curso_id,classe_num,turno,letra,capacidade_maxima")
        .eq("escola_id", escolaId)
        .eq("session_id", current.id)
        .eq("ano_letivo_id", current.id)
        .eq("curso_id", sourceTurma.curso_id)
        .order("turno", { ascending: true })
        .order("letra", { ascending: true });
      if (targetError) throw targetError;

      const targetClassNumber = Number(sourceClassNumber) + 1;
      const targetWithClass = await Promise.all((targetTurmas ?? []).map(async (turma: any) => {
        const { data: resolvedClassNumber, error: classError } = await db.rpc("turma_classe_numero", { p_turma_id: turma.id });
        if (classError) throw classError;
        return { ...turma, resolved_class_num: resolvedClassNumber };
      }));
      const matchingTargetTurmas = targetWithClass.filter((turma: any) => turma.resolved_class_num === targetClassNumber);

      const targetIds = matchingTargetTurmas.map((turma: any) => turma.id);
      const { data: activeRows, error: activeError } = targetIds.length
        ? await db.from("matriculas").select("turma_id").eq("escola_id", escolaId).eq("session_id", current.id).eq("ativo", true).in("turma_id", targetIds)
        : { data: [], error: null };
      if (activeError) throw activeError;
      const occupancy = new Map<string, number>();
      for (const row of activeRows ?? []) occupancy.set(row.turma_id, (occupancy.get(row.turma_id) ?? 0) + 1);

      const options = matchingTargetTurmas.map((turma: any) => {
        const ocupacao = occupancy.get(turma.id) ?? 0;
        const capacidade = turma.capacidade_maxima === null ? null : Number(turma.capacidade_maxima);
        return {
          id: turma.id,
          nome: turma.nome,
          turno: turma.turno,
          letra: turma.letra,
          classe_num: turma.resolved_class_num,
          ocupacao,
          capacidade_maxima: capacidade,
          vagas: capacidade && capacidade > 0 ? Math.max(capacidade - ocupacao, 0) : null,
          disponivel: !capacidade || capacidade <= 0 || ocupacao < capacidade,
          mesmo_turno: turma.turno === sourceTurma.turno,
        };
      }).sort((a: any, b: any) => Number(b.mesmo_turno) - Number(a.mesmo_turno));

      return NextResponse.json({ ok: true, source: sourceTurma, options });
    }

    // A leitura direta de alunos/ledger fica sujeita a políticas RLS diferentes
    // por perfil. A RPC valida o tenant e devolve o read model completo numa
    // única operação autorizada.
    const { data: pendingRows, error: pendingError } = await db.rpc("get_pos_virada_pendencias", {
      p_escola_id: escolaId,
      p_origem_session_id: previous.id,
      p_destino_session_id: current.id,
    });
    if (pendingError) throw pendingError;
    const rows = ((pendingRows ?? []) as Row[]).map((row) => {
      const saldo = Number(row.saldo ?? 0);
      const podePromover = row.motivo !== "finalista" && saldo <= 0;
      return {
        id: row.reclassificacao_id ? `reclassificacao:${row.reclassificacao_id}` : `source:${row.matricula_id}`,
        reclassificacao_id: row.reclassificacao_id,
        matricula_id: row.matricula_id,
        aluno_id: row.aluno_id,
        nome: row.nome || "Aluno sem nome",
        turma: row.turma || "Turma anterior",
        status_matricula: row.status_matricula,
        saldo,
        motivo: row.motivo,
        estado: row.motivo === "divida" ? "Aguarda regularização financeira" : row.motivo === "finalista" ? "Aguardando destino académico" : podePromover ? "Pronto para promoção" : "Revisão necessária",
        tipo: row.tipo,
        pode_promover: podePromover,
      };
    });
    return NextResponse.json({
      ok: true,
      sessions: { current, previous },
      rows,
      summary: {
        total: rows.length,
        debt: rows.filter((row) => row.motivo === "divida").length,
        finalists: rows.filter((row) => row.motivo === "finalista").length,
        review: rows.filter((row) => row.motivo === "revisao").length,
      },
    });

  } catch (error: unknown) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Não foi possível carregar as pendências" }, { status: 500 });
  }
}

const actionSchema = z.object({
  action: z.enum(["promote_after_payment", "archive_finalist", "enroll_finalist"]),
  aluno_id: z.string().uuid().optional(),
  reclassificacao_id: z.string().uuid().optional(),
  turma_destino_id: z.string().uuid().optional(),
  motivo: z.string().trim().max(500).optional().nullable(),
});

export async function POST(request: Request) {
  const c = await context();
  if ("error" in c) return c.error;
  const { supabase: db, escolaId } = c;
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Ação inválida" }, { status: 400 });
  try {
    const { current, previous } = await sessions(db, escolaId);
    if (!current || !previous) return NextResponse.json({ ok: false, error: "Não existem anos letivos de origem e destino" }, { status: 409 });
    const input = parsed.data;
    if (input.action === "promote_after_payment") {
      if (!input.aluno_id) return NextResponse.json({ ok: false, error: "Aluno obrigatório" }, { status: 400 });
      const { data, error } = input.turma_destino_id
        ? await db.rpc("promover_aluno_pos_pagamento", { p_escola_id: escolaId, p_aluno_id: input.aluno_id, p_from_session_id: previous.id, p_to_session_id: current.id, p_turma_destino_id: input.turma_destino_id })
        : await db.rpc("promover_aluno_pos_pagamento", { p_escola_id: escolaId, p_aluno_id: input.aluno_id, p_from_session_id: previous.id, p_to_session_id: current.id });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 409 });
      await db.rpc("sync_reclassificacoes_virada", { p_escola_id: escolaId, p_origem_session_id: previous.id, p_destino_session_id: current.id });
      return NextResponse.json({ ok: true, result: data });
    }
    if (!input.reclassificacao_id) return NextResponse.json({ ok: false, error: "Reclassificação obrigatória" }, { status: 400 });
    if (input.action === "enroll_finalist" && !input.turma_destino_id) return NextResponse.json({ ok: false, error: "Escolha a turma de destino" }, { status: 400 });
    const fn = input.action === "archive_finalist" ? "finalistas_concluir_arquivar" : "finalistas_matricular_novo_ciclo";
    const args = input.action === "archive_finalist"
      ? { p_escola_id: escolaId, p_reclassificacao_ids: [input.reclassificacao_id], p_motivo: input.motivo ?? null }
      : { p_escola_id: escolaId, p_reclassificacao_ids: [input.reclassificacao_id], p_turma_destino_id: input.turma_destino_id, p_motivo: input.motivo ?? null };
    const { data, error } = await db.rpc(fn, args);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 409 });
    return NextResponse.json({ ok: true, result: data });
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Não foi possível executar a ação" }, { status: 500 });
  }
}

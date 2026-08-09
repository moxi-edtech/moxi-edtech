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

export async function GET() {
  const c = await context();
  if ("error" in c) return c.error;
  const { supabase: db, escolaId } = c;
  try {
    const { current, previous } = await sessions(db, escolaId);
    if (!current || !previous) {
      return NextResponse.json({ ok: true, sessions: { current, previous }, rows: [], summary: { total: 0, debt: 0, finalists: 0, review: 0 } });
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
      const { data, error } = await db.rpc("promover_aluno_pos_pagamento", { p_escola_id: escolaId, p_aluno_id: input.aluno_id, p_from_session_id: previous.id, p_to_session_id: current.id });
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

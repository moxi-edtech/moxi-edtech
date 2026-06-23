import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";
import { recordAuditServer } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BodySchema = z.object({
  target_turma_id: z.string().uuid(),
  motivo: z.string().trim().max(300).optional().nullable(),
});

const ALLOWED_ROLES = ["secretaria", "secretaria_financeiro", "admin_financeiro", "admin", "admin_escola", "staff_admin"] as const;
const ACTIVE_STATUSES = ["ativo", "ativa", "matriculado"] as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sourceTurmaId } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues?.[0]?.message || "Payload inválido" },
        { status: 400 }
      );
    }

    if (sourceTurmaId === parsed.data.target_turma_id) {
      return NextResponse.json(
        { ok: false, error: "A turma destino deve ser diferente da turma de origem." },
        { status: 400 }
      );
    }

    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const { data: sourceTurma, error: sourceError } = await supabase
      .from("turmas")
      .select("id, escola_id, nome, ano_letivo")
      .eq("id", sourceTurmaId)
      .maybeSingle();

    if (sourceError || !sourceTurma) {
      return NextResponse.json({ ok: false, error: "Turma de origem não encontrada." }, { status: 404 });
    }

    const escolaId = sourceTurma.escola_id;
    const resolvedEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, escolaId);
    if (!resolvedEscolaId || resolvedEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão." }, { status: 403 });
    }

    const { error: authError } = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: [...ALLOWED_ROLES],
    });
    if (authError) return authError;

    const [{ data: targetTurma, error: targetError }, { data: sourceRows, error: matriculasError }] =
      await Promise.all([
        supabase
          .from("vw_turmas_para_matricula")
          .select("id, escola_id, turma_nome, ano_letivo, capacidade_maxima, ocupacao_atual")
          .eq("escola_id", escolaId)
          .eq("id", parsed.data.target_turma_id)
          .maybeSingle(),
        supabase
          .from("matriculas")
          .select("id, status")
          .eq("escola_id", escolaId)
          .eq("turma_id", sourceTurmaId)
          .in("status", [...ACTIVE_STATUSES]),
      ]);

    if (targetError || !targetTurma) {
      return NextResponse.json({ ok: false, error: "Turma destino não encontrada." }, { status: 404 });
    }

    if (Number(targetTurma.ano_letivo ?? sourceTurma.ano_letivo) !== Number(sourceTurma.ano_letivo)) {
      return NextResponse.json(
        { ok: false, error: "A transferência em massa exige turmas do mesmo ano letivo." },
        { status: 400 }
      );
    }

    if (matriculasError) {
      return NextResponse.json({ ok: false, error: matriculasError.message }, { status: 400 });
    }

    const matriculasAtivas = sourceRows ?? [];
    if (matriculasAtivas.length === 0) {
      return NextResponse.json(
        { ok: false, error: "A turma de origem não possui matrículas ativas para transferir." },
        { status: 400 }
      );
    }

    const capacidadeDestino = Number(targetTurma.capacidade_maxima ?? 0);
    const ocupacaoDestino = Number(targetTurma.ocupacao_atual ?? 0);
    const vagasRestantes = capacidadeDestino > 0 ? capacidadeDestino - ocupacaoDestino : null;
    if (vagasRestantes !== null && vagasRestantes < matriculasAtivas.length) {
      return NextResponse.json(
        {
          ok: false,
          error: `A turma destino não tem vagas suficientes. Restantes: ${Math.max(vagasRestantes, 0)}. Necessárias: ${matriculasAtivas.length}.`,
        },
        { status: 409 }
      );
    }

    const transferredIds: string[] = [];
    const failures: Array<{ matricula_id: string; error: string }> = [];

    for (const matricula of matriculasAtivas) {
      const { data: newMatriculaId, error: rpcError } = await supabase
        .rpc("transferir_aluno_turma", {
          p_matricula_origem_id: matricula.id,
          p_turma_destino_id: parsed.data.target_turma_id,
          p_motivo: parsed.data.motivo ?? null,
        })
        .single();

      if (rpcError || !newMatriculaId) {
        failures.push({
          matricula_id: matricula.id,
          error: rpcError?.message || "Falha ao transferir matrícula.",
        });
        continue;
      }

      transferredIds.push(String(newMatriculaId));
    }

    recordAuditServer({
      escolaId,
      portal: "secretaria",
      acao: "TURMA_TRANSFERENCIA_EM_MASSA",
      entity: "turmas",
      entityId: sourceTurmaId,
      details: {
        turma_origem_id: sourceTurmaId,
        turma_origem_nome: sourceTurma.nome,
        turma_destino_id: parsed.data.target_turma_id,
        turma_destino_nome: targetTurma.turma_nome,
        motivo: parsed.data.motivo ?? null,
        requested: matriculasAtivas.length,
        transferred: transferredIds.length,
        failed: failures.length,
      },
    }).catch(() => null);

    if (failures.length > 0) {
      const firstFailure = failures[0];
      return NextResponse.json(
        {
          ok: false,
          error: firstFailure?.error || "Falha ao transferir uma ou mais matrículas.",
          turma_origem: { id: sourceTurmaId, nome: sourceTurma.nome },
          turma_destino: { id: parsed.data.target_turma_id, nome: targetTurma.turma_nome },
          requested: matriculasAtivas.length,
          transferred: transferredIds.length,
          failed: failures.length,
          failures,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true,
      turma_origem: { id: sourceTurmaId, nome: sourceTurma.nome },
      turma_destino: { id: parsed.data.target_turma_id, nome: targetTurma.turma_nome },
      requested: matriculasAtivas.length,
      transferred: transferredIds.length,
      failed: failures.length,
      failures,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

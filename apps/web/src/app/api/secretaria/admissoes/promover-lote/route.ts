import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRoleInSchool } from "@/lib/authz";
import { recordAuditServer } from "@/lib/audit";

const payloadSchema = z.object({
  escola_id: z.string().uuid(),
  candidatura_ids: z.array(z.string().uuid()).min(1).max(50),
  turma_id: z.string().uuid(),
  observacao: z.string().trim().max(500).optional().nullable(),
});

type PromotionFailure = {
  candidatura_id: string;
  error: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const idempotencyKey = request.headers.get("Idempotency-Key") ?? request.headers.get("idempotency-key");

  if (!idempotencyKey) {
    return NextResponse.json({ ok: false, error: "Idempotency-Key obrigatório" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.format() }, { status: 400 });
  }

  const { escola_id: escolaId, candidatura_ids, turma_id, observacao } = parsed.data;
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const { error: authError } = await requireRoleInSchool({
    supabase,
    escolaId,
    roles: ["secretaria", "admin", "admin_escola", "staff_admin"],
  });
  if (authError) return authError;

  const uniqueIds = Array.from(new Set(candidatura_ids));

  const [{ data: turma, error: turmaError }, { data: candidaturas, error: candidaturasError }] = await Promise.all([
    supabase
      .from("vw_turmas_para_matricula")
      .select("id, escola_id, turma_nome, curso_id, classe_id, ano_letivo, turno, capacidade_maxima, ocupacao_atual")
      .eq("escola_id", escolaId)
      .eq("id", turma_id)
      .maybeSingle(),
    supabase
      .from("candidaturas")
      .select("id, status, escola_id")
      .eq("escola_id", escolaId)
      .in("id", uniqueIds),
  ]);

  if (turmaError) {
    return NextResponse.json({ ok: false, error: turmaError.message }, { status: 500 });
  }

  if (!turma) {
    return NextResponse.json({ ok: false, error: "Turma oficial não encontrada" }, { status: 404 });
  }

  if (candidaturasError) {
    return NextResponse.json({ ok: false, error: candidaturasError.message }, { status: 500 });
  }

  const candidaturaRows = candidaturas ?? [];
  const foundIds = new Set(candidaturaRows.map((item) => item.id));
  const invalidIds = uniqueIds.filter((id) => !foundIds.has(id));
  const notPreCandidatura = candidaturaRows.filter((item) => item.status !== "pre_candidatura");

  if (invalidIds.length > 0 || notPreCandidatura.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "O lote contém candidaturas inválidas ou que já não são pré-candidaturas.",
        invalid_ids: invalidIds,
        not_pre_candidatura_ids: notPreCandidatura.map((item) => item.id),
      },
      { status: 400 }
    );
  }

  const capacidadeMaxima = Number(turma.capacidade_maxima ?? 0);
  const ocupacaoAtual = Number(turma.ocupacao_atual ?? 0);
  const hasFiniteCapacity = Number.isFinite(capacidadeMaxima) && capacidadeMaxima > 0;
  const vagasDisponiveis = hasFiniteCapacity ? Math.max(0, capacidadeMaxima - ocupacaoAtual) : uniqueIds.length;

  if (hasFiniteCapacity && uniqueIds.length > vagasDisponiveis) {
    return NextResponse.json(
      {
        ok: false,
        error: "A turma não tem vagas suficientes para este lote.",
        code: "CAPACIDADE_INSUFICIENTE",
        requested: uniqueIds.length,
        vagas_disponiveis: vagasDisponiveis,
      },
      { status: 409 }
    );
  }

  const promoted: string[] = [];
  const failures: PromotionFailure[] = [];

  for (const candidaturaId of uniqueIds) {
    const { data, error } = await (supabase as any).rpc("admissao_promover_pre_candidatura", {
      p_escola_id: escolaId,
      p_candidatura_id: candidaturaId,
      p_turma_id: turma_id,
      p_observacao: observacao ?? null,
      p_idempotency_key: `${idempotencyKey}:${candidaturaId}`,
      p_actor_user_id: user.id,
    });

    if (error) {
      failures.push({ candidatura_id: candidaturaId, error: error.message });
    } else if (data?.ok !== false) {
      promoted.push(candidaturaId);
    } else {
      failures.push({ candidatura_id: candidaturaId, error: data?.error || "Falha desconhecida" });
    }
  }

  recordAuditServer({
    escolaId,
    portal: "secretaria",
    acao: "PRE_CANDIDATURAS_PROMOVIDAS_LOTE",
    entity: "candidaturas",
    entityId: turma_id,
    details: {
      turma_id,
      total: uniqueIds.length,
      promoted_count: promoted.length,
      failed_count: failures.length,
      idempotency_key: idempotencyKey,
    },
  }).catch(() => null);

  return NextResponse.json({
    ok: failures.length === 0,
    promoted,
    failures,
    summary: {
      requested: uniqueIds.length,
      promoted: promoted.length,
      failed: failures.length,
      turma_id,
      turma_nome: turma.turma_nome,
    },
  });
}

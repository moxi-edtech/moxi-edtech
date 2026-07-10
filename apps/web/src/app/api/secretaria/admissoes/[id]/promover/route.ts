import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { recordAuditServer } from "@/lib/audit";
import { K12_SECRETARIA_OPERACIONAL_ROLE_GROUP } from "@/lib/roles";

const payloadSchema = z.object({
  turma_id: z.string().uuid(),
  observacao: z.string().trim().max(500).optional().nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const idempotencyKey = request.headers.get("Idempotency-Key") ?? request.headers.get("idempotency-key");

  if (!idempotencyKey) {
    return NextResponse.json({ ok: false, error: "Idempotency-Key obrigatório" }, { status: 400 });
  }

  const { id: candidaturaId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.format() }, { status: 400 });
  }

  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const { data: candidatura, error: candidaturaError } = await supabase
    .from("candidaturas")
    .select("id, escola_id, status")
    .eq("id", candidaturaId)
    .maybeSingle();

  if (candidaturaError) {
    return NextResponse.json({ ok: false, error: candidaturaError.message }, { status: 500 });
  }

  if (!candidatura) {
    return NextResponse.json({ ok: false, error: "Candidatura não encontrada" }, { status: 404 });
  }

  const escolaId = await resolveEscolaIdForUser(supabase, user.id, candidatura.escola_id);
  if (!escolaId || escolaId !== candidatura.escola_id) {
    return NextResponse.json({ ok: false, error: "Sem vínculo com a escola" }, { status: 403 });
  }

  const { error: authError } = await requireRoleInSchool({
    supabase,
    escolaId,
    roles: [...K12_SECRETARIA_OPERACIONAL_ROLE_GROUP],
  });
  if (authError) return authError;

  if (candidatura.status !== "pre_candidatura") {
    return NextResponse.json(
      { ok: false, error: "Apenas pré-candidaturas podem ser promovidas." },
      { status: 400 }
    );
  }

  const { data, error } = await (supabase as any).rpc("admissao_promover_pre_candidatura", {
    p_escola_id: escolaId,
    p_candidatura_id: candidaturaId,
    p_turma_id: parsed.data.turma_id,
    p_observacao: parsed.data.observacao ?? null,
    p_idempotency_key: idempotencyKey,
    p_actor_user_id: user.id,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  recordAuditServer({
    escolaId,
    portal: "secretaria",
    acao: "PRE_CANDIDATURA_PROMOVIDA",
    entity: "candidaturas",
    entityId: candidaturaId,
    details: {
      turma_id: parsed.data.turma_id,
      idempotency_key: idempotencyKey,
      result: data,
    },
  }).catch(() => null);

  return NextResponse.json(data ?? { ok: true });
}

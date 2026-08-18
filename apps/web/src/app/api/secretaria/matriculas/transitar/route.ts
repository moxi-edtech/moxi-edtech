import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { K12_SECRETARIA_OPERACIONAL_ROLE_GROUP } from "@/lib/roles";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  turma_origem_id: z.string().uuid(),
  turma_destino_id: z.string().uuid(),
  ano_letivo_origem: z.number().int(),
  ano_letivo_destino: z.number().int(),
  aluno_ids: z.array(z.string().uuid()).min(1),
});

const ALLOWED_ROLES = K12_SECRETARIA_OPERACIONAL_ROLE_GROUP;

export async function POST(request: Request) {
  const idempotencyKey = request.headers.get("Idempotency-Key") ?? request.headers.get("idempotency-key");
  if (!idempotencyKey?.trim()) {
    return NextResponse.json({ ok: false, error: "Idempotency-Key header é obrigatório" }, { status: 400 });
  }

  let escolaIdForIdempotency: string | null = null;
  let idempotencyClaimed = false;
  try {
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues?.[0]?.message || "Payload inválido" },
        { status: 400 }
      );
    }

    const supabase = await supabaseServerTyped<any>();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const { data: turmaOrigem, error: turmaError } = await supabase
      .from("turmas")
      .select("escola_id")
      .eq("id", parsed.data.turma_origem_id)
      .single();

    if (turmaError || !turmaOrigem?.escola_id) {
      return NextResponse.json({ ok: false, error: "Turma de origem não encontrada." }, { status: 404 });
    }

    const escolaId = turmaOrigem.escola_id as string;
    escolaIdForIdempotency = escolaId;
    const resolvedEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, escolaId);
    if (!resolvedEscolaId || resolvedEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 403 });
    }

    const { error: authError } = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: [...ALLOWED_ROLES],
    });
    if (authError) return authError;

    const { data: existingIdempotency } = await supabase
      .from("idempotency_keys")
      .select("result")
      .eq("escola_id", escolaId)
      .eq("scope", "secretaria_matriculas_transitar")
      .eq("key", idempotencyKey.trim())
      .maybeSingle();
    if (existingIdempotency) {
      if (existingIdempotency.result) return NextResponse.json(existingIdempotency.result, { status: 200 });
      return NextResponse.json({ ok: false, error: "Uma transição idêntica está em andamento." }, { status: 409 });
    }

    const { error: claimError } = await supabase.from("idempotency_keys").insert({
      escola_id: escolaId,
      scope: "secretaria_matriculas_transitar",
      key: idempotencyKey.trim(),
      result: null,
    });
    if (claimError) {
      const { data: retryCheck } = await supabase
        .from("idempotency_keys")
        .select("result")
        .eq("escola_id", escolaId)
        .eq("scope", "secretaria_matriculas_transitar")
        .eq("key", idempotencyKey.trim())
        .maybeSingle();
      if (retryCheck?.result) return NextResponse.json(retryCheck.result, { status: 200 });
      return NextResponse.json({ ok: false, error: "Uma transição idêntica está em andamento." }, { status: 409 });
    }
    idempotencyClaimed = true;

    const { data: result, error: rpcError } = await supabase.rpc("fn_transitar_alunos", {
      p_escola_id: escolaId,
      p_turma_origem_id: parsed.data.turma_origem_id,
      p_turma_destino_id: parsed.data.turma_destino_id,
      p_ano_letivo_origem: parsed.data.ano_letivo_origem,
      p_ano_letivo_dest: parsed.data.ano_letivo_destino,
      p_aluno_ids: parsed.data.aluno_ids,
    });

    if (rpcError) {
      await supabase.from("idempotency_keys")
        .delete()
        .eq("escola_id", escolaId)
        .eq("scope", "secretaria_matriculas_transitar")
        .eq("key", idempotencyKey.trim());
      return NextResponse.json({ ok: false, error: rpcError.message }, { status: 400 });
    }

    const rows = Array.isArray(result) ? result : [];
    const sucesso = rows.filter((row: any) => row?.sucesso === true).length;
    const falhas = rows.length - sucesso;

    const responsePayload = {
      ok: true,
      total: rows.length,
      sucesso,
      falhas,
      resultados: rows,
    };
    await supabase.from("idempotency_keys").upsert({
      escola_id: escolaId,
      scope: "secretaria_matriculas_transitar",
      key: idempotencyKey.trim(),
      result: responsePayload,
    }, { onConflict: "escola_id,scope,key" });
    return NextResponse.json(responsePayload);
  } catch (e) {
    if (idempotencyClaimed && escolaIdForIdempotency) {
      const supabase = await supabaseServerTyped<any>();
      await supabase.from("idempotency_keys")
        .delete()
        .eq("escola_id", escolaIdForIdempotency)
        .eq("scope", "secretaria_matriculas_transitar")
        .eq("key", idempotencyKey?.trim() ?? "");
    }
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

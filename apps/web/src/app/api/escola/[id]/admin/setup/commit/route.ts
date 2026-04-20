import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import { assertEscolaAccessAndPermissions } from "@/lib/api/assertEscolaAccessAndPermissions";
import { PAPEL_GROUP_ESCOLA_ADMIN_SETUP } from "@/lib/permissions";
import type { Database } from "~types/supabase";

type CommitResponse = {
  ok: boolean;
  error?: string;
};

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const start = Date.now();
  const { id: escolaId } = await context.params;
  const respond = (body: Record<string, unknown>, status: number) => {
    const response = NextResponse.json(body, { status });
    response.headers.set("Server-Timing", `app;dur=${Date.now() - start}`);
    return response;
  };
  try {
    const body = await req.json().catch(() => ({}));
    const { ano, ano_letivo_id: anoLetivoIdInput, changes } = body ?? {};
    const supabase = await createRouteClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return respond({ ok: false, error: "Não autenticado" }, 401);

    const idempotencyKey = req.headers.get("Idempotency-Key");
    if (!idempotencyKey) {
      return respond({ ok: false, error: "Idempotency-Key obrigatório" }, 400);
    }

    const access = await assertEscolaAccessAndPermissions({
      client: supabase as any,
      userId: user.id,
      requestedEscolaId: escolaId,
      allowedPapels: PAPEL_GROUP_ESCOLA_ADMIN_SETUP,
      route: '/api/escola/[id]/admin/setup/commit',
    });
    if (!access.ok) {
      return respond({ ok: false, error: access.error, code: access.code }, access.status);
    }
    const userEscolaId = access.escolaId;

    const anoValue = typeof ano === "number" ? ano : typeof ano === "string" ? Number(ano) : null;
    const resolvedAnoValue = Number.isFinite(anoValue ?? NaN) ? anoValue : null;
    let anoLetivoId = typeof anoLetivoIdInput === "string" ? anoLetivoIdInput : null;
    if (!anoLetivoId) {
      const { data: anoRow } = resolvedAnoValue
        ? await supabase
            .from("anos_letivos")
            .select("id, ano")
            .eq("escola_id", userEscolaId)
            .eq("ano", resolvedAnoValue)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : await supabase
            .from("anos_letivos")
            .select("id, ano")
            .eq("escola_id", userEscolaId)
            .eq("ativo", true)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
      anoLetivoId = anoRow?.id ?? null;
    }

    if (!anoLetivoId) {
      return respond({ ok: false, error: "Ano letivo ativo não encontrado" }, 400);
    }
    const { data, error } = await supabase.rpc(
      "config_commit",
      {
        p_escola_id: userEscolaId,
        p_ano_letivo_id: anoLetivoId,
        p_changes: changes ?? {},
        p_idempotency_key: idempotencyKey,
        p_user_id: user.id,
      } as unknown as Database["public"]["Functions"]["config_commit"]["Args"]
    );

    if (error) {
      return respond({ ok: false, error: error.message }, 500);
    }

    const payload = data as unknown as CommitResponse | null;
    if (payload?.ok === false) {
      return respond(
        {
          ok: false,
          error: payload.error ?? "Erro de validação",
          data,
        },
        422
      );
    }

    return respond({ ok: true, data, idempotency_key: idempotencyKey }, 200);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return respond({ ok: false, error: msg }, 500);
  }
}

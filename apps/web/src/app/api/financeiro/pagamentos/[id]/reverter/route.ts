import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const payloadSchema = z.object({
  motivo: z.string().trim().min(5, "Informe um motivo com pelo menos 5 caracteres."),
});

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

function cleanRpcMessage(message: string) {
  return message.replace(/^(DATA|AUTH|STATE|PARA):\s*/, "");
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const idempotencyKey =
      req.headers.get("Idempotency-Key") ?? req.headers.get("idempotency-key");
    if (!idempotencyKey) {
      return NextResponse.json(
        { ok: false, error: "Idempotency-Key header é obrigatório" },
        { status: 400 }
      );
    }

    const { id: pagamentoId } = await context.params;
    const parsedParams = z.string().uuid().safeParse(pagamentoId);
    if (!parsedParams.success) {
      return NextResponse.json({ ok: false, error: "Pagamento inválido" }, { status: 400 });
    }

    const parsedBody = payloadSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsedBody.success) {
      return NextResponse.json(
        { ok: false, error: parsedBody.error.issues?.[0]?.message || "Payload inválido" },
        { status: 400 }
      );
    }

    const supabase = await supabaseServerTyped<any>();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const { error: roleError } = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: ["secretaria", "financeiro", "admin_financeiro", "secretaria_financeiro", "admin_escola", "admin", "staff_admin"],
    });
    if (roleError) return roleError;

    const { data: pagamento, error: pagamentoError } = await supabase
      .from("pagamentos")
      .select("id, escola_id, status, meta")
      .eq("id", parsedParams.data)
      .eq("escola_id", escolaId)
      .maybeSingle();

    if (pagamentoError) {
      return NextResponse.json({ ok: false, error: pagamentoError.message }, { status: 400 });
    }
    if (!pagamento) {
      return NextResponse.json({ ok: false, error: "Pagamento não encontrado" }, { status: 404 });
    }

    const reversalMeta = (pagamento.meta as { reversao?: { idempotency_key?: string } } | null)?.reversao;
    if ((pagamento.status === "voided" || pagamento.status === "estornado") && reversalMeta?.idempotency_key === idempotencyKey) {
      return NextResponse.json({ ok: true, idempotent: true, data: pagamento });
    }

    const { data, error } = await supabase.rpc("reverter_pagamento_realizado", {
      p_pagamento_id: parsedParams.data,
      p_motivo: parsedBody.data.motivo,
      p_idempotency_key: idempotencyKey,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: cleanRpcMessage(error.message) }, { status: 400 });
    }

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { dispatchFinanceiroNotificacao } from "@/lib/notificacoes/dispatchFinanceiroNotificacao";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const payloadSchema = z.object({
  escolaId: z.string().min(1).optional(),
  fecho_id: z.string().uuid(),
  aprovacao: z.enum(["approved", "rejected"]),
  justificativa: z.string().trim().min(1).max(255).optional(),
  meta: z.record(z.any()).optional(),
});

export async function POST(request: Request) {
  try {
    const idempotencyKey =
      request.headers.get("Idempotency-Key") ?? request.headers.get("idempotency-key");
    if (!idempotencyKey) {
      return NextResponse.json(
        { ok: false, error: "Idempotency-Key header é obrigatório" },
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

    const body = await request.json().catch(() => null);
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Dados de aprovação inválidos" }, { status: 400 });
    const escolaId = await resolveEscolaIdForUser(supabase, user.id, parsed.data.escolaId);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });
    }

    const {data: memberships,error: membershipError}=await supabase.from("escola_users").select("papel").eq("escola_id",escolaId).eq("user_id",user.id).eq("tenant_type","k12").in("papel",["financeiro","admin_financeiro","admin","admin_escola","staff_admin","diretor"]).limit(1);
    if(membershipError||!memberships?.length)return NextResponse.json({ok:false,error:"Sem permissão para decidir o fecho."},{status:403});
    const actorRole=memberships[0].papel;

    const { data: existing } = await supabase
      .from("fecho_caixa")
      .select("id, status, escola_id, day_key, approved_by, approved_at, declared_cash, declared_tpa, declared_transfer, declared_mcx, system_cash, system_tpa, system_transfer, system_mcx")
      .eq("escola_id", escolaId)
      .eq("id", parsed.data.fecho_id)
      .maybeSingle();

    const { data, error } = await supabase.rpc("financeiro_fecho_aprovar", {
      p_escola_id: escolaId,
      p_fecho_id: parsed.data.fecho_id,
      p_aprovacao: parsed.data.aprovacao,
      p_justificativa: parsed.data.justificativa ?? null,
      p_aprovacao_meta: parsed.data.meta ?? {},
    });

    if (error) {
      return NextResponse.json({ ok: false, error: "Não foi possível decidir o fecho." }, { status: error.code === "42501" ? 403 : error.code === "22023" ? 400 : 409 });
    }

    if (parsed.data.aprovacao === "approved" && existing?.status !== "approved") {
      const { data: escolaRow } = await supabase
        .from("escolas")
        .select("slug")
        .eq("id", escolaId)
        .maybeSingle();
      const escolaParam = escolaRow?.slug ? String(escolaRow.slug) : escolaId;

      await dispatchFinanceiroNotificacao({
        escolaId,
        key: "FECHO_AUTORIZADO",
        params: { actionUrl: `/escola/${escolaParam}/financeiro/fecho` },
        actorId: user.id,
        actorRole: actorRole ?? "admin",
        agrupamentoTTLHoras: 12,
      }).catch(() => null);
    }

    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

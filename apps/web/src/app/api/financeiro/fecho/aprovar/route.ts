import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const payloadSchema = z.object({
  escolaId: z.string().min(1).optional(),
  fecho_id: z.string().uuid(),
  aprovacao: z.enum(["approved", "rejected"]),
  justificativa: z.string().trim().min(1).max(255).optional(),
  meta: z.object({ expected_revision: z.number().int().positive() }).optional(),
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
    const { data, error } = await supabase.rpc("financeiro_fecho_aprovar", {
      p_escola_id: escolaId,
      p_fecho_id: parsed.data.fecho_id,
      p_aprovacao: parsed.data.aprovacao,
      p_justificativa: parsed.data.justificativa ?? null,
      p_aprovacao_meta: parsed.data.meta ?? {},
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message.includes("stale_revision") ? "Esta versão já foi substituída. Atualize a página." : error.message.includes("variance_requires_justification") ? "Existem divergências ou movimentos posteriores à declaração. Informe uma justificação." : "Não foi possível decidir o fecho." }, { status: error.code === "42501" ? 403 : error.code === "22023" ? 400 : 409 });
    }


    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

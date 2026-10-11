import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRoleInSchool } from "@/lib/authz";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const requestSchema = z.object({ mensalidade_id: z.string().uuid() });

/**
 * Explicit staff action to retrieve/recover an operational receipt.
 * NEVER registers another payment; receipt issuance remains authorized
 * and idempotent inside the existing emitir_recibo RPC.
 */
export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Mensalidade inválida." }, { status: 400 });
  }

  const supabase = await supabaseServerTyped<Database>();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });

  const escolaId = await resolveEscolaIdForUser(supabase, user.id);
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada." }, { status: 403 });

  const authz = await requireRoleInSchool({
    supabase,
    escolaId,
    roles: ["secretaria", "secretaria_financeiro", "financeiro", "admin_financeiro", "admin", "admin_escola", "staff_admin"],
  });
  if (authz.error) return authz.error;

  const { data: mensalidade, error: mensalidadeError } = await supabase
    .from("mensalidades")
    .select("id, aluno_id, status")
    .eq("id", parsed.data.mensalidade_id)
    .eq("escola_id", escolaId)
    .maybeSingle();
  if (mensalidadeError || !mensalidade) {
    return NextResponse.json({ ok: false, error: "Mensalidade não encontrada." }, { status: 404 });
  }
  if (mensalidade.status !== "pago") {
    return NextResponse.json({ ok: false, error: "O recibo só pode ser recuperado após a liquidação integral." }, { status: 409 });
  }

  const { data: settledPayment, error: paymentError } = await supabase
    .from("pagamentos")
    .select("id")
    .eq("escola_id", escolaId)
    .eq("mensalidade_id", mensalidade.id)
    .eq("status", "settled")
    .limit(1)
    .maybeSingle();
  if (paymentError || !settledPayment) {
    return NextResponse.json({ ok: false, error: "Nenhum pagamento liquidado encontrado." }, { status: 409 });
  }

  const { data, error } = await supabase.rpc("emitir_recibo", {
    p_mensalidade_id: mensalidade.id,
  });
  if (error) {
    console.error("[RECIBO-RECUPERAR][RPC]", { code: error.code ?? null, escolaId });
    return NextResponse.json({ ok: false, error: "Falha ao recuperar recibo." }, { status: 502 });
  }

  const result = data && typeof data === "object" && !Array.isArray(data)
    ? data as Record<string, unknown>
    : {};
  if (result.ok !== true || typeof result.doc_id !== "string") {
    return NextResponse.json({
      ok: false,
      error: typeof result.erro === "string" ? result.erro : "Recibo não disponível.",
    }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    doc_id: result.doc_id,
    print_url: `/secretaria/documentos/${encodeURIComponent(result.doc_id)}/recibo/print`,
  });
}

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { K12_FINANCEIRO_OPERACIONAL_ROLE_GROUP } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const paramsSchema = z.object({
  mensalidade_id: z.string().uuid(),
});

/** Read-only recovery of a receipt already emitted in documentos_emitidos.
 * Never calls emit_*, does not create a new charge, and cannot access fiscal docs.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = paramsSchema.safeParse({ mensalidade_id: params.get("mensalidade_id") });
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Mensalidade inválida." }, { status: 400 });

  const db = await supabaseServerTyped<any>();
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (!user || authError) return NextResponse.json({ ok: false, error: "Sessão expirada." }, { status: 401 });
  const escolaId = await resolveEscolaIdForUser(db, user.id);
  if (!escolaId) return NextResponse.json({ ok: false, error: "Sem permissão." }, { status: 403 });
  const authorization = await requireRoleInSchool({
    supabase: db, escolaId, roles: [...K12_FINANCEIRO_OPERACIONAL_ROLE_GROUP],
  });
  if (authorization.error) return authorization.error;

  const { data: monthly, error: monthlyError } = await db.from("mensalidades")
    .select("id,aluno_id,escola_id,status,valor_pago_total")
    .eq("escola_id", escolaId).eq("id", parsed.data.mensalidade_id).maybeSingle();
  if (monthlyError) return NextResponse.json({ ok: false, error: "Falha ao validar mensalidade." }, { status: 500 });
  if (!monthly) return NextResponse.json({ ok: false, error: "Mensalidade não encontrada nesta escola." }, { status: 404 });

  const { data: document, error: documentError } = await db.from("documentos_emitidos")
    .select("id").eq("escola_id", escolaId).eq("aluno_id", monthly.aluno_id)
    .eq("mensalidade_id", monthly.id).eq("tipo", "recibo")
    .is("revoked_at", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (documentError) {
    console.warn("[OPERATIONAL-RECEIPT-LOOKUP]", { code: documentError.code ?? null });
    return NextResponse.json({ ok: false, error: "Falha ao consultar documento." }, { status: 500 });
  }

  if (document) {
    return NextResponse.json({
      ok: true, status: "ready", doc_id: document.id,
      print_url: "/secretaria/documentos/" + encodeURIComponent(document.id) + "/recibo/print",
    }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  }
  // The transaction may have committed before the outbox worker issues the
  // document. Returning pending is NOT proof of payment nor permission to retry.
  return NextResponse.json({
    ok: true, status: "pending", doc_id: null, print_url: null,
    message: "O recibo operacional ainda está em preparação. Não repita o pagamento.",
  }, {
    status: 202,
    headers: { "Cache-Control": "private, no-store, max-age=0", "Retry-After": "2" },
  });
}

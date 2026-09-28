import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireApiTenantGuard } from "@/lib/api/requireApiTenantGuard";
import { recordAuditServer } from "@/lib/audit";
import { HttpError } from "@/lib/errors";
import { requireFeature } from "@/lib/plan/requireFeature";
import { requireFinanceChargeMessages } from "@/lib/school-profile/guards";
import { resolveSchoolOperatingProfile } from "@/lib/school-profile/resolve-school-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PayloadSchema = z.object({
  mensalidadeId: z.string().uuid(),
});

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: message, code }, { status });
}

export async function POST(req: NextRequest) {
  const parsed = PayloadSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return jsonError(
      400,
      "INVALID_PAYLOAD",
      parsed.error.issues?.[0]?.message ?? "Payload inválido."
    );
  }

  const guard = await requireApiTenantGuard({
    productContext: "k12",
    requireTenantType: "k12",
    allowedRoles: [
      "secretaria",
      "financeiro",
      "secretaria_financeiro",
      "admin_financeiro",
      "admin",
      "admin_escola",
      "staff_admin",
      "super_admin",
      "global_admin",
    ],
  });
  if (!guard.ok) return guard.response;

  try {
    await requireFeature("fin_recibo_pdf");
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonError(error.status, error.code, error.message);
    }
    throw error;
  }

  const supabase = guard.supabase as any;
  const escolaId = guard.tenantId;
  const user = guard.user;
  const mensalidadeId = parsed.data.mensalidadeId;

  const financeGuard = requireFinanceChargeMessages(
    await resolveSchoolOperatingProfile(supabase, escolaId)
  );
  if (!financeGuard.ok) {
    return NextResponse.json(financeGuard, { status: 409 });
  }

  const { data: mensalidade, error: mensalidadeError } = await supabase
    .from("mensalidades")
    .select("id,escola_id,aluno_id")
    .eq("id", mensalidadeId)
    .eq("escola_id", escolaId)
    .maybeSingle();

  if (mensalidadeError) {
    return jsonError(500, "TUITION_LOOKUP_FAILED", mensalidadeError.message);
  }
  if (!mensalidade) {
    return jsonError(404, "TUITION_NOT_FOUND", "Mensalidade não encontrada.");
  }

  const { data: pagamento, error: paymentError } = await supabase
    .from("pagamentos")
    .select("id,status,valor_pago,settled_at,created_at")
    .eq("escola_id", escolaId)
    .eq("mensalidade_id", mensalidadeId)
    .in("status", ["settled", "concluido", "pago"])
    .order("settled_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (paymentError) {
    return jsonError(500, "PAYMENT_LOOKUP_FAILED", paymentError.message);
  }
  if (!pagamento?.id) {
    return jsonError(
      404,
      "SETTLED_PAYMENT_NOT_FOUND",
      "Nenhum pagamento liquidado foi encontrado para esta mensalidade."
    );
  }

  recordAuditServer({
    escolaId,
    portal: "financeiro",
    acao: "RECIBO_OPERACIONAL_EMITIDO",
    entity: "pagamentos",
    entityId: pagamento.id,
    details: {
      mensalidade_id: mensalidadeId,
      aluno_id: mensalidade.aluno_id ?? null,
      valor_pago: Number(pagamento.valor_pago ?? 0),
      non_fiscal: true,
      requested_by: user.id,
    },
  }).catch(() => null);

  return NextResponse.json({
    ok: true,
    doc_id: pagamento.id,
    pagamento_id: pagamento.id,
    url_validacao: null,
    print_url: `/secretaria/pagamentos/${pagamento.id}/recibo/print`,
    non_fiscal: true,
    fiscal: {
      enabled: false,
      skipped: true,
    },
  });
}

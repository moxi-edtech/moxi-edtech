import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { recordAuditServer } from "@/lib/audit";
import { provisionAgtSeries } from "@/lib/fiscal/agtSeries";
import { postFiscalSerieProvisionSchema } from "@/lib/schemas/fiscal-setup.schema";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database, Json } from "~types/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_ROLES = ["owner", "admin", "operator"] as const;

function jsonError(status: number, code: string, message: string, details?: Record<string, unknown>) {
  return NextResponse.json(
    { ok: false, error: { code, message, details: details ?? null } },
    { status }
  );
}

function getAdminClient() {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const idempotencyKey = req.headers.get("Idempotency-Key")?.trim() ?? "";

  if (!idempotencyKey) {
    return jsonError(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key é obrigatório.");
  }

  const parsed = postFiscalSerieProvisionSchema.safeParse(
    await req.json().catch(() => null)
  );
  if (!parsed.success) {
    return jsonError(400, "INVALID_PAYLOAD", "Pedido de série AGT inválido.", {
      field_errors: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const supabase = await supabaseRouteClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonError(401, "UNAUTHENTICATED", "Utilizador não autenticado.");
    }

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    const { data: membership, error: membershipError } = await supabase
      .from("fiscal_empresa_users")
      .select("role")
      .eq("empresa_id", parsed.data.empresa_id)
      .eq("user_id", user.id)
      .in("role", [...ALLOWED_ROLES])
      .maybeSingle();

    if (membershipError) {
      return jsonError(500, "FISCAL_SERIES_AUTH_FAILED", membershipError.message);
    }
    if (!membership) {
      return jsonError(403, "FORBIDDEN", "Sem permissão para provisionar série fiscal.");
    }

    const [{ data: empresa, error: empresaError }, { data: keyRow, error: keyError }] =
      await Promise.all([
        supabase
          .from("fiscal_empresas")
          .select("id,nif,certificado_agt_numero")
          .eq("id", parsed.data.empresa_id)
          .maybeSingle(),
        supabase
          .from("fiscal_chaves")
          .select("key_version,private_key_ref")
          .eq("empresa_id", parsed.data.empresa_id)
          .eq("status", "active")
          .order("key_version", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    if (empresaError || !empresa) {
      return jsonError(404, "FISCAL_EMPRESA_NOT_FOUND", empresaError?.message ?? "Empresa fiscal não encontrada.");
    }
    if (keyError || !keyRow?.private_key_ref) {
      return jsonError(
        409,
        "FISCAL_TAXPAYER_KEY_REQUIRED",
        keyError?.message ?? "Chave privada fiscal activa não configurada em KMS."
      );
    }

    const admin = getAdminClient() as any;
    const { data: existing } = await admin
      .from("fiscal_series_requests")
      .select("id,status,fiscal_serie_id,response_payload,error_payload,submission_uuid")
      .eq("empresa_id", parsed.data.empresa_id)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existing) {
      if (existing.status === "provisioned" && existing.fiscal_serie_id) {
        const { data: serie } = await admin
          .from("fiscal_series")
          .select("*")
          .eq("id", existing.fiscal_serie_id)
          .maybeSingle();
        return NextResponse.json(
          { ok: true, data: serie, idempotent: true, request_id: requestId },
          { status: 200 }
        );
      }

      return jsonError(
        409,
        "AGT_SERIES_REQUEST_ALREADY_EXISTS",
        "Já existe um pedido com esta Idempotency-Key. Não será reenviado automaticamente.",
        {
          status: existing.status,
          submission_uuid: existing.submission_uuid,
          request_id: requestId,
        }
      );
    }

    const submissionUuid = crypto.randomUUID();
    const requestRow = {
      empresa_id: parsed.data.empresa_id,
      requested_by: user.id,
      idempotency_key: idempotencyKey,
      submission_uuid: submissionUuid,
      document_type: parsed.data.tipo_documento,
      series_year: parsed.data.series_year,
      establishment_number: parsed.data.establishment_number,
      contingency_indicator: parsed.data.series_contingency_indicator,
      status: "processing",
    };

    const { data: createdRequest, error: requestError } = await admin
      .from("fiscal_series_requests")
      .insert(requestRow)
      .select("id")
      .single();

    if (requestError || !createdRequest) {
      return jsonError(
        requestError?.code === "23505" ? 409 : 500,
        "AGT_SERIES_REQUEST_CREATE_FAILED",
        requestError?.message ?? "Falha ao registar pedido de série."
      );
    }

    try {
      const agt = await provisionAgtSeries({
        submissionUuid,
        taxRegistrationNumber: empresa.nif,
        documentType: parsed.data.tipo_documento,
        seriesYear: parsed.data.series_year,
        establishmentNumber: parsed.data.establishment_number,
        contingencyIndicator: parsed.data.series_contingency_indicator,
        taxpayerPrivateKeyRef: keyRow.private_key_ref,
        expectedSoftwareValidationNumber: empresa.certificado_agt_numero,
      });

      const firstNo = Number(agt.firstDocumentNo);
      if (!Number.isSafeInteger(firstNo) || firstNo < 1) {
        throw new Error("AGT_SERIES_INVALID_FIRST_DOCUMENT_NO");
      }

      const now = new Date().toISOString();
      const { data: serie, error: serieError } = await admin
        .from("fiscal_series")
        .insert({
          empresa_id: parsed.data.empresa_id,
          tipo_documento: parsed.data.tipo_documento,
          prefixo: agt.seriesCode,
          origem_documento:
            parsed.data.series_contingency_indicator === "C"
              ? "contingencia"
              : "integrado",
          ultimo_numero: firstNo - 1,
          ativa: true,
          metadata: {
            provision_source: "AGT_FE_API",
            request_id: requestId,
            key_version: keyRow.key_version,
          } as Json,
          agt_series_code: agt.seriesCode,
          agt_submission_uuid: submissionUuid,
          agt_status: "provisioned",
          series_year: parsed.data.series_year,
          establishment_number: parsed.data.establishment_number,
          series_contingency_indicator: parsed.data.series_contingency_indicator,
          authorized_quantity: agt.authorizedQuantity,
          first_document_no: agt.firstDocumentNo,
          last_document_no: agt.lastDocumentNo,
          agt_provisioned_at: now,
        })
        .select("*")
        .single();

      if (serieError || !serie) {
        await admin
          .from("fiscal_series_requests")
          .update({
            status: "uncertain",
            response_payload: agt.raw as Json,
            error_payload: {
              code: "LOCAL_SERIES_PERSIST_FAILED",
              message: serieError?.message ?? "AGT aprovou a série, mas o KLASSE não a persistiu.",
            } as Json,
            updated_at: now,
          })
          .eq("id", createdRequest.id);

        return jsonError(
          500,
          "LOCAL_SERIES_PERSIST_FAILED",
          "A AGT respondeu com sucesso, mas o registo local falhou. O pedido foi marcado como uncertain para reconciliação manual.",
          { submission_uuid: submissionUuid }
        );
      }

      await admin
        .from("fiscal_series_requests")
        .update({
          status: "provisioned",
          fiscal_serie_id: serie.id,
          response_payload: agt.raw as Json,
          error_payload: null,
          updated_at: now,
        })
        .eq("id", createdRequest.id);

      if (escolaId) {
        recordAuditServer({
          escolaId,
          portal: "financeiro",
          acao: "FISCAL_SERIE_AGT_PROVISIONADA",
          entity: "fiscal_series",
          entityId: serie.id,
          details: {
            request_id: requestId,
            empresa_id: parsed.data.empresa_id,
            submission_uuid: submissionUuid,
            agt_series_code: agt.seriesCode,
            document_type: parsed.data.tipo_documento,
          },
        }).catch(() => null);
      }

      return NextResponse.json(
        { ok: true, data: serie, request_id: requestId },
        { status: 201 }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida ao solicitar série AGT.";
      const rejected = message.startsWith("AGT_SERIES_REJECTED:");
      const status = rejected ? "rejected" : "uncertain";

      await admin
        .from("fiscal_series_requests")
        .update({
          status,
          error_payload: { message } as Json,
          updated_at: new Date().toISOString(),
        })
        .eq("id", createdRequest.id);

      return jsonError(
        rejected ? 422 : 502,
        rejected ? "AGT_SERIES_REJECTED" : "AGT_SERIES_OUTCOME_UNCERTAIN",
        rejected
          ? message
          : "Não foi possível confirmar o resultado na AGT. O pedido não será reenviado automaticamente para evitar duplicação.",
        { submission_uuid: submissionUuid, request_id: requestId }
      );
    }
  } catch (error) {
    return jsonError(
      500,
      "AGT_SERIES_PROVISION_INTERNAL_ERROR",
      error instanceof Error ? error.message : "Erro interno ao provisionar série AGT.",
      { request_id: requestId }
    );
  }
}

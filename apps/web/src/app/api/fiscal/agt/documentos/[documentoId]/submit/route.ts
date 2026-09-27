import { NextResponse } from "next/server";

import { queueAgtDocumentSubmission } from "@/lib/fiscal/agtSubmissionQueue";
import { requireFiscalAccessByCompanyOrSchool } from "@/lib/server/fiscalAccess";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

async function authorizeDocument(documentoId: string) {
  const supabase = await supabaseRouteClient<Database>();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false as const, response: jsonError(401, "UNAUTHENTICATED", "Utilizador não autenticado.") };
  }
  const { data: document, error } = await supabase
    .from("fiscal_documentos")
    .select("id,empresa_id,status,tipo_documento,numero_formatado")
    .eq("id", documentoId)
    .maybeSingle();
  if (error || !document) {
    return { ok: false as const, response: jsonError(404, "FISCAL_DOCUMENT_NOT_FOUND", "Documento fiscal não encontrado.") };
  }
  const escolaId = await resolveEscolaIdForUser(supabase, user.id);
  const access = await requireFiscalAccessByCompanyOrSchool({
    supabase,
    userId: user.id,
    empresaId: document.empresa_id,
    escolaId,
  });
  if (!access.ok) {
    return { ok: false as const, response: jsonError(access.status, access.code, access.message) };
  }
  return { ok: true as const, supabase, user, document };
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ documentoId: string }> }
) {
  const { documentoId } = await context.params;
  const auth = await authorizeDocument(documentoId);
  if (!auth.ok) return auth.response;
  const client = auth.supabase as any;
  const { data: link, error: linkError } = await client
    .from("fiscal_agt_submission_documentos")
    .select("submission_id,document_no,validation_status,error_list,validated_at")
    .eq("documento_id", documentoId)
    .maybeSingle();
  if (linkError) return jsonError(500, "AGT_STATUS_LOOKUP_FAILED", linkError.message);
  if (!link) {
    return NextResponse.json({ ok: true, data: { queued: false, document: auth.document } });
  }
  const { data: submission, error: submissionError } = await client
    .from("fiscal_agt_submissions")
    .select("id,submission_uuid,request_id,status,result_code,attempt_count,poll_count,error_code,error_message,submitted_at,completed_at,next_check_at,created_at,updated_at")
    .eq("id", link.submission_id)
    .single();
  if (submissionError) return jsonError(500, "AGT_STATUS_LOOKUP_FAILED", submissionError.message);
  return NextResponse.json({
    ok: true,
    data: { queued: true, document: auth.document, submission, validation: link },
  });
}

export async function POST(
  _req: Request,
  context: { params: Promise<{ documentoId: string }> }
) {
  const { documentoId } = await context.params;
  const auth = await authorizeDocument(documentoId);
  if (!auth.ok) return auth.response;
  if (auth.document.status !== "emitido") {
    return jsonError(409, "FISCAL_DOCUMENT_NOT_EMITIDO", "Somente documento emitido pode ser submetido à AGT.");
  }
  try {
    const submission = await queueAgtDocumentSubmission({
      documentoId,
      createdBy: auth.user.id,
    });
    return NextResponse.json({ ok: true, data: submission }, { status: 202 });
  } catch (error) {
    return jsonError(
      409,
      "AGT_SUBMISSION_QUEUE_FAILED",
      error instanceof Error ? error.message : "Falha ao enfileirar documento para a AGT."
    );
  }
}

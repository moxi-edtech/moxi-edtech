import "server-only";

import { inngest } from "@/inngest/client";
import { supabaseServerRole } from "@/lib/supabaseServerRole";

type PrepareResult = {
  ok?: boolean;
  idempotent?: boolean;
  submission_id?: string;
  submission_uuid?: string;
  request_id?: string | null;
  status?: string;
};

export async function queueAgtDocumentSubmission(input: {
  documentoId: string;
  createdBy?: string | null;
}) {
  const admin = supabaseServerRole() as any;
  const { data, error } = await admin.rpc("fiscal_agt_prepare_submission", {
    p_documento_id: input.documentoId,
    p_created_by: input.createdBy ?? null,
  });
  if (error) throw new Error(error.message);
  const prepared = data as PrepareResult;
  if (!prepared?.submission_id) {
    throw new Error("AGT_SUBMISSION_PREPARE_INCONSISTENT");
  }

  if (["accepted", "rejected", "cancelled", "mapping_error"].includes(prepared.status ?? "")) {
    return { ...prepared, queued: false, terminal: true };
  }

  try {
    await inngest.send({
      name: "fiscal/agt-submit.requested",
      data: { submission_id: prepared.submission_id },
    });
    return { ...prepared, queued: true, terminal: false };
  } catch (error) {
    await admin
      .from("fiscal_agt_submissions")
      .update({
        error_code: "AGT_QUEUE_DISPATCH_FAILED",
        error_message: error instanceof Error ? error.message : String(error),
        next_check_at: new Date().toISOString(),
      })
      .eq("id", prepared.submission_id);
    throw error;
  }
}

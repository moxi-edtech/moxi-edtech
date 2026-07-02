import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess";

export const dynamic = "force-dynamic";

const ReviewSchema = z.object({
  status: z.enum(["aprovado", "rejeitado"]),
  rejection_reason: z.string().trim().optional(),
});

async function requireSuperAdmin() {
  const supabase = await supabaseRouteClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user ?? null;
  if (!user) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }) };
  }

  const role = user.app_metadata?.role ?? user.user_metadata?.role ?? null;

  if (!isSuperAdminRole(typeof role === "string" ? role : null)) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 }) };
  }

  return { ok: true as const, supabase };
}

export async function POST(
  req: Request,
  context: { params: Promise<{ uploadId: string }> }
) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { uploadId } = await context.params;

    if (!uploadId) {
      return NextResponse.json({ ok: false, error: "ID de upload inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = ReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados inválidos: " + parsed.error.issues[0]?.message }, { status: 400 });
    }

    const { status, rejection_reason } = parsed.data;

    // Fetch the upload record to get onboarding_id and step_code
    const { data: upload, error: uploadError } = await (auth.supabase
      .from("onboarding_uploads" as any)
      .select("*")
      .eq("id", uploadId)
      .single() as any);

    if (uploadError || !upload) {
      return NextResponse.json({ ok: false, error: "Upload não encontrado" }, { status: 404 });
    }

    // Update upload status
    const { error: updateUploadError } = await auth.supabase
      .from("onboarding_uploads" as any)
      .update({
        status,
        rejection_reason: status === "rejeitado" ? rejection_reason : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", uploadId);

    if (updateUploadError) {
      return NextResponse.json({ ok: false, error: "Erro ao atualizar upload: " + updateUploadError.message }, { status: 400 });
    }

    // Find the respective onboarding step
    const { data: step, error: stepError } = await (auth.supabase
      .from("onboarding_steps" as any)
      .select("id, started_at")
      .eq("onboarding_id", upload.onboarding_id)
      .eq("step_code", upload.step_code)
      .single() as any);

    if (stepError || !step) {
      return NextResponse.json({ ok: false, error: "Etapa de onboarding correspondente não encontrada" }, { status: 404 });
    }

    const { data: stepUploads, error: stepUploadsError } = await (auth.supabase
      .from("onboarding_uploads" as any)
      .select("id, status, updated_at, created_at")
      .eq("onboarding_id", upload.onboarding_id)
      .eq("step_code", upload.step_code) as any);

    if (stepUploadsError) {
      return NextResponse.json({ ok: false, error: "Erro ao recalcular uploads da etapa: " + stepUploadsError.message }, { status: 400 });
    }

    const uploadsForStep = (stepUploads || []) as Array<{
      id: string;
      status:
        | "pendente"
        | "processando"
        | "em_revisao_parceiro"
        | "pendencia_cliente"
        | "pronto_para_klasse"
        | "aprovado"
        | "rejeitado";
      updated_at?: string | null;
      created_at?: string | null;
    }>;

    const approvedUploads = uploadsForStep.filter((item) => item.status === "aprovado");
    const activeUploads = uploadsForStep.filter((item) =>
      ["pendente", "processando", "em_revisao_parceiro", "pendencia_cliente", "pronto_para_klasse"].includes(item.status)
    );

    let stepStatus: "pendente" | "em_progresso" | "concluido" = "pendente";
    let completedAt: string | null = null;

    if (approvedUploads.length > 0) {
      stepStatus = "concluido";
      const completionCandidates = approvedUploads
        .map((item) => item.updated_at || item.created_at || null)
        .filter((value): value is string => typeof value === "string")
        .sort();
      completedAt = completionCandidates[completionCandidates.length - 1] ?? new Date().toISOString();
    } else if (activeUploads.length > 0) {
      stepStatus = "em_progresso";
    }

    const { error: updateStepError } = await auth.supabase
      .from("onboarding_steps" as any)
      .update({
        status: stepStatus,
        started_at: step.started_at ?? (stepStatus !== "pendente" ? (upload.created_at ?? new Date().toISOString()) : null),
        completed_at: completedAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", step.id);

    if (updateStepError) {
      return NextResponse.json({ ok: false, error: "Erro ao atualizar etapa de onboarding: " + updateStepError.message }, { status: 400 });
    }

    const { error: syncError } = await (auth.supabase.rpc as any)("sync_onboarding_workflow_state", {
      p_onboarding_id: upload.onboarding_id,
    });

    if (syncError) {
      return NextResponse.json(
        { ok: false, error: "Upload revisto, mas falhou a sincronização do workflow: " + syncError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Upload revisado com sucesso. Status da etapa: ${stepStatus}`,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Erro interno" }, { status: 500 });
  }
}

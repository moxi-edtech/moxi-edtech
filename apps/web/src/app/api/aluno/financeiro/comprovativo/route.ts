import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import { getAlunoContext } from "@/lib/alunoContext";
import { resolveAuthorizedStudentIds, resolveSelectedStudentId } from "@/lib/portalAlunoAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const COMPROVATIVOS_BUCKET = "billing-proofs";

export async function POST(request: Request) {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx?.escolaId || !ctx.userId) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const { data: userRes } = await supabase.auth.getUser();
    const authorizedIds = await resolveAuthorizedStudentIds({ supabase, userId: ctx.userId, escolaId: ctx.escolaId, userEmail: userRes?.user?.email });

    const formData = await request.formData();
    const mensalidadeId = formData.get("mensalidadeId")?.toString();
    const studentIdParam = formData.get("studentId")?.toString() ?? null;
    const file = formData.get("file");
    if (!mensalidadeId || !(file instanceof File)) return NextResponse.json({ ok: false, error: "Dados inválidos" }, { status: 400 });

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "O arquivo excede o limite de 5MB" }, { status: 413 });
    }

    const alunoId = resolveSelectedStudentId({ selectedId: studentIdParam, authorizedIds, fallbackId: ctx.alunoId });
    if (!alunoId) return NextResponse.json({ ok: false, error: "Aluno não autorizado" }, { status: 403 });

    const routeClient = await createRouteClient();
    const { data: mensalidade } = await routeClient
      .from("mensalidades")
      .select("id, status")
      .eq("id", mensalidadeId)
      .eq("escola_id", ctx.escolaId)
      .eq("aluno_id", alunoId)
      .maybeSingle();
    if (!mensalidade) return NextResponse.json({ ok: false, error: "Mensalidade não encontrada" }, { status: 404 });

    if (mensalidade.status === "pago") {
      return NextResponse.json({ ok: false, error: "Não é possível enviar comprovativo para uma mensalidade já paga" }, { status: 400 });
    }

    const objectPath = `${ctx.escolaId}/${alunoId}/${mensalidadeId}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await routeClient.storage
      .from(COMPROVATIVOS_BUCKET)
      .upload(objectPath, bytes, { contentType: file.type || "application/octet-stream", upsert: false });
    if (uploadError) return NextResponse.json({ ok: false, error: uploadError.message }, { status: 500 });

    const { data: signedData } = await routeClient.storage
      .from(COMPROVATIVOS_BUCKET)
      .createSignedUrl(objectPath, 60 * 60 * 24 * 30);

    const evidenceUrl = signedData?.signedUrl;
    if (!evidenceUrl) {
      return NextResponse.json({ ok: false, error: "Falha ao gerar URL do comprovativo" }, { status: 500 });
    }

    type RpcResponse = { ok?: boolean; error?: string; pagamento_id?: string; idempotent?: boolean; status?: string };
    type SubmitComprovativoRpc = (
      fn: "aluno_submeter_comprovativo_pagamento",
      args: { p_mensalidade_id: string; p_evidence_url: string; p_meta: Record<string, unknown> },
    ) => Promise<{ data: RpcResponse | null; error: { message: string } | null }>;

    const callSubmitComprovativo = routeClient.rpc.bind(routeClient) as unknown as SubmitComprovativoRpc;
    const { data: rpcData, error: rpcError } = await callSubmitComprovativo(
      "aluno_submeter_comprovativo_pagamento",
      {
        p_mensalidade_id: mensalidadeId,
        p_evidence_url: evidenceUrl,
        p_meta: {
          storage_bucket: COMPROVATIVOS_BUCKET,
          storage_path: objectPath,
          uploaded_via: "api/aluno/financeiro/comprovativo",
          aluno_id: alunoId,
        },
      },
    );

    if (rpcError || rpcData?.ok !== true) {
      return NextResponse.json(
        { ok: false, error: rpcError?.message || rpcData?.error || "Falha ao registrar pagamento pendente" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      status: "pending",
      pagamento_id: rpcData.pagamento_id ?? null,
      idempotent: rpcData.idempotent ?? false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import { getAlunoContext } from "@/lib/alunoContext";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const COMPROVATIVOS_BUCKET = "billing-proofs";

export async function POST(request: Request) {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx?.escolaId || !ctx.userId || !ctx.alunoId) {
        return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const formData = await request.formData();
    const intentId = formData.get("intentId")?.toString();
    const mensagemRaw = formData.get("mensagem")?.toString() ?? null;
    const file = formData.get("file");

    if (!intentId || !(file instanceof File)) {
        return NextResponse.json({ ok: false, error: "Dados inválidos" }, { status: 400 });
    }

    const mensagem = mensagemRaw ? mensagemRaw.trim().slice(0, 500) : null;

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "O arquivo excede o limite de 5MB" }, { status: 413 });
    }

    const routeClient = await createRouteClient();
    
    // Validar se a intenção pertence ao aluno
    const { data: intent } = await routeClient
      .from("pagamento_intents")
      .select("id, status")
      .eq("id", intentId)
      .eq("escola_id", ctx.escolaId)
      .eq("aluno_id", ctx.alunoId)
      .maybeSingle();

    if (!intent) {
        return NextResponse.json({ ok: false, error: "Solicitação não encontrada" }, { status: 404 });
    }

    if (intent.status === "settled") {
      return NextResponse.json({ ok: false, error: "Esta solicitação já está paga e concluída." }, { status: 400 });
    }

    const objectPath = `${ctx.escolaId}/${ctx.alunoId}/servicos/${intentId}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
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

    // Chamar RPC para atualizar intenção
    const { data: rpcData, error: rpcError } = await (routeClient as any).rpc(
      "aluno_submeter_comprovativo_servico",
      {
        p_pagamento_intent_id: intentId,
        p_evidence_url: evidenceUrl,
        p_mensagem: mensagem,
      },
    );

    if (rpcError || rpcData?.ok !== true) {
      return NextResponse.json(
        { ok: false, error: rpcError?.message || rpcData?.error || "Falha ao registrar comprovativo" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, status: "pending" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

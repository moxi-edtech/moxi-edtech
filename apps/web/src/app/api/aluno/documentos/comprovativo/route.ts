import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import { getAlunoContext } from "@/lib/alunoContext";
import { resolveAuthorizedStudentIds, resolveSelectedStudentId } from "@/lib/portalAlunoAuth";
import { resolveBoletimMatricula } from "@/lib/aluno/resolveBoletimMatricula";
import { isBoletimServiceCode } from "@/lib/aluno/boletimAccess";
import { AcademicYearContextError } from "@/lib/academic-year/context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const COMPROVATIVOS_BUCKET = "billing-proofs";

export async function POST(request: Request) {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx?.escolaId || !ctx.userId) {
        return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }
    const { data: userRes } = await supabase.auth.getUser();

    const formData = await request.formData();
    const intentId = formData.get("intentId")?.toString();
    const studentIdParam = formData.get("studentId")?.toString() ?? null;
    const academicYearId = formData.get("ano_letivo_id")?.toString() ?? null;
    const mensagemRaw = formData.get("mensagem")?.toString() ?? null;
    const file = formData.get("file");

    if (!intentId || !(file instanceof File)) {
        return NextResponse.json({ ok: false, error: "Dados inválidos" }, { status: 400 });
    }

    const mensagem = mensagemRaw ? mensagemRaw.trim().slice(0, 500) : null;

    if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return NextResponse.json({ ok: false, error: "Formato inválido. Envie PDF, JPG, PNG ou WEBP." }, { status: 415 });
    }
    if (file.size === 0) return NextResponse.json({ ok: false, error: "Comprovativo vazio." }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "O arquivo excede o limite de 5MB" }, { status: 413 });
    }

    const routeClient = await createRouteClient();
    const authorizedIds = await resolveAuthorizedStudentIds({ supabase, userId: ctx.userId, escolaId: ctx.escolaId, userEmail: userRes?.user?.email });
    const alunoId = resolveSelectedStudentId({ selectedId: studentIdParam, authorizedIds, fallbackId: ctx.alunoId });
    if (!alunoId) return NextResponse.json({ ok: false, error: "Educando não autorizado", next_action: { type: "contact_secretaria", label: "Regularizar acesso", href: "/aluno/avisos" } }, { status: 403 });
    
    // Validar se a intenção pertence ao aluno
    const { data: intent } = await routeClient
      .from("pagamento_intents")
      .select("id, status, evidence_url, servico_pedido_id")
      .eq("id", intentId)
      .eq("escola_id", ctx.escolaId)
      .eq("aluno_id", alunoId)
      .maybeSingle();

    if (!intent?.servico_pedido_id) {
        return NextResponse.json({ ok: false, error: "Solicitação não encontrada" }, { status: 404 });
    }

    const { data: pedido, error: pedidoError } = await routeClient.from("servico_pedidos")
      .select("id, matricula_id, servico_codigo")
      .eq("id", intent.servico_pedido_id).eq("escola_id", ctx.escolaId)
      .eq("aluno_id", alunoId).maybeSingle();
    if (pedidoError || !pedido) {
      return NextResponse.json({ ok: false, error: "Pedido original não encontrado. Contacte a secretaria." }, { status: 409 });
    }
    if (isBoletimServiceCode(pedido.servico_codigo ?? "")) {
      const { matricula } = await resolveBoletimMatricula(supabase, {
        escolaId: ctx.escolaId, alunoId, userId: ctx.userId,
        anoLetivoId: academicYearId, operation: "WRITE",
      });
      if (pedido.matricula_id !== matricula?.id) {
        return NextResponse.json({ ok: false, error: "Este comprovativo pertence a outra matrícula. Não volte a pagar." }, { status: 409 });
      }
    }
    if (intent.status === "settled") {
      return NextResponse.json({ ok: false, error: "Esta solicitação já está paga e concluída." }, { status: 400 });
    }

    // Retry seguro: o comprovativo já foi recebido pela secretaria.
    if (intent.status === "pending" && intent.evidence_url) {
      return NextResponse.json({
        ok: true,
        status: "pending",
        idempotent: true,
        message: "O comprovativo já foi recebido e aguarda validação da secretaria.",
      });
    }

    if (!["draft", "failed", "pending"].includes(intent.status)) {
      return NextResponse.json({ ok: false, error: "O pedido não permite novo envio. Contacte a secretaria." }, { status: 409 });
    }
    // Não incluir o nome original do ficheiro: pode conter dados de menores.
    const extension = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const objectPath = `${ctx.escolaId}/${alunoId}/servicos/${intentId}/${crypto.randomUUID()}.${extension}`;
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
      await routeClient.storage.from(COMPROVATIVOS_BUCKET).remove([objectPath]);
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
      await routeClient.storage.from(COMPROVATIVOS_BUCKET).remove([objectPath]);
      return NextResponse.json(
        { ok: false, error: rpcError?.message || rpcData?.error || "Falha ao registrar comprovativo" },
        { status: 500 },
      );
    }

    if (rpcData?.idempotent === true) {
      await routeClient.storage.from(COMPROVATIVOS_BUCKET).remove([objectPath]);
    }
    return NextResponse.json({
      ok: true,
      status: "pending",
      idempotent: rpcData?.idempotent === true,
      message: "Comprovativo recebido. A secretaria irá validar o pagamento.",
    });
  } catch (error: unknown) {
    if (error instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Não foi possível enviar o comprovativo. Tente novamente." }, { status: 500 });
  }
}

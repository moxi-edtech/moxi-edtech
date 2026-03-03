import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import { getAlunoContext } from "@/lib/alunoContext";
import { resolveAuthorizedStudentIds, resolveSelectedStudentId } from "@/lib/portalAlunoAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

    try {
      const { data: bucket } = await routeClient.storage.getBucket("aluno-comprovativos");
      if (!bucket) await routeClient.storage.createBucket("aluno-comprovativos", { public: false });
    } catch {}

    const { error: uploadError } = await routeClient.storage.from("aluno-comprovativos").upload(objectPath, bytes, { contentType: file.type || "application/octet-stream", upsert: false });
    if (uploadError) return NextResponse.json({ ok: false, error: uploadError.message }, { status: 500 });

    const { error: updateError } = await routeClient
      .from("mensalidades")
      .update({ status: "em_verificacao", observacao: `Comprovativo anexado: ${objectPath}`, updated_by: ctx.userId })
      .eq("id", mensalidadeId)
      .eq("escola_id", ctx.escolaId)
      .eq("aluno_id", alunoId);
    if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });

    return NextResponse.json({ ok: true, status: "em_verificacao" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

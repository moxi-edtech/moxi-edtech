import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";
import { resolveAuthorizedStudentIds, resolveSelectedStudentId } from "@/lib/portalAlunoAuth";
import { fetchAcademicCarryovers } from "@/lib/academico/dependencias-transicao-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const { supabase, ctx } = await getAlunoContext();
  if (!ctx?.userId || !ctx.escolaId) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const { data: userRes } = await supabase.auth.getUser();
  const authorizedIds = await resolveAuthorizedStudentIds({
    supabase,
    userId: ctx.userId,
    escolaId: ctx.escolaId,
    userEmail: userRes?.user?.email,
  });
  const selectedId = resolveSelectedStudentId({
    selectedId: new URL(request.url).searchParams.get("studentId"),
    authorizedIds,
    fallbackId: ctx.alunoId,
  });
  if (!selectedId) {
    return NextResponse.json({ ok: false, error: "Aluno não autorizado" }, { status: 403 });
  }

  try {
    const items = await fetchAcademicCarryovers(supabase as any, {
      escolaId: ctx.escolaId,
      alunoId: selectedId,
      limit: 50,
    });
    return NextResponse.json({
      ok: true,
      aluno_id: selectedId,
      summary: {
        total: items.length,
        abertas: items.filter((item) => item.status === "pendente" || item.status === "em_recurso").length,
        resolvidas: items.filter((item) => item.status.startsWith("resolvida_")).length,
      },
      items,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível carregar as dependências académicas.",
    }, { status: 500 });
  }
}

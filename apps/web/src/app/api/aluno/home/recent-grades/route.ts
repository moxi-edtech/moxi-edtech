import { checkBoletimAccess } from "@/lib/aluno/boletimAccess";
import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";
import { resolveAuthorizedStudentIds, resolveSelectedStudentId } from "@/lib/portalAlunoAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type NotaComAvaliacao = {
  valor: number;
  created_at: string;
  avaliacao: { nome: string; tipo: string; created_at: string } | null;
};

export async function GET(request: Request) {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx?.escolaId || !ctx.userId) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const { data: userRes } = await supabase.auth.getUser();
    const authorizedIds = await resolveAuthorizedStudentIds({
      supabase,
      userId: ctx.userId,
      escolaId: ctx.escolaId,
      userEmail: userRes?.user?.email,
    });

    const selectedId = new URL(request.url).searchParams.get("studentId");
    if (selectedId && !authorizedIds.includes(selectedId)) return NextResponse.json({ ok: false, error: "Aluno não autorizado" }, { status: 403 });
    const alunoId = resolveSelectedStudentId({ selectedId, authorizedIds, fallbackId: ctx.alunoId });
    if (!alunoId) return NextResponse.json({ ok: true, items: [] });

    let matriculaId = ctx.matriculaId;
    if (!matriculaId || (selectedId && selectedId !== ctx.alunoId)) {
      const { data: matricula } = await supabase
        .from("matriculas")
        .select("id")
        .eq("aluno_id", alunoId)
        .eq("escola_id", ctx.escolaId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      matriculaId = matricula?.id ?? null;
    }

    if (!matriculaId) return NextResponse.json({ ok: true, items: [] });

    // --- SEGURANÇA: Verificar se o boletim foi pago ---
    const access = await checkBoletimAccess(supabase, { escolaId: ctx.escolaId, alunoId, matriculaId });
    if (access.error) return NextResponse.json({ ok: false, error: "Não foi possível verificar o pagamento do boletim." }, { status: 503 });
    if (!access.granted) return NextResponse.json({ ok: true, items: [], restricted: true });

    const { data } = await supabase
      .from("notas")
      .select("valor, created_at, avaliacao:avaliacoes(nome, tipo, created_at)")
      .eq("matricula_id", matriculaId)
      .eq("escola_id", ctx.escolaId)
      .order("created_at", { ascending: false })
      .limit(3);

    const rows = (data ?? []) as unknown as NotaComAvaliacao[];
    const items = rows.map((row) => ({
      disciplina: row.avaliacao?.nome ?? "Avaliação",
      tipo: row.avaliacao?.tipo ?? "Avaliação",
      nota: row.valor ?? null,
      data: row.created_at ?? row.avaliacao?.created_at ?? null,
    }));

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

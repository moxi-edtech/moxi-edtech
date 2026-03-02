import { NextResponse } from "next/server";
import { createInstitutionalPdf } from "@/lib/pdf/documentTemplate";
import { getAlunoContext } from "@/lib/alunoContext";
import { resolveAuthorizedStudentIds, resolveSelectedStudentId } from "@/lib/portalAlunoAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type BoletimRow = { disciplina_id: string | null; disciplina_nome: string | null; trimestre: number | null; nota_final: number | null };

export async function GET(request: Request) {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx?.escolaId || !ctx.userId) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const { data: userRes } = await supabase.auth.getUser();
    const authorizedIds = await resolveAuthorizedStudentIds({ supabase, userId: ctx.userId, escolaId: ctx.escolaId, userEmail: userRes?.user?.email });
    const selectedId = new URL(request.url).searchParams.get("studentId");
    const alunoId = resolveSelectedStudentId({ selectedId, authorizedIds, fallbackId: ctx.alunoId });
    if (!alunoId) return NextResponse.json({ ok: false, error: "Aluno não autorizado" }, { status: 403 });

    const [{ data: escola }, { data: aluno }, { data: matricula }] = await Promise.all([
      supabase.from("escolas").select("nome, nif, endereco, logo_url").eq("id", ctx.escolaId).maybeSingle(),
      supabase.from("alunos").select("nome").eq("id", alunoId).eq("escola_id", ctx.escolaId).maybeSingle(),
      supabase.from("matriculas").select("id").eq("aluno_id", alunoId).eq("escola_id", ctx.escolaId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    if (!matricula?.id) return NextResponse.json({ ok: false, error: "Sem matrícula" }, { status: 404 });

    const { data: boletimRows, error } = await supabase
      .from("vw_boletim_por_matricula")
      .select("disciplina_id, disciplina_nome, trimestre, nota_final")
      .eq("matricula_id", matricula.id)
      .limit(50);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const byDisciplina = new Map<string, { nome: string; t1: number | null; t2: number | null; t3: number | null; final: number | null }>();
    (boletimRows as BoletimRow[] | null)?.forEach((row) => {
      const id = row.disciplina_id ?? "";
      if (!id) return;
      const existing = byDisciplina.get(id) ?? { nome: row.disciplina_nome ?? "Disciplina", t1: null, t2: null, t3: null, final: null };
      if (row.trimestre === 1) existing.t1 = row.nota_final ?? null;
      if (row.trimestre === 2) existing.t2 = row.nota_final ?? null;
      if (row.trimestre === 3) existing.t3 = row.nota_final ?? null;
      existing.final = existing.final ?? row.nota_final ?? null;
      byDisciplina.set(id, existing);
    });

    const linhas = Array.from(byDisciplina.values());
    const pdfBytes = await createInstitutionalPdf({
      title: `Boletim do Aluno — ${aluno?.nome ?? "Aluno"}`,
      school: { name: escola?.nome ?? "Escola", nif: escola?.nif ?? null, address: escola?.endereco ?? null, logoUrl: escola?.logo_url ?? null },
      content: async ({ page, margin, contentStartY, font, boldFont }) => {
        let y = contentStartY;
        page.drawText("Disciplina", { x: margin, y, size: 10, font: boldFont });
        page.drawText("T1", { x: margin + 210, y, size: 10, font: boldFont });
        page.drawText("T2", { x: margin + 250, y, size: 10, font: boldFont });
        page.drawText("T3", { x: margin + 290, y, size: 10, font: boldFont });
        page.drawText("Final", { x: margin + 330, y, size: 10, font: boldFont });
        y -= 14;
        for (const row of linhas) {
          if (y < 70) break;
          page.drawText(row.nome.slice(0, 34), { x: margin, y, size: 9, font });
          page.drawText(row.t1 == null ? "—" : row.t1.toFixed(1), { x: margin + 210, y, size: 9, font });
          page.drawText(row.t2 == null ? "—" : row.t2.toFixed(1), { x: margin + 250, y, size: 9, font });
          page.drawText(row.t3 == null ? "—" : row.t3.toFixed(1), { x: margin + 290, y, size: 9, font });
          page.drawText(row.final == null ? "—" : row.final.toFixed(1), { x: margin + 330, y, size: 9, font: boldFont });
          y -= 13;
        }
      },
    });

    return new NextResponse(pdfBytes as BodyInit, { status: 200, headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="boletim_${(aluno?.nome ?? "aluno").replace(/\s+/g, "_")}.pdf"` } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

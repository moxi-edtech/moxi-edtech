import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { authorizeMatriculasManage } from "@/lib/escola/disciplinas";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { tryCanonicalFetch } from "@/lib/api/proxyCanonical";

export async function GET(req: Request, context: { params: Promise<{ matriculaId: string }> }) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const headers = new Headers();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    const { matriculaId: matricula_id } = await context.params;

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 });

    const authz = await authorizeMatriculasManage(supabase as any, escolaId, user.id);
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 });

    headers.set('Deprecation', 'true');
    headers.set('Link', `</api/escolas/${escolaId}/matriculas>; rel="successor-version"`);

    const forwarded = await tryCanonicalFetch(req, `/api/escolas/${escolaId}/matriculas/${matricula_id}/declaracao`);
    if (forwarded) return forwarded;

    const { data: matricula, error } = await supabase
      .from('matriculas')
      .select(`
        *,
        alunos(*),
        turmas(*, school_sessions(*)),
        escolas(*)
      `)
      .eq('id', matricula_id)
      .eq('escola_id', escolaId)
      .single();

    if (error || !matricula) {
      return NextResponse.json({ ok: false, error: 'Matrícula não encontrada' }, { status: 404, headers });
    }

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const drawText = (text: string, x: number, y: number, size = 12, isBold = false) => {
      page.drawText(text, {
        x,
        y,
        font: isBold ? boldFont : font,
        size,
        color: rgb(0, 0, 0),
      });
    };

    drawText(matricula.escolas.nome, 50, height - 50, 18, true);
    drawText("Declaração de Matrícula", 50, height - 100, 16, true);

    const textY = height - 150;
    drawText(`Declaramos, para os devidos fins, que o(a) aluno(a) ${matricula.alunos.nome},`, 50, textY);
    drawText(`está regularmente matriculado(a) na ${matricula.turmas.classe}ª classe, turma ${matricula.turmas.nome},`, 50, textY - 20);
    drawText(`no ano letivo de ${matricula.turmas.school_sessions.nome}.`, 50, textY - 40);

    const date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    drawText(`Luanda, ${date}.`, 50, textY - 100);

    const pdfBytes = await pdfDoc.save();
    const buffer = Buffer.from(pdfBytes); // Convert Uint8Array to Node.js Buffer
    const blob = new Blob([buffer], { type: 'application/pdf' });

    headers.set('Content-Type', 'application/pdf');
    headers.set('Content-Disposition', `attachment; filename="declaracao_matricula_${matricula.alunos.nome}.pdf"`);
    return new NextResponse(blob, { headers });

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

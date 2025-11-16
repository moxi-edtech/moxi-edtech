import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    const { id: matricula_id } = await context.params;

    const { data: matricula, error } = await supabase
      .from('matriculas')
      .select(`
        *,
        alunos(*),
        turmas(*, school_sessions(*)),
        escolas(*)
      `)
      .eq('id', matricula_id)
      .single();

    if (error || !matricula) {
      return NextResponse.json({ ok: false, error: 'Matrícula não encontrada' }, { status: 404 });
    }

    const { data: frequencias } = await supabase
      .from('frequencias')
      .select('*')
      .eq('matricula_id', matricula_id)
      .order('data', { ascending: false });

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
    drawText("Declaração de Frequência", 50, height - 100, 16, true);

    let textY = height - 150;
    drawText(`Declaramos, para os devidos fins, que o(a) aluno(a) ${matricula.alunos.nome},`, 50, textY);
    drawText(`matriculado(a) na ${matricula.turmas.classe}ª classe, turma ${matricula.turmas.nome},`, 50, textY - 20);
    drawText(`no ano letivo de ${matricula.turmas.school_sessions.nome}, tem o seguinte registo de frequência:`, 50, textY - 40);

    textY -= 80;
    drawText("Data", 50, textY, 12, true);
    drawText("Status", 200, textY, 12, true);

    textY -= 20;
    for (const freq of frequencias || []) {
      drawText(new Date(freq.data).toLocaleDateString('pt-BR'), 50, textY);
      drawText(freq.status, 200, textY);
      textY -= 20;
      if (textY < 50) {
        // Add a new page if the content overflows
        const newPage = pdfDoc.addPage();
        page.moveTo(50, height - 50);
        textY = height - 50;
      }
    }

    const date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    drawText(`Luanda, ${date}.`, 50, textY - 50);

    const pdfBytes = await pdfDoc.save();
    const buffer = Buffer.from(pdfBytes); // Convert Uint8Array to Node.js Buffer
    const blob = new Blob([buffer], { type: 'application/pdf' });

    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="declaracao_frequencia_${matricula.alunos.nome}.pdf"`,
      },
    });

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

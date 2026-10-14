import { createInstitutionalPdf } from "@/lib/pdf/documentTemplate";
import type { DisciplinaBoletim } from "@/lib/aluno/boletimNotas";

type EscolaBoletim = { nome?: string | null; nif?: string | null; endereco?: string | null; logo_url?: string | null };

export async function criarPdfBoletim(params: { nomeAluno: string; escola: EscolaBoletim; disciplinas: DisciplinaBoletim[]; dataEmissao: string }) {
  const { nomeAluno, escola, disciplinas, dataEmissao } = params;
    return createInstitutionalPdf({
      title: `Boletim de notas - ${nomeAluno}`,
      subtitle: `Notas lançadas até ${dataEmissao}`,
      school: { name: escola.nome ?? "Escola", nif: escola.nif, address: escola.endereco, logoUrl: escola.logo_url },
      content: async ({ page, pdfDoc, margin, width, height, contentStartY, font, boldFont }) => {
        let currentPage = page;
        let y = contentStartY;
        const nextPageIfNeeded = (lines = 1) => {
          if (y >= 75 + lines * 16) return;
          currentPage = pdfDoc.addPage([width, height]);
          y = height - margin - 30;
          currentPage.drawText("Boletim de notas - continuação", { x: margin, y, size: 11, font: boldFont });
          y -= 28;
        };
        if (disciplinas.length === 0) {
          currentPage.drawText("Ainda não existem notas lançadas para esta matrícula.", { x: margin, y, size: 10, font });
          return;
        }
        for (const disciplina of disciplinas) {
          nextPageIfNeeded(3);
          currentPage.drawText(disciplina.nome.slice(0, 65), { x: margin, y, font: boldFont, size: 10 });
          y -= 17;
          for (const avaliacao of disciplina.avaliacoes) {
            nextPageIfNeeded();
            const descricao = `${avaliacao.trimestre}º trimestre - ${(avaliacao.nome || avaliacao.tipo).slice(0, 53)}`;
            currentPage.drawText(descricao, { x: margin + 12, y, size: 9, font });
            currentPage.drawText(avaliacao.nota.toFixed(1), { x: width - margin - 43, y, size: 9, font: boldFont });
            y -= 16;
          }
          y -= 10;
        }
      },
    });
}

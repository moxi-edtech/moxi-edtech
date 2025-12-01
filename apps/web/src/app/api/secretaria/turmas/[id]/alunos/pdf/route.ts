import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { createInstitutionalPdf } from "@/lib/pdf/documentTemplate";
import { createQrImage, buildSignatureLine } from "@/lib/pdf/qr";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const { id: turmaId } = await params;

    const { data: turma, error: turmaError } = await supabase
      .from("turmas")
      .select(
        `
        *,
        escolas (*),
        school_sessions (*)
      `
      )
      .eq("id", turmaId)
      .single();

    if (turmaError || !turma) {
      return NextResponse.json(
        { ok: false, error: "Turma não encontrada" },
        { status: 404 }
      );
    }

    const escola = (turma as any).escolas;
    const sessao = (turma as any).school_sessions;

    const { data: matriculas, error: alunosError } = await supabase
      .from("matriculas")
      .select(
        `
        id,
        numero_lista,
        status,
        alunos (
          id,
          nome,
          bi_numero,
          data_nascimento,
          telefone,
          responsavel,
          telefone_responsavel
        )
      `
      )
      .eq("turma_id", turmaId)
      .order("numero_lista", { ascending: true })
      .order("created_at", { ascending: true });

    if (alunosError) {
      return NextResponse.json(
        { ok: false, error: alunosError.message },
        { status: 500 }
      );
    }

    const alunos = (matriculas ?? []).map((mat, index) => {
      const aluno = Array.isArray(mat.alunos) ? mat.alunos[0] : mat.alunos;
      return {
        numero_lista: mat.numero_lista ?? index + 1,
        nome: aluno?.nome ?? "—",
        bi_numero: aluno?.bi_numero ?? "—",
        telefone: aluno?.telefone ?? "—",
        responsavel: aluno?.responsavel ?? "—",
        telefone_responsavel: aluno?.telefone_responsavel ?? "—",
      };
    });

    const verificationToken = randomUUID();
    const validationBase =
      process.env.NEXT_PUBLIC_VALIDATION_BASE_URL ??
      escola?.validation_base_url ??
      undefined;

    const pdfBytes = await createInstitutionalPdf({
      title: "Lista de Alunos por Turma",
      school: {
        name: escola?.nome ?? "Escola",
        nif: escola?.nif ?? escola?.numero_fiscal,
        address: escola?.endereco ?? escola?.morada,
        contacts: [escola?.telefone, escola?.email].filter(Boolean).join(" • "),
        logoUrl: escola?.logo_url ?? escola?.logo,
        validationBaseUrl: validationBase,
      },
      verificationToken,
      content: async ({
        page,
        pdfDoc,
        margin,
        contentStartY,
        font,
        boldFont,
        verificationUrl,
        width,
      }) => {
        let cursorY = contentStartY;
        const lineHeight = 14;

        const draw = (
          text: string,
          x: number,
          size = 10,
          isBold = false
        ) => {
          page.drawText(text, {
            x,
            y: cursorY,
            font: isBold ? boldFont : font,
            size,
          });
        };

        draw(
          `Turma: ${turma.nome ?? "—"} • Classe: ${
            turma.classe ?? "—"
          } • Turno: ${turma.turno ?? "—"}`,
          margin,
          10,
          true
        );
        cursorY -= lineHeight;
        draw(
          `Ano letivo: ${
            sessao?.nome ?? sessao?.ano ?? "—"
          } • Sala: ${turma.sala ?? "—"}`,
          margin,
          10
        );
        cursorY -= lineHeight * 1.5;

        const colX = {
          num: margin,
          nome: margin + 30,
          bi: margin + 230,
          tel: margin + 360,
          resp: margin + 430,
          telResp: margin + 560,
        };

        draw("Nº", colX.num, 9, true);
        draw("Nome", colX.nome, 9, true);
        draw("BI", colX.bi, 9, true);
        draw("Telefone", colX.tel, 9, true);
        draw("Encarregado", colX.resp, 9, true);
        draw("Tel. Encarregado", colX.telResp, 9, true);
        cursorY -= lineHeight;

        for (const aluno of alunos) {
          if (cursorY < 80) {
            const newPage = pdfDoc.addPage();
            page = newPage;
            cursorY = newPage.getSize().height - margin - 20;
            draw("Nº", colX.num, 9, true);
            draw("Nome", colX.nome, 9, true);
            draw("BI", colX.bi, 9, true);
            draw("Telefone", colX.tel, 9, true);
            draw("Encarregado", colX.resp, 9, true);
            draw("Tel. Encarregado", colX.telResp, 9, true);
            cursorY -= lineHeight;
          }

          draw(String(aluno.numero_lista).padStart(2, "0"), colX.num);
          draw(aluno.nome, colX.nome);
          draw(aluno.bi_numero, colX.bi);
          draw(aluno.telefone, colX.tel);
          draw(aluno.responsavel, colX.resp);
          draw(aluno.telefone_responsavel, colX.telResp);
          cursorY -= lineHeight;
        }

        cursorY -= lineHeight;

        const qrSize = 80;
        if (verificationUrl) {
          const qrImage = await createQrImage(pdfDoc, verificationUrl);
          const qrX = width - margin - qrSize;
          const qrY = Math.max(cursorY - qrSize - 10, margin + 40);
          page.drawImage(qrImage, {
            x: qrX,
            y: qrY,
            width: qrSize,
            height: qrSize,
          });

          const signatureY = qrY + qrSize + 8;
          page.drawText(
            buildSignatureLine({
              signerName: escola?.responsavel ?? escola?.diretor_nome,
              signerRole: escola?.diretor_cargo ?? "Diretor(a)",
            }),
            {
              x: margin,
              y: signatureY,
              font,
              size: 11,
            }
          );
        } else {
          const signatureY = cursorY - 20;
          page.drawText(
            buildSignatureLine({
              signerName: escola?.responsavel ?? escola?.diretor_nome,
              signerRole: escola?.diretor_cargo ?? "Diretor(a)",
            }),
            {
              x: margin,
              y: signatureY,
              font,
              size: 11,
            }
          );
        }
      },
    });

    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="lista_alunos_turma_${
          turma.nome ?? "turma"
        }.pdf"`,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

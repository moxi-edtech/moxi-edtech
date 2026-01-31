import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createInstitutionalPdf } from "@/lib/pdf/documentTemplate";
import { buildSignatureLine, createQrImage } from "@/lib/pdf/qr";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { authorizeTurmasManage } from "@/lib/escola/disciplinas";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { tryCanonicalFetch } from "@/lib/api/proxyCanonical";
import { requireFeature } from "@/lib/plan/requireFeature";
import { applyKf2ListInvariants } from "@/lib/kf2";

type TurmaRow = {
  id: string;
  nome: string | null;
  classe?: string | null;
  turno?: string | null;
  sala?: string | null;
  escolas?: {
    id: string;
    nome: string;
    nif?: string | null;
    numero_fiscal?: string | null;
    endereco?: string | null;
    morada?: string | null;
    telefone?: string | null;
    email?: string | null;
    logo_url?: string | null;
    logo?: string | null;
    validation_base_url?: string | null;
    responsavel?: string | null;
    diretor_nome?: string | null;
    diretor_cargo?: string | null;
  } | null;
};

type MatriculaRow = {
  id: string;
  status: string;
  alunos?: {
    id: string;
    nome?: string | null;
    bi_numero?: string | null;
    naturalidade?: string | null;
    provincia?: string | null;
    telefone?: string | null;
    responsavel?: string | null;
    telefone_responsavel?: string | null;
  } | null;
};

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const headers = new Headers();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) return NextResponse.json({ ok: true, turma: null, total: 0, alunos: [] }, { headers });

    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id);
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 });

    headers.set('Deprecation', 'true');
    headers.set('Link', `</api/escolas/${escolaId}/turmas>; rel="successor-version"`);

    const { id: turmaId } = await params;
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") ?? "json";

    if (format === "pdf") {
      await requireFeature("doc_qr_code");
      const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
      if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 });
      const forwarded = await tryCanonicalFetch(req, `/api/escolas/${escolaId}/turmas/${turmaId}/alunos/pdf`);
      if (forwarded) return forwarded;
    }

    // 1) Carregar turma + escola (RLS garante escola correta)
    const { data: turma, error: turmaError } = await supabase
      .from("turmas")
      .select(
        `
        id,
        nome,
        classe_id,
        turno,
        sala,
        escolas (
          id,
          nome,
          nif,
          numero_fiscal,
          endereco,
          morada,
          telefone,
          email,
          logo_url,
          logo,
          validation_base_url,
          responsavel,
          diretor_nome,
          diretor_cargo
        ),
        classes (
            nome
        )
      `
      )
      .eq("id", turmaId)
      .eq("escola_id", escolaId)
      .single<TurmaRow>();

    if (turmaError || !turma) {
      return NextResponse.json({ ok: false, error: "Turma não encontrada" }, { status: 404, headers });
    }
    const classeNome = (turma as any)?.classes?.nome || '—';

    // 2) Buscar matrículas ativas + dados dos alunos
    let matriculasQuery = supabase
      .from("matriculas")
      .select(
        `
        id,
        status,
        alunos (
          id,
          nome,
          bi_numero,
          naturalidade,
          provincia,
          telefone,
          responsavel,
          telefone_responsavel
        )
      `
      )
      .eq("turma_id", turmaId)
      .eq("escola_id", escolaId)
      .in("status", ["ativo", "ativa"]);

    matriculasQuery = applyKf2ListInvariants(matriculasQuery, { defaultLimit: 50 });

    const { data: matriculas, error: matriculasError } = await matriculasQuery;

    if (matriculasError) {
      return NextResponse.json({ ok: false, error: matriculasError.message }, { status: 500, headers });
    }

    let numero = 1;
    const alunosOrdenados = (matriculas ?? []).flatMap((m) => {
      const alunoData = (m as any)?.alunos;
      const alunosArray = Array.isArray(alunoData) ? alunoData : alunoData ? [alunoData] : [];

      return alunosArray.map((a) => ({
        numero: numero++,
        matricula_id: (m as any)?.id,
        aluno_id: a.id,
        nome: a.nome ?? "—",
        bi: a.bi_numero ?? "—",
        naturalidade: a.naturalidade ?? "—",
        provincia: a.provincia ?? "—",
        telefone: a.telefone ?? "—",
        encarregado: a.responsavel ?? "—",
        telefone_encarregado: a.telefone_responsavel ?? "—",
        status_matricula: (m as any)?.status,
      }));
    });

    // 3) Resposta JSON (default)
    if (format !== "pdf") {
      return NextResponse.json({
        ok: true,
        turma: {
          id: turma.id,
          nome: turma.nome,
          codigo: null,
          classe: classeNome,
          turno: turma.turno ?? null,
          sala: turma.sala ?? null,
          escola_nome: turma.escolas?.nome ?? null,
        },
        total: alunosOrdenados.length,
        alunos: alunosOrdenados,
      }, { headers });
    }

    // 4) Geração de PDF institucional com QR
    const escola = turma.escolas;
    const verificationToken = randomUUID();
    const validationBase =
      process.env.NEXT_PUBLIC_VALIDATION_BASE_URL ?? escola?.validation_base_url ?? undefined;

    const pdfBytes = (await createInstitutionalPdf({
      title: `Lista de Alunos – Turma ${turma.nome ?? ""}`,
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
        width,
        margin,
        contentStartY,
        font,
        boldFont,
        verificationUrl,
      }) => {
        let cursorY = contentStartY;
        const lineHeight = 14;

        const draw = (
          text: string,
          x: number,
          y: number,
          opts?: { bold?: boolean; size?: number }
        ) => {
          page.drawText(text, {
            x,
            y,
            font: opts?.bold ? boldFont : font,
            size: opts?.size ?? 10,
          });
        };

        // Cabeçalho da turma
        draw(
          `Turma: ${turma.nome ?? "—"}   •   Classe: ${
            classeNome ?? "—"
          }   •   Turno: ${turma.turno ?? "—"}`,
          margin,
          cursorY,
          { bold: true, size: 11 }
        );
        cursorY -= lineHeight;

        if (turma.sala) {
          draw(`Sala: ${turma.sala}`, margin, cursorY, { size: 10 });
          cursorY -= lineHeight;
        }

        cursorY -= 4;

        // Cabeçalho da tabela
        const colNumero = margin;
        const colNome = margin + 30;
        const colBi = margin + 220;
        const colEncarregado = margin + 360;
        const colTelefone = margin + 500;

        draw("Nº", colNumero, cursorY, { bold: true });
        draw("Nome do aluno", colNome, cursorY, { bold: true });
        draw("BI", colBi, cursorY, { bold: true });
        draw("Encarregado", colEncarregado, cursorY, { bold: true });
        draw("Contacto", colTelefone, cursorY, { bold: true });

        cursorY -= lineHeight;

        // Linhas com os alunos (simples, sem quebra de página por enquanto)
        for (const aluno of alunosOrdenados) {
          if (cursorY < margin + 60) {
            break;
          }

          draw(String(aluno.numero), colNumero, cursorY);
          draw(aluno.nome, colNome, cursorY);
          draw(aluno.bi, colBi, cursorY);
          draw(aluno.encarregado, colEncarregado, cursorY);
          draw(aluno.telefone_encarregado || aluno.telefone, colTelefone, cursorY);

          cursorY -= lineHeight;
        }

        cursorY -= lineHeight;

        // QR code + assinatura no rodapé da área útil
        const qrSize = 80;
        if (verificationUrl) {
          const qrImage = await createQrImage(pdfDoc, verificationUrl);
          const qrX = width - margin - qrSize;
          const qrY = Math.max(cursorY - qrSize - 10, margin + 30);

          page.drawImage(qrImage, {
            x: qrX,
            y: qrY,
            width: qrSize,
            height: qrSize,
          });

          const sigY = qrY + qrSize + 8;
          page.drawText(
            buildSignatureLine({
              signerName: escola?.responsavel ?? escola?.diretor_nome,
              signerRole: escola?.diretor_cargo,
            }),
            {
              x: margin,
              y: sigY,
              font,
              size: 10,
            }
          );
        } else {
          const sigY = cursorY - 10;
          page.drawText(
            buildSignatureLine({
              signerName: escola?.responsavel ?? escola?.diretor_nome,
              signerRole: escola?.diretor_cargo,
            }),
            {
              x: margin,
              y: sigY,
              font,
              size: 10,
            }
          );
        }
      },
    })) as Uint8Array;

    return new NextResponse(pdfBytes as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="lista_alunos_turma_${
          turma.nome ?? turma.id
        }.pdf"`,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

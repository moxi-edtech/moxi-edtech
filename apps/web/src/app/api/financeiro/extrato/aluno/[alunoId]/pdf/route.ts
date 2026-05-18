import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { rgb } from "pdf-lib";
import { createInstitutionalPdf } from "@/lib/pdf/documentTemplate";
import { buildSignatureLine, createQrImage } from "@/lib/pdf/qr";
import { requireFeature } from "@/lib/plan/requireFeature";
import { applyKf2ListInvariants } from "@/lib/kf2";
import { requireApiTenantGuard } from "@/lib/api/requireApiTenantGuard";

interface PaymentRow {
  valor_pago: number | null;
  metodo_pagamento: string | null;
  data_pagamento: string | null;
  referencia_externa?: string | null;
}

interface MensalidadeRow {
  id: string;
  matricula_id?: string | null;
  ano_letivo?: number | null;
  mes_referencia?: number | null;
  ano_referencia?: number | null;
  data_vencimento?: string | null;
  data_pagamento_efetiva?: string | null;
  valor_previsto?: number | null;
  valor_pago_total?: number | null;
  status?: string | null;
  observacoes?: string | null;
  pagamentos?: PaymentRow[] | PaymentRow | null;
}

interface ProfileRow {
  numero_processo_login?: string | null;
}

interface TurmaRow {
  id: string;
  nome?: string | null;
  classe?: { nome?: string | null } | null;
  turno?: string | null;
  ano_letivo?: number | null;
}

interface MatriculaRow {
  id: string;
  ano_letivo?: number | null;
  status?: string | null;
  numero_matricula?: number | null;
  turma?: TurmaRow | TurmaRow[] | null;
}

interface EscolaRow {
  id: string;
  nome?: string | null;
  nif?: string | null;
  endereco?: string | null;
  logo_url?: string | null;
  responsavel?: string | null;
  diretor_nome?: string | null;
}

interface AlunoRow {
  id: string;
  nome?: string | null;
  bi_numero?: string | null;
  telefone?: string | null;
  email?: string | null;
  responsavel?: string | null;
  telefone_responsavel?: string | null;
  escola_id?: string | null;
  profiles?: ProfileRow | ProfileRow[] | null;
  matriculas?: MatriculaRow | MatriculaRow[] | null;
  escolas?: EscolaRow | null;
}

function normalizeProfile(profile: ProfileRow | ProfileRow[] | null | undefined) {
  if (!profile) return null;
  return Array.isArray(profile) ? profile[0] ?? null : profile;
}

function normalizeMatriculas(matriculas: MatriculaRow | MatriculaRow[] | null | undefined) {
  if (!matriculas) return [] as MatriculaRow[];
  return Array.isArray(matriculas) ? matriculas : [matriculas];
}

function normalizeTurma(turma: TurmaRow | TurmaRow[] | null | undefined) {
  if (!turma) return null;
  return Array.isArray(turma) ? turma[0] ?? null : turma;
}

function normalizePagamentos(pagamentos: PaymentRow | PaymentRow[] | null | undefined) {
  if (!pagamentos) return [] as PaymentRow[];
  return Array.isArray(pagamentos) ? pagamentos : [pagamentos];
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ alunoId: string }> }
) {
  try {
    const { alunoId } = await params;
    const guard = await requireApiTenantGuard({ productContext: "k12" });
    if (!guard.ok) return guard.response;

    const { supabase, tenantId: escolaId } = guard;

    await requireFeature("doc_qr_code");

    // 1. Buscar dados do aluno e escola
    const { data: alunoData, error: alunoError } = await supabase
      .from("alunos")
      .select(`
        id, nome, bi_numero, telefone, email, responsavel, telefone_responsavel, escola_id,
        profiles(numero_processo_login),
        matriculas(
          id, ano_letivo, status, numero_matricula,
          turma:turmas(id, nome, classe:classes(nome), turno, ano_letivo)
        ),
        escolas(id, nome, nif, endereco, logo_url, responsavel, diretor_nome)
      `)
      .eq("id", alunoId)
      .eq("escola_id", escolaId)
      .single();

    if (alunoError || !alunoData) {
      return NextResponse.json(
        { ok: false, error: "Aluno não encontrado" },
        { status: 404 }
      );
    }

    const aluno = alunoData as unknown as AlunoRow;
    const escola = aluno.escolas;

    // 2. Buscar histórico de pagamentos/mensalidades
    let query = supabase
      .from("mensalidades")
      .select(`
        id, matricula_id, ano_letivo, mes_referencia, ano_referencia,
        data_vencimento, data_pagamento_efetiva, valor_previsto, valor_pago_total,
        status, observacoes,
        pagamentos:financeiro_pagamentos(valor_pago, metodo_pagamento, data_pagamento, referencia_externa)
      `)
      .eq("escola_id", escolaId)
      .in(
        "matricula_id",
        normalizeMatriculas(aluno.matriculas).map((m) => m.id)
      )
      .order("ano_referencia", { ascending: false })
      .order("mes_referencia", { ascending: false });

    query = applyKf2ListInvariants(query, { defaultLimit: 200 });

    const { data: mensalidadesData, error: mensalidadesError } = await query;

    if (mensalidadesError) {
      return NextResponse.json(
        { ok: false, error: mensalidadesError.message },
        { status: 500 }
      );
    }

    const mensalidades = (mensalidadesData ?? []) as unknown as MensalidadeRow[];

    // 3. Gerar PDF
    const verificationToken = randomUUID();
    const pdfBytes = (await createInstitutionalPdf({
      title: "Extrato Financeiro do Aluno",
      school: {
        name: escola?.nome ?? "Escola",
        nif: escola?.nif,
        address: escola?.endereco,
        logoUrl: escola?.logo_url,
      },
      verificationToken,
      content: async ({
        page,
        pdfDoc,
        width,
        height,
        margin,
        contentStartY,
        font,
        boldFont,
        verificationUrl,
      }) => {
        let cursorY = contentStartY;
        const lineHeight = 16;

        // Info do Aluno
        const profile = normalizeProfile(aluno.profiles);
        const matriculaAtiva = normalizeMatriculas(aluno.matriculas).find(
          (m) => m.status === "ativo" || m.status === "ativa"
        );
        const turma = normalizeTurma(matriculaAtiva?.turma);

        page.drawText(`Aluno: ${aluno.nome ?? "—"}`, {
          x: margin,
          y: cursorY,
          font: boldFont,
          size: 11,
        });
        cursorY -= lineHeight;

        page.drawText(
          `Processo: ${profile?.numero_processo_login ?? "—"}  •  Documento: ${aluno.bi_numero ?? "—"}`,
          { x: margin, y: cursorY, font, size: 10 }
        );
        cursorY -= lineHeight;

        if (turma) {
          page.drawText(
            `Turma: ${turma.nome ?? "—"}  •  Classe: ${turma.classe?.nome ?? "—"}  •  Turno: ${turma.turno ?? "—"}`,
            { x: margin, y: cursorY, font, size: 10 }
          );
          cursorY -= lineHeight;
        }

        cursorY -= 20;

        // Tabela de Mensalidades
        const tableHeaderY = cursorY;
        const colWidths = [60, 180, 80, 80, 100];
        const headers = ["Mês/Ano", "Descrição", "Vencimento", "Valor", "Status"];

        const drawRow = (y: number, cols: string[], isHeader = false) => {
          let currentX = margin;
          cols.forEach((text, i) => {
            page.drawText(text, {
              x: currentX,
              y: y,
              font: isHeader ? boldFont : font,
              size: 9,
            });
            currentX += colWidths[i];
          });
        };

        drawRow(tableHeaderY, headers, true);
        page.drawLine({
          start: { x: margin, y: tableHeaderY - 5 },
          end: { x: width - margin, y: tableHeaderY - 5 },
          thickness: 1,
          color: rgb(0.8, 0.8, 0.8),
        });

        cursorY -= 20;

        const formatCurrency = (val: number | null | undefined) =>
          val ? new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA" }).format(val) : "—";

        const mesNome = (m: number | null | undefined) => {
          if (!m) return "";
          return [
            "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
            "Jul", "Ago", "Set", "Out", "Nov", "Dez"
          ][m - 1];
        };

        mensalidades.forEach((m) => {
          if (cursorY < margin + 100) return; // Simplified pagination skip for this prototype

          const row = [
            `${mesNome(m.mes_referencia)}/${m.ano_referencia ?? "—"}`,
            m.observacoes || "Propina Mensal",
            m.data_vencimento ? new Date(m.data_vencimento).toLocaleDateString("pt-PT") : "—",
            formatCurrency(m.valor_previsto),
            (m.status ?? "Pendente").toUpperCase(),
          ];

          drawRow(cursorY, row);
          cursorY -= 14;
        });

        cursorY -= 30;

        // Resumo
        const totalPago = mensalidades.reduce((acc, m) => acc + (m.valor_pago_total ?? 0), 0);
        const totalPendente = mensalidades
          .filter((m) => m.status !== "pago" && m.status !== "liquidado")
          .reduce((acc, m) => acc + (m.valor_previsto ?? 0), 0);

        page.drawText(`Resumo Financeiro`, {
          x: margin,
          y: cursorY,
          font: boldFont,
          size: 11,
        });
        cursorY -= lineHeight;

        page.drawText(`Total Pago: ${formatCurrency(totalPago)}`, {
          x: margin,
          y: cursorY,
          font,
          size: 10,
        });
        cursorY -= lineHeight;

        page.drawText(`Total em Aberto: ${formatCurrency(totalPendente)}`, {
          x: margin,
          y: cursorY,
          font,
          size: 10,
          color: totalPendente > 0 ? rgb(0.8, 0, 0) : rgb(0, 0, 0),
        });
        cursorY -= lineHeight;

        if (verificationUrl) {
          const qrSize = 80;
          const qrImage = await createQrImage(pdfDoc, verificationUrl);
          const qrX = width - margin - qrSize;
          const qrY = Math.max(cursorY - qrSize - lineHeight, margin + 30);

          page.drawImage(qrImage, {
            x: qrX,
            y: qrY,
            width: qrSize,
            height: qrSize,
          });

          const signatureY = qrY + qrSize + 10;
          page.drawText(
            buildSignatureLine({
              signerName: escola?.responsavel ?? escola?.diretor_nome ?? undefined,
              signerRole: undefined,
            }),
            {
              x: margin,
              y: signatureY,
              font,
              size: 11,
            }
          );
        } else {
          const signatureY = cursorY - 10;
          page.drawText(
            buildSignatureLine({
              signerName: undefined,
              signerRole: undefined,
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
    })) as Uint8Array;

    return new NextResponse(pdfBytes as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="extrato_financeiro_${aluno.nome ?? "aluno"}.pdf"`,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { createInstitutionalPdf } from "@/lib/pdf/documentTemplate";
import { buildSignatureLine, createQrImage } from "@/lib/pdf/qr";

interface PaymentRow {
  valor_pago: number | null;
  metodo_pagamento: string | null;
  data_pagamento: string | null;
  referencia_externa?: string | null;
}

interface MensalidadeRow {
  id: string;
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
  numero_login?: string | null;
}

interface TurmaRow {
  id: string;
  nome?: string | null;
  codigo?: string | null;
  classe?: string | null;
  turno?: string | null;
  periodo?: string | null;
  school_sessions?: {
    id: string;
    nome?: string | null;
    ano?: number | null;
  } | null;
}

interface MatriculaRow {
  id: string;
  ano_letivo?: number | null;
  status?: string | null;
  numero_matricula?: string | null;
  turma?: TurmaRow | TurmaRow[] | null;
}

interface EscolaRow {
  id: string;
  nome?: string | null;
  nif?: string | null;
  numero_fiscal?: string | null;
  endereco?: string | null;
  morada?: string | null;
  telefone?: string | null;
  email?: string | null;
  logo_url?: string | null;
  logo?: string | null;
  validation_base_url?: string | null;
  diretor_nome?: string | null;
  diretor_cargo?: string | null;
  responsavel?: string | null;
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

export async function GET(_req: Request, { params }: { params: { alunoId: string } }) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const alunoId = params.alunoId;

    const { data: alunoRow, error: alunoError } = await supabase
      .from("alunos")
      .select(
        `
        id,
        nome,
        bi_numero,
        telefone,
        email,
        responsavel,
        telefone_responsavel,
        escola_id,
        profiles:profiles!alunos_profile_id_fkey (
          id,
          numero_login
        ),
        matriculas:matriculas (
          id,
          ano_letivo,
          status,
          numero_matricula,
          turma:turmas (
            id,
            nome,
            codigo,
            classe,
            turno,
            periodo,
            school_sessions (
              id,
              nome,
              ano
            )
          )
        ),
        escolas:escolas (
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
          diretor_nome,
          diretor_cargo,
          responsavel
        )
      `
      )
      .eq("id", alunoId)
      .maybeSingle<AlunoRow>();

    if (alunoError || !alunoRow) {
      return NextResponse.json({ ok: false, error: "Aluno não encontrado" }, { status: 404 });
    }

    const aluno = alunoRow as AlunoRow;
    const escola = aluno.escolas;
    const profile = normalizeProfile(aluno.profiles);
    const matriculas = normalizeMatriculas(aluno.matriculas);
    const matriculaAtual = matriculas.sort((a, b) => (b.ano_letivo ?? 0) - (a.ano_letivo ?? 0))[0];
    const turmaAtual = normalizeTurma(matriculaAtual?.turma);

    const { data: mensalidades, error: mensError } = await supabase
      .from("mensalidades")
      .select(
        `
        id,
        ano_letivo,
        mes_referencia,
        ano_referencia,
        data_vencimento,
        data_pagamento_efetiva,
        valor_previsto,
        valor_pago_total,
        status,
        observacoes,
        pagamentos:pagamentos (
          id,
          valor_pago,
          metodo_pagamento,
          data_pagamento,
          referencia_externa
        )
      `
      )
      .eq("aluno_id", alunoId)
      .order("data_vencimento", { ascending: true })
      .returns<MensalidadeRow[]>();

    if (mensError) {
      return NextResponse.json(
        { ok: false, error: "Erro ao carregar mensalidades", details: mensError.message },
        { status: 500 }
      );
    }

    const parcelas = (mensalidades ?? []).map((m) => {
      const valorPrevisto = Number(m.valor_previsto ?? 0);
      const valorPago = Number(m.valor_pago_total ?? 0);
      const emAberto = Math.max(0, valorPrevisto - valorPago);

      const pagamentos = normalizePagamentos(m.pagamentos);
      const ultimoPagamento = pagamentos
        .slice()
        .sort(
          (a, b) =>
            new Date(b.data_pagamento ?? 0).getTime() - new Date(a.data_pagamento ?? 0).getTime()
        )[0];

      return {
        id: m.id,
        anoLetivo: m.ano_letivo,
        mesReferencia: m.mes_referencia,
        anoReferencia: m.ano_referencia,
        dataVencimento: m.data_vencimento,
        dataPagamentoEfetiva: m.data_pagamento_efetiva,
        valorPrevisto,
        valorPagoTotal: valorPago,
        valorEmAberto: emAberto,
        status: m.status,
        observacoes: m.observacoes,
        ultimoPagamento: ultimoPagamento
          ? {
              valorPago: Number(ultimoPagamento.valor_pago ?? 0),
              metodoPagamento: ultimoPagamento.metodo_pagamento,
              dataPagamento: ultimoPagamento.data_pagamento,
              referenciaExterna: ultimoPagamento.referencia_externa,
            }
          : null,
      };
    });

    const resumo = parcelas.reduce(
      (acc, p) => {
        acc.totalPrevisto += p.valorPrevisto;
        acc.totalPago += p.valorPagoTotal;
        acc.totalEmAberto += p.valorEmAberto;
        if (p.status === "pendente" || p.status === "pago_parcial") {
          acc.qtdEmAberto += 1;
        }
        if (p.status === "pago") {
          acc.qtdQuitadas += 1;
        }
        return acc;
      },
      {
        totalPrevisto: 0,
        totalPago: 0,
        totalEmAberto: 0,
        qtdEmAberto: 0,
        qtdQuitadas: 0,
      }
    );

    const verificationToken = randomUUID();
    const validationBase = process.env.NEXT_PUBLIC_VALIDATION_BASE_URL ?? escola?.validation_base_url ?? undefined;

    const pdfBytes = await createInstitutionalPdf({
      title: "Extrato de Pagamentos / Propinas",
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

        const draw = (text: string, opts?: { bold?: boolean; size?: number }) => {
          const size = opts?.size ?? 11;
          const isBold = opts?.bold ?? false;
          page.drawText(text, {
            x: margin,
            y: cursorY,
            font: isBold ? boldFont : font,
            size,
          });
          cursorY -= lineHeight;
        };

        draw("Dados do aluno", { bold: true, size: 12 });
        draw(`Nome: ${aluno.nome ?? "—"}`);
        if (profile?.numero_login) {
          draw(`Número de aluno: ${profile.numero_login}`);
        }
        if (aluno.bi_numero) {
          draw(`Documento: ${aluno.bi_numero}`);
        }
        if (aluno.responsavel) {
          draw(
            `Encarregado: ${aluno.responsavel}${
              aluno.telefone_responsavel ? " • " + aluno.telefone_responsavel : ""
            }`
          );
        }

        cursorY -= lineHeight / 2;
        if (matriculaAtual) {
          draw("Dados acadêmicos", { bold: true, size: 12 });
          draw(`Turma: ${turmaAtual?.nome ?? turmaAtual?.codigo ?? "—"} • Classe: ${turmaAtual?.classe ?? "—"}`);
          draw(
            `Ano letivo: ${
              turmaAtual?.school_sessions?.nome ??
              turmaAtual?.school_sessions?.ano ??
              matriculaAtual.ano_letivo ??
              "—"
            }`
          );
          draw(`Status da matrícula: ${matriculaAtual.status ?? "—"}`);
        }

        cursorY -= lineHeight;

        draw("Resumo financeiro", { bold: true, size: 12 });
        draw(
          `Total previsto: ${resumo.totalPrevisto.toLocaleString("pt-AO", {
            style: "currency",
            currency: "AOA",
          })}`
        );
        draw(
          `Total pago: ${resumo.totalPago.toLocaleString("pt-AO", {
            style: "currency",
            currency: "AOA",
          })}`
        );
        draw(
          `Em aberto: ${resumo.totalEmAberto.toLocaleString("pt-AO", {
            style: "currency",
            currency: "AOA",
          })}`
        );
        draw(`Parcelas quitadas: ${resumo.qtdQuitadas} • Em aberto: ${resumo.qtdEmAberto}`);

        cursorY -= lineHeight;

        draw("Detalhe das mensalidades", { bold: true, size: 12 });
        cursorY -= 4;

        const headerY = cursorY;
        const colX = {
          competencia: margin,
          vencimento: margin + 130,
          valor: margin + 220,
          pago: margin + 320,
          status: margin + 420,
        };

        const drawSmall = (text: string, x: number, y: number, bold = false) => {
          page.drawText(text, {
            x,
            y,
            font: bold ? boldFont : font,
            size: 9,
          });
        };

        drawSmall("Comp.", colX.competencia, headerY, true);
        drawSmall("Venc.", colX.vencimento, headerY, true);
        drawSmall("Valor", colX.valor, headerY, true);
        drawSmall("Pago", colX.pago, headerY, true);
        drawSmall("Status", colX.status, headerY, true);

        cursorY = headerY - lineHeight;

        const maxRows = 22;
        const rows = parcelas.slice(0, maxRows);

        for (const p of rows) {
          if (cursorY < margin + 40) break;

          const competenciaLabel =
            (p.mesReferencia ? String(p.mesReferencia).padStart(2, "0") + "/" : "") +
            (p.anoReferencia ?? p.anoLetivo ?? "");
          const venc = p.dataVencimento
            ? new Date(p.dataVencimento).toLocaleDateString("pt-AO")
            : "—";

          drawSmall(competenciaLabel || "—", colX.competencia, cursorY);
          drawSmall(venc, colX.vencimento, cursorY);
          drawSmall(
            p.valorPrevisto.toLocaleString("pt-AO", {
              style: "currency",
              currency: "AOA",
            }),
            colX.valor,
            cursorY
          );
          drawSmall(
            p.valorPagoTotal.toLocaleString("pt-AO", {
              style: "currency",
              currency: "AOA",
            }),
            colX.pago,
            cursorY
          );
          drawSmall(p.status ?? "—", colX.status, cursorY);

          cursorY -= lineHeight;
        }

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
              signerRole: escola?.diretor_cargo ?? undefined,
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
              signerName: escola?.responsavel ?? escola?.diretor_nome ?? undefined,
              signerRole: escola?.diretor_cargo ?? undefined,
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
        "Content-Disposition": `attachment; filename="extrato_financeiro_${aluno.nome ?? "aluno"}.pdf"`,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[financeiro/extrato/aluno/pdf] fatal", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

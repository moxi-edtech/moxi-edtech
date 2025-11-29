import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";

interface PaymentRow {
  valor_pago: number | null;
  metodo_pagamento: string | null;
  data_pagamento: string | null;
  conciliado?: boolean | null;
  referencia_externa?: string | null;
}

interface MensalidadeRow {
  id: string;
  escola_id?: string | null;
  aluno_id?: string | null;
  turma_id?: string | null;
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
  classe?: string | null;
  turno?: string | null;
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
  telefone?: string | null;
  email?: string | null;
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
            classe,
            turno,
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
          telefone,
          email
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

    const matriculaAtual =
      matriculas.sort((a, b) => (b.ano_letivo ?? 0) - (a.ano_letivo ?? 0))[0] ?? null;

    const { data: mensalidades, error: mensError } = await supabase
      .from("mensalidades")
      .select(
        `
        id,
        escola_id,
        aluno_id,
        turma_id,
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
          conciliado,
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
              conciliado: ultimoPagamento.conciliado,
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

    const turmaNormalized = matriculaAtual?.turma
      ? normalizeTurma(matriculaAtual.turma)
      : null;

    return NextResponse.json(
      {
        ok: true,
        aluno: {
          id: aluno.id,
          nome: aluno.nome,
          numeroLogin: profile?.numero_login ?? null,
          bi: aluno.bi_numero ?? null,
          telefone: aluno.telefone ?? null,
          email: aluno.email ?? null,
          responsavel: aluno.responsavel ?? null,
          telefoneResponsavel: aluno.telefone_responsavel ?? null,
        },
        escola: {
          id: escola?.id ?? null,
          nome: escola?.nome ?? null,
          nif: escola?.nif ?? escola?.numero_fiscal ?? null,
          telefone: escola?.telefone ?? null,
          email: escola?.email ?? null,
        },
        matriculaAtual: matriculaAtual
          ? {
              id: matriculaAtual.id,
              anoLetivo: matriculaAtual.ano_letivo,
              status: matriculaAtual.status,
              numeroMatricula: matriculaAtual.numero_matricula,
              turma: turmaNormalized
                ? {
                    id: turmaNormalized.id,
                    nome: turmaNormalized.nome ?? null,
                    classe: turmaNormalized.classe ?? null,
                    turno: turmaNormalized.turno ?? null,
                    anoLetivoLabel:
                      turmaNormalized.school_sessions?.nome ?? turmaNormalized.school_sessions?.ano ?? null,
                  }
                : null,
            }
          : null,
        resumo,
        parcelas,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[financeiro/extrato/aluno] fatal", message);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao carregar extrato financeiro do aluno." },
      { status: 500 }
    );
  }
}

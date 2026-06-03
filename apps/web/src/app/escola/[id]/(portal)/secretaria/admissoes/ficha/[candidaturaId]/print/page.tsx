import PrintTrigger from "@/app/secretaria/admissoes/ficha/[id]/print/PrintTrigger";
import { createClient } from "@/lib/supabase/server";
import styles from "@/app/secretaria/admissoes/ficha/[id]/print/print.module.css";

type CandidaturaRow = {
  id: string;
  escola_id: string;
  nome_candidato: string | null;
  dados_candidato: unknown;
  expires_at: string | null;
  aluno_id: string | null;
  cursos?: { nome?: string | null } | null;
  classes?: { nome?: string | null } | null;
};

type AlunoRow = { id: string; nome: string | null; bi_numero: string | null };

async function getCandidaturaData(id: string) {
  const supabase = await createClient();

  const { data: candidatura, error } = await supabase
    .from("candidaturas")
    .select("id, escola_id, nome_candidato, dados_candidato, expires_at, aluno_id, cursos(nome), classes(nome)")
    .eq("id", id)
    .single();

  if (error || !candidatura) {
    console.error("Error fetching candidatura for print:", error);
    return null;
  }

  let aluno: AlunoRow | null = null;
  if (candidatura.aluno_id) {
    const { data: alunoData } = await supabase
      .from("alunos")
      .select("id, nome, bi_numero")
      .eq("id", candidatura.aluno_id)
      .maybeSingle();
    aluno = (alunoData as AlunoRow | null) ?? null;
  }

  const { data: escola } = await supabase
    .from("escolas")
    .select("nome, dados_pagamento")
    .eq("id", candidatura.escola_id)
    .maybeSingle();

  const rawPagamento = escola?.dados_pagamento as Record<string, unknown> | null;
  const dadosPagamento = rawPagamento ? {
    iban: typeof rawPagamento.iban === 'string' ? rawPagamento.iban : undefined,
    banco: typeof rawPagamento.banco === 'string' ? rawPagamento.banco : undefined,
    kwik_chave: typeof rawPagamento.kwik_chave === 'string' ? rawPagamento.kwik_chave : undefined,
  } : null;

  return {
    candidatura: candidatura as CandidaturaRow,
    aluno,
    escolaNome: escola?.nome ?? "Escola",
    dadosPagamento,
  };
}

function formatDate(date: Date) {
  try {
    return date.toLocaleDateString("pt-PT");
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function formatDateTime(value: string | null) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

export default async function FichaPreInscricaoPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getCandidaturaData(id);

  if (!data) {
    return <div className="p-8">Candidatura não encontrada.</div>;
  }

  const { candidatura, aluno, escolaNome, dadosPagamento } = data;
  const dados = candidatura.dados_candidato as Record<string, any> | null;
  const nome = candidatura.nome_candidato || aluno?.nome || "—";
  const biNumero = dados?.bi_numero || aluno?.bi_numero || "—";
  const cursoNome = candidatura.cursos?.nome || "—";
  const classeNome = candidatura.classes?.nome || "—";
  const reservaExpiraEm = formatDateTime(candidatura.expires_at);

  return (
    <div className={`bg-slate-100 min-h-screen print:bg-white ${styles.printRoot}`}>
      <PrintTrigger />

      <div className={`${styles.sheet} text-black shadow-lg print:shadow-none`}>
        <div className="space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{escolaNome}</h1>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Ficha de Pré-Inscrição
            </p>
            <p className="text-xs text-slate-500">Data: {formatDate(new Date())}</p>
          </div>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Dados do Candidato</h2>
            <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 px-4 py-3">
                <p className="text-xs uppercase text-slate-400">Nome</p>
                <p className="font-semibold text-slate-800">{nome}</p>
              </div>
              <div className="rounded-lg border border-slate-200 px-4 py-3">
                <p className="text-xs uppercase text-slate-400">Nº do BI</p>
                <p className="font-semibold text-slate-800">{biNumero}</p>
              </div>
              <div className="rounded-lg border border-slate-200 px-4 py-3">
                <p className="text-xs uppercase text-slate-400">Curso Pretendido</p>
                <p className="font-semibold text-slate-800">{cursoNome}</p>
              </div>
              <div className="rounded-lg border border-slate-200 px-4 py-3">
                <p className="text-xs uppercase text-slate-400">Classe Pretendida</p>
                <p className="font-semibold text-slate-800">{classeNome}</p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Resumo Financeiro</h2>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-5 py-4 text-sm">
              <p className="font-semibold text-slate-800">Valor da Matrícula: Consultar Secretaria</p>
              <p className="text-xs text-slate-500 mt-2">
                Pagamento necessário para confirmar a matrícula.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Dados Bancários</h2>
            <div className="rounded-lg border border-slate-200 px-5 py-4 text-sm">
              <p className="text-slate-700">IBAN: {dadosPagamento?.iban || "AO06 0000 0000 0000 0000 0000 0"}</p>
              <p className="text-slate-700">Banco: {dadosPagamento?.banco || "Banco Parceiro"}</p>
              {dadosPagamento?.kwik_chave ? <p className="text-slate-700">KWIK: {dadosPagamento.kwik_chave}</p> : null}
              <p className="text-slate-700">Referência: Pré-inscrição</p>
            </div>
          </section>

          <section className="space-y-3 border-t border-slate-200 pt-6 text-sm">
            <p className="font-semibold text-slate-800">
              {reservaExpiraEm ? `Vaga reservada até ${reservaExpiraEm}.` : "Vaga reservada com prazo definido pela escola."}
            </p>
            <p className="text-slate-600">
              Esta ficha não garante a matrícula até a confirmação do pagamento.
            </p>
            <div className="mt-8">
              <p className="text-xs text-slate-500">Assinatura do funcionário</p>
              <div className="mt-4 h-10 border-b border-slate-300" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

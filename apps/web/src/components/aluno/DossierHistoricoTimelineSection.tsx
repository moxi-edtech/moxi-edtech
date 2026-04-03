"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, CalendarCheck, CircleAlert, Eye, Wallet } from "lucide-react";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatDate, formatKwanza } from "@/lib/formatters";
import type { DossierRole } from "@/components/aluno/DossierAcoes";

type TimelineDisciplina = {
  disciplina_id: string | null;
  disciplina_nome: string | null;
  media_final: number | null;
  resultado: string | null;
  em_risco?: boolean | null;
};

type TimelinePagamento = {
  pagamento_id: string;
  data_pagamento: string | null;
  valor_pago: number | null;
  metodo: string | null;
  status: string | null;
};

type TimelineAno = {
  ano_letivo: number;
  ano_letivo_id: string | null;
  matricula: {
    matricula_id: string | null;
    numero_matricula: string | null;
    status: string | null;
    data_matricula: string | null;
  };
  academico: {
    media_geral: number | null;
    estado_final: string | null;
    disciplinas_chave: TimelineDisciplina[];
  };
  presenca: {
    fonte: string;
    faltas: number;
    presencas: number;
    aulas_previstas: number;
    frequencia_min_percent: number | null;
    percentual_presenca: number | null;
  };
  financeiro: {
    total_previsto: number;
    total_pago: number;
    total_em_atraso: number;
    mensalidades_em_atraso: number;
    ultimos_pagamentos: TimelinePagamento[];
  };
};

function detalheAnoHref(role: DossierRole, alunoId: string, ano: number, escolaId?: string | null) {
  if (role === "admin" && escolaId) {
    return `/escola/${escolaId}/admin/alunos/${alunoId}?tab=historico&ano=${ano}`;
  }
  return `/secretaria/alunos/${alunoId}?tab=historico&ano=${ano}`;
}

function Pill({ label, risk = false }: { label: string; risk?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
        risk
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      {label}
    </span>
  );
}

function formatPresencaFonteLabel(fonte: string | null | undefined) {
  const key = (fonte ?? "").trim().toLowerCase();
  if (!key) return "Dados de presença da escola";
  if (key === "fallback_frequencias") {
    return "Registros de frequência lançados pela secretaria/professor";
  }
  return fonte ?? "Dados de presença da escola";
}

export function DossierHistoricoTimelineSection({
  alunoId,
  role,
  escolaId,
}: {
  alunoId: string;
  role: DossierRole;
  escolaId?: string | null;
}) {
  const [timeline, setTimeline] = useState<TimelineAno[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/secretaria/alunos/${alunoId}/timeline-360`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error ?? "Falha ao carregar timeline 360.");
        }
        if (!alive) return;
        setTimeline(Array.isArray(json.timeline) ? json.timeline : []);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Erro desconhecido.");
        setTimeline([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, [alunoId]);

  const cards = useMemo(() => timeline, [timeline]);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Percurso académico 360º</p>
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="animate-pulse rounded-xl border border-slate-200 p-3 sm:p-4">
              <div className="mb-3 h-4 w-32 rounded-full bg-slate-200" />
              <div className="grid gap-2 md:grid-cols-3">
                <div className="h-12 sm:h-16 rounded-xl bg-slate-100" />
                <div className="h-12 sm:h-16 rounded-xl bg-slate-100" />
                <div className="h-12 sm:h-16 rounded-xl bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
        <p className="flex items-center gap-2 font-semibold">
          <CircleAlert size={16} /> Falha ao carregar timeline anual
        </p>
        <p className="mt-1 text-xs">{error}</p>
      </div>
    );
  }

  if (!cards.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
        <BookOpen className="mx-auto mb-2 text-slate-400" size={18} />
        Sem dados anuais para este aluno.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Percurso académico 360º</p>
        <div className="space-y-3">
          {cards.map((ano) => {
            const presencaAtual = typeof ano.presenca.percentual_presenca === "number" ? ano.presenca.percentual_presenca : null;
            const minimo = typeof ano.presenca.frequencia_min_percent === "number" ? ano.presenca.frequencia_min_percent : 75;
            const presencaOk = presencaAtual == null ? null : presencaAtual >= minimo;
            const saldoAtraso = ano.financeiro.total_em_atraso;
            const disciplinas = Array.isArray(ano.academico.disciplinas_chave) ? ano.academico.disciplinas_chave : [];
            const risco = disciplinas.filter((d) => d.em_risco);
            const top = disciplinas.filter((d) => !d.em_risco).slice(0, 3);

            return (
              <article key={ano.ano_letivo} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#1F6B3B]">Ano letivo {ano.ano_letivo}</p>
                    <p className="text-xs text-slate-500">
                      Matrícula {ano.matricula.numero_matricula ?? "—"} · {formatDate(ano.matricula.data_matricula)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {ano.matricula.status ? <StatusPill status={ano.matricula.status} variant="matricula" size="xs" /> : null}
                    <Link
                      href={detalheAnoHref(role, alunoId, ano.ano_letivo, escolaId)}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-[#E3B23C] hover:text-[#E3B23C]"
                    >
                      <Eye size={16} /> Ver detalhe do ano
                    </Link>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Resumo académico</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">Média: {ano.academico.media_geral ?? "—"}</p>
                    <p className="text-xs text-slate-500">Resultado final: {ano.academico.estado_final ?? "—"}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {top.map((d) => (
                        <Pill key={`${ano.ano_letivo}-${d.disciplina_id ?? d.disciplina_nome}`} label={d.disciplina_nome ?? "Disciplina"} />
                      ))}
                      {risco.slice(0, 2).map((d) => (
                        <Pill key={`${ano.ano_letivo}-risk-${d.disciplina_id ?? d.disciplina_nome}`} label={`${d.disciplina_nome ?? "Disciplina"} em risco`} risk />
                      ))}
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Resumo de presença</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {ano.presenca.faltas} falta(s) · {presencaAtual == null ? "—" : `${presencaAtual}%`}
                    </p>
                    <p className="mt-1 text-xs">
                      <span className={presencaOk == null ? "text-slate-500" : presencaOk ? "text-[#1F6B3B]" : "text-red-600"}>
                        {presencaOk == null ? "Sem base para comparação" : presencaOk ? "Acima do mínimo" : "Abaixo do mínimo"}
                      </span>
                      <span className="text-slate-500"> · mínimo {minimo}%</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500 flex items-center gap-1"><CalendarCheck size={14} /> Fonte: {formatPresencaFonteLabel(ano.presenca.fonte)}</p>
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Resumo financeiro</p>
                    <p className="mt-1 text-xs text-slate-600">Previsto: <span className="font-semibold text-slate-900">{formatKwanza(ano.financeiro.total_previsto)}</span></p>
                    <p className="text-xs text-slate-600">Pago: <span className="font-semibold text-[#1F6B3B]">{formatKwanza(ano.financeiro.total_pago)}</span></p>
                    <p className="text-xs text-slate-600">Atraso: <span className={saldoAtraso > 0 ? "font-semibold text-red-600" : "font-semibold text-slate-900"}>{formatKwanza(saldoAtraso)}</span></p>
                    <p className="mt-1 text-xs text-slate-500 flex items-center gap-1"><Wallet size={14} /> Últimos pagamentos</p>
                    <ul className="mt-1 space-y-1">
                      {(ano.financeiro.ultimos_pagamentos ?? []).slice(0, 2).map((pag) => (
                        <li key={pag.pagamento_id} className="text-xs text-slate-600">
                          {formatDate(pag.data_pagamento)} · {formatKwanza(pag.valor_pago ?? 0)}
                        </li>
                      ))}
                      {!(ano.financeiro.ultimos_pagamentos ?? []).length ? <li className="text-xs text-slate-400">Sem pagamentos registados.</li> : null}
                    </ul>
                  </section>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

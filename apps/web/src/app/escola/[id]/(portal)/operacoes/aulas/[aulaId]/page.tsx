"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BookOpen, CalendarDays, CheckCircle2, Download, FileText, Loader2, RefreshCw, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

type Report = {
  aula: { id: string; data: string; inicio_previsto: string | null; fim_previsto: string | null; status: string; resumo: string | null; observacoes: string | null; conteudo: string | null };
  turma: { nome: string } | null;
  disciplina: { nome: string } | null;
  professor: { nome_completo: string } | null;
  attendance: { presentes: number; faltas: number; atrasos: number; total: number };
  attendanceRows: { matricula_id: string; status: string; aluno: { nome?: string | null; nome_completo?: string | null; numero_processo?: string | null } | null }[];
  plano: { status: string; tema: string | null; objetivos: string | null; conteudos: string | null; metodologia: string | null; avaliacao: string | null; tarefa_casa: string | null } | null;
  atividades: { id: string; titulo: string; status: string | null; nota_maxima: number | null }[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "long" }).format(new Date(`${value}T12:00:00`));
}

function time(value: string | null) {
  return value ? value.slice(0, 5) : "--:--";
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className={`rounded-xl border p-4 ${tone}`}><p className="text-2xl font-black">{value}</p><p className="mt-1 text-xs font-semibold opacity-75">{label}</p></div>;
}

export default function RelatorioAulaPage() {
  const params = useParams<{ id: string; aulaId: string }>();
  const escolaId = params?.id ?? "";
  const aulaId = params?.aulaId ?? "";
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pdfState, setPdfState] = useState<"idle" | "loading" | "error">("idle");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/secretaria/aulas/${aulaId}/relatorio`, { cache: "no-store" });
      const payload = await response.json() as { ok?: boolean; report?: Report; error?: string };
      if (!response.ok || !payload.ok || !payload.report) throw new Error(payload.error ?? "Não foi possível carregar o relatório.");
      setReport(payload.report);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar o relatório.");
    } finally {
      setLoading(false);
    }
  }, [aulaId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const exportPdf = async () => {
    setPdfState("loading");
    try {
      const response = await fetch(`/api/secretaria/aulas/${aulaId}/relatorio/pdf`, { cache: "no-store" });
      if (!response.ok) throw new Error("Não foi possível gerar o PDF.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `relatorio-aula-${aulaId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setPdfState("idle");
    } catch {
      setPdfState("error");
    }
  };

  if (loading) return <main className="mx-auto max-w-6xl p-6"><div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-8 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> A carregar o relatório...</div></main>;
  if (error || !report) return <main className="mx-auto max-w-6xl space-y-5 p-6"><Link href={`/escola/${escolaId}/operacoes/dashboard`} className="inline-flex items-center gap-2 text-sm font-bold text-klasse-blue-700"><ArrowLeft className="h-4 w-4" /> Voltar para Operações</Link><div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700"><p>{error ?? "Relatório não encontrado."}</p><button type="button" onClick={() => void load()} className="mt-3 rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white hover:bg-rose-800">Tentar novamente</button></div></main>;

  const { aula, attendance, attendanceRows, turma, disciplina, professor, plano, atividades } = report;
  return <main className="mx-auto max-w-6xl space-y-6 p-6">
    <DashboardHeader title="Relatório da aula" description="Resumo operacional e pedagógico recebido pela escola." breadcrumbs={[{ label: "Início", href: `/escola/${escolaId}` }, { label: "Operações", href: `/escola/${escolaId}/operacoes/dashboard` }, { label: "Relatório da aula" }]} />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link href={`/escola/${escolaId}/operacoes/dashboard`} className="inline-flex items-center gap-2 text-sm font-bold text-klasse-blue-700"><ArrowLeft className="h-4 w-4" /> Voltar para Operações</Link>
      <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => void refresh()} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Atualizar</button><button type="button" onClick={() => void exportPdf()} disabled={pdfState === "loading"} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700 disabled:opacity-60"><Download className="h-4 w-4" /> {pdfState === "loading" ? "A gerar PDF..." : "Exportar PDF"}</button></div>
    </div>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-bold text-klasse-blue-700">{turma?.nome ?? "Turma não identificada"}</p><h1 className="mt-1 text-2xl font-black text-slate-900">{disciplina?.nome ?? "Disciplina não identificada"}</h1><p className="mt-2 text-sm text-slate-500">{formatDate(aula.data)} · {time(aula.inicio_previsto)}–{time(aula.fim_previsto)} · {professor?.nome_completo ?? "Professor não identificado"}</p></div><span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> {aula.status}</span></div>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4"><Stat label="Presentes" value={attendance.presentes} tone="border-emerald-100 bg-emerald-50 text-emerald-800" /><Stat label="Faltas" value={attendance.faltas} tone="border-rose-100 bg-rose-50 text-rose-800" /><Stat label="Atrasos" value={attendance.atrasos} tone="border-amber-100 bg-amber-50 text-amber-800" /><Stat label="Registos" value={attendance.total} tone="border-slate-200 bg-slate-50 text-slate-800" /></div>
    </section>
    <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
      <div className="space-y-6"><section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"><div className="flex items-center gap-2"><FileText className="h-5 w-5 text-klasse-blue-700" /><h2 className="text-lg font-black text-slate-900">Registo do professor</h2></div>{[["Conteúdo", aula.conteudo], ["Resumo", aula.resumo], ["Observações", aula.observacoes]].map(([label, value]) => <div key={label}><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{value || "Não informado."}</p></div>)}</section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"><div className="flex items-center gap-2"><Users className="h-5 w-5 text-klasse-blue-700" /><h2 className="text-lg font-black text-slate-900">Frequência nominal</h2></div>{attendanceRows.length ? <div className="mt-4 divide-y divide-slate-100">{attendanceRows.map((row) => <div key={row.matricula_id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-bold text-slate-800">{row.aluno?.nome_completo || row.aluno?.nome || "Aluno não identificado"}</p>{row.aluno?.numero_processo && <p className="text-xs text-slate-500">{row.aluno.numero_processo}</p>}</div><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${row.status === "presente" ? "bg-emerald-50 text-emerald-700" : row.status === "atraso" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>{row.status}</span></div>)}</div> : <p className="mt-4 text-sm text-slate-500">A chamada ainda não foi lançada. Quando o professor concluir, os alunos aparecerão aqui.</p>}</section></div>
      <div className="space-y-6"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-klasse-blue-700" /><h2 className="text-lg font-black text-slate-900">Plano de aula</h2></div>{plano && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">{plano.status}</span>}</div>{plano ? <div className="mt-4 space-y-3 text-sm text-slate-700"><p><span className="font-bold">Tema:</span> {plano.tema || "Não informado."}</p><p><span className="font-bold">Objetivos:</span> {plano.objetivos || "Não informado."}</p><p><span className="font-bold">Conteúdos:</span> {plano.conteudos || "Não informado."}</p></div> : <p className="mt-4 text-sm text-slate-500">Nenhum plano associado a esta aula.</p>}</section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"><div className="flex items-center gap-2"><Users className="h-5 w-5 text-klasse-blue-700" /><h2 className="text-lg font-black text-slate-900">Atividades</h2></div>{atividades.length ? <div className="mt-4 space-y-2">{atividades.map((item) => <div key={item.id} className="rounded-xl bg-slate-50 p-3"><p className="text-sm font-bold text-slate-800">{item.titulo}</p><p className="mt-1 text-xs text-slate-500">{item.status || "Sem estado"}{item.nota_maxima ? ` · ${item.nota_maxima} pontos` : ""}</p></div>)}</div> : <p className="mt-4 text-sm text-slate-500">Nenhuma atividade associada.</p>}</section></div>
    </div>
    {pdfState === "error" && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Não foi possível gerar o PDF. Verifique a ligação e tente novamente.</div>}
    <div className="flex items-center gap-2 text-xs text-slate-400"><CalendarDays className="h-4 w-4" /> Relatório vinculado à ocorrência específica da aula.</div>
  </main>;
}

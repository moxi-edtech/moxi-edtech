"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { enqueueOfflineAction } from '@/lib/offline/queue'
import { createIdempotencyKey } from '@/lib/idempotency'
import { useOfflineStatus } from '@/hooks/useOfflineStatus'
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { useToast } from '@/components/feedback/FeedbackSystem';
import { formatTurmaDisplayName } from "@/utils/formatters";
import { ACADEMIC_YEAR_PARAM } from "@/lib/academic-year/context";
import { useSearchParams } from "next/navigation";

import { Printer, CheckCircle2, XCircle, Clock, UserCheck, Search, RotateCcw } from 'lucide-react'

type Atrib = { id: string; turma: { id: string; nome: string | null }; disciplina: { id: string; nome: string | null } }
type Aluno = { id: string; nome: string }
type AlunoApi = { id?: string; aluno_id?: string; profile_id?: string; nome?: string; aluno_nome?: string }
type AttendanceStatus = 'presente' | 'falta' | 'atraso'

export default function ProfessorFrequenciasPage() {
  const { success, error, warning } = useToast();
  const [atribs, setAtribs] = useState<Atrib[]>([])
  const [turmaId, setTurmaId] = useState('')
  const [disciplinaId, setDisciplinaId] = useState('')
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [searchFilter, setSearchFilter] = useState('')
  const [data, setData] = useState(() => new Date().toISOString().slice(0,10))
  const [saving, setSaving] = useState(false)
  const [statusMap, setStatusMap] = useState<Record<string, 'presente'|'falta'|'atraso'>>({})
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'pending' | 'saved' | 'failed'>('idle')
  const [reportMonth, setReportMonth] = useState(() => (new Date().getMonth() + 1).toString().padStart(2, '0'))
  const { online } = useOfflineStatus()
  const searchParams = useSearchParams()
  const requestedAcademicYearId = searchParams?.get(ACADEMIC_YEAR_PARAM) ?? ""
  const [academicYearId, setAcademicYearId] = useState(requestedAcademicYearId)
  const [loadError, setLoadError] = useState<string | null>(null)
  const urlTurmaId = searchParams?.get("turma_id")
  const urlDisciplinaId = searchParams?.get("disciplina_id")

  useEffect(() => {
    (async () => {
      try {
        setLoadError(null)
        const res = await fetch('/api/professor/atribuicoes', { cache: 'no-store' })
        const json = await res.json().catch(()=>null)
        if (!res.ok || !json?.ok) {
          throw new Error(json?.message || json?.error || 'Não foi possível carregar o ano letivo ativo.')
        }
        const items = (json.items || []) as Atrib[]
        setAtribs(items)
        if (!requestedAcademicYearId && json.context?.anoLetivoId) setAcademicYearId(String(json.context.anoLetivoId))
        if (urlTurmaId && items.some(a => a.turma.id === urlTurmaId)) {
          setTurmaId(urlTurmaId)
          if (urlDisciplinaId && items.some(a => a.turma.id === urlTurmaId && a.disciplina.id === urlDisciplinaId)) {
            setDisciplinaId(urlDisciplinaId)
          }
        }
      } catch (cause) {
        setLoadError(cause instanceof Error ? cause.message : 'Não foi possível carregar o ano letivo ativo.')
      }
    })()
  }, [urlTurmaId, urlDisciplinaId, requestedAcademicYearId])

  useEffect(() => {
    (async () => {
      if (!turmaId) { setAlunos([]); return }
      const res = await fetch(`/api/professor/turmas/${turmaId}/alunos`, { cache: 'no-store' })
      const json = await res.json().catch(()=>null)
      if (res.ok && json?.ok) setAlunos((json.items as AlunoApi[] || []).map((r) => ({ id: r.id || r.aluno_id || r.profile_id || '', nome: r.nome || r.aluno_nome || 'Aluno' })).filter((r) => r.id))
    })()
  }, [turmaId])

  useEffect(() => {
    setSubmitStatus('idle')
  }, [turmaId, disciplinaId, data])

  const atribsByTurma = useMemo(() => atribs.reduce((acc, a) => {
    const arr = acc.get(a.turma.id) || []
    arr.push(a)
    acc.set(a.turma.id, arr)
    return acc
  }, new Map<string, Atrib[]>()), [atribs])

  const filteredAlunos = useMemo(() => {
    if (!searchFilter.trim()) return alunos;
    const q = searchFilter.toLowerCase();
    return alunos.filter((a) => a.nome.toLowerCase().includes(q));
  }, [alunos, searchFilter]);

  const stats = useMemo(() => {
    let presentes = 0;
    let faltas = 0;
    let atrasos = 0;
    for (const a of alunos) {
      const st = statusMap[a.id] || 'presente';
      if (st === 'presente') presentes++;
      else if (st === 'falta') faltas++;
      else if (st === 'atraso') atrasos++;
    }
    return { presentes, faltas, atrasos, total: alunos.length };
  }, [alunos, statusMap]);

  const handleMarcarTodosPresentes = () => {
    const next: Record<string, 'presente'> = {};
    for (const a of alunos) next[a.id] = 'presente';
    setStatusMap(next);
    success("Presença em Lote", "Todos os alunos foram marcados como Presentes.");
  };

  const handleMarcarTodosFaltas = () => {
    const next: Record<string, 'falta'> = {};
    for (const a of alunos) next[a.id] = 'falta';
    setStatusMap(next);
  };

  const handleResetStatus = () => {
    setStatusMap({});
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (!turmaId || !disciplinaId) throw new Error('Selecione turma e disciplina.')
      if (!academicYearId) throw new Error('Ano letivo ativo não identificado. Atualize a página e tente novamente.')
      const presencas = alunos.map(a => ({ aluno_id: a.id, status: statusMap[a.id] || 'presente' }))
      const idempotencyKey = createIdempotencyKey(`presencas-${turmaId}-${disciplinaId}-${data}`)
      const request = {
        url: '/api/professor/presencas',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({ turma_id: turmaId, disciplina_id: disciplinaId, data, presencas, ano_letivo_id: academicYearId }),
        type: 'professor_presencas',
      }

      if (!online) {
        await enqueueOfflineAction(request)
        setSubmitStatus('pending')
        warning("Modo offline", "As presenças foram guardadas localmente e serão sincronizadas quando recuperar a ligação à internet.")
        return
      }

      const res = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      })
      const json = await res.json().catch(()=>null)
      if (!res.ok || !json?.ok) {
        setSubmitStatus('failed')
        throw new Error(json?.error || 'Falha ao salvar presença')
      }
      setSubmitStatus('saved')
      success("Presenças guardadas", "O registo de frequências foi actualizado com sucesso.")
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      if (!online) {
        setSubmitStatus('pending')
      } else {
        setSubmitStatus('failed')
        error("Erro ao guardar", message || "Não foi possível registar as presenças. Por favor, tente novamente.")
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-5 sm:p-6 space-y-4">
      <div className="mb-3 sm:mb-4">
        <DashboardHeader
          title="Frequências & Diário de Classe"
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Professor", href: "/professor" },
            { label: "Frequências" },
          ]}
        />
      </div>

      <form onSubmit={onSubmit} className="grid gap-4 sm:gap-6 lg:grid-cols-[320px_1fr]">
        {loadError && (
          <div className="lg:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {loadError} Configure ou active um ano letivo em Administração &gt; Configurações &gt; Calendário e atualize esta página.
          </div>
        )}
        <aside className="space-y-3 sm:space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <div className="text-xs font-black uppercase tracking-wider text-slate-400">Turma e Disciplina</div>
            
            <div className="space-y-2">
              <select
                value={turmaId}
                onChange={(e) => {
                  setTurmaId(e.target.value)
                  setDisciplinaId('')
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
                required
              >
                <option value="">Selecione a Turma</option>
                {Array.from(new Set(atribs.map((a) => a.turma.id))).map((tid) => (
                  <option key={tid} value={tid}>
                    {(() => {
                      const turma = atribs.find((a) => a.turma.id === tid)?.turma;
                      return turma ? formatTurmaDisplayName(turma) : tid;
                    })()}
                  </option>
                ))}
              </select>

              <select
                value={disciplinaId}
                onChange={(e) => setDisciplinaId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 disabled:opacity-50"
                required
                disabled={!turmaId}
              >
                <option value="">Selecione a Disciplina</option>
                {(atribsByTurma.get(turmaId) || []).map((a) => (
                  <option key={a.disciplina.id} value={a.disciplina.id}>
                    {a.disciplina.nome || a.disciplina.id}
                  </option>
                ))}
              </select>

              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
                required
              />
            </div>
          </div>

          {/* Status da Sincronização */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2 text-xs font-semibold text-slate-600 shadow-sm">
            <div className="font-black uppercase tracking-wider text-slate-400 text-[10px]">Status da Chamada</div>
            {submitStatus === 'saved' && <div className="flex items-center gap-1.5 text-emerald-700 font-bold"><CheckCircle2 size={16} /> Presenças sincronizadas com a escola.</div>}
            {submitStatus === 'pending' && <div className="flex items-center gap-1.5 text-amber-700 font-bold"><Clock size={16} /> Salvo offline (sincronizará ao reconectar).</div>}
            {submitStatus === 'failed' && <div className="flex flex-wrap items-center gap-2 text-rose-600 font-bold"><XCircle size={16} /> <span>Falha ao sincronizar.</span><button type="submit" className="rounded-lg bg-rose-100 px-2 py-1 text-[10px] font-black uppercase text-rose-700 hover:bg-rose-200">Tentar novamente</button></div>}
            {submitStatus === 'idle' && <div className="text-slate-500">Selecione a turma para iniciar o diário.</div>}
          </div>

          {/* Relatório de Mapa de Frequência */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
            <div className="text-xs font-black uppercase tracking-wider text-slate-400">Mapa de Frequência PDF</div>
            <select
              value={reportMonth}
              onChange={(e) => setReportMonth(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-600"
            >
              {[
                { v: '01', l: 'Janeiro' },
                { v: '02', l: 'Fevereiro' },
                { v: '03', l: 'Março' },
                { v: '04', l: 'Abril' },
                { v: '05', l: 'Maio' },
                { v: '06', l: 'Junho' },
                { v: '07', l: 'Julho' },
                { v: '08', l: 'Agosto' },
                { v: '09', l: 'Setembro' },
                { v: '10', l: 'Outubro' },
                { v: '11', l: 'Novembro' },
                { v: '12', l: 'Dezembro' },
              ].map(m => (
                <option key={m.v} value={m.v}>{m.l}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                if (!turmaId) return;
                const url = `/api/secretaria/turmas/${turmaId}/alunos/pdf?month=${reportMonth}&year=${new Date().getFullYear()}${disciplinaId ? `&disciplina_id=${disciplinaId}` : ''}`;
                window.open(url, '_blank');
              }}
              disabled={!turmaId}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Imprimir Mapa
            </button>
          </div>

          <button
            type="submit"
            disabled={saving || !turmaId || !disciplinaId}
            className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black uppercase tracking-wider text-white shadow-md hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-95"
          >
            {saving ? 'A Guardar Chamada...' : 'Finalizar & Guardar Chamada'}
          </button>
        </aside>

        {/* Lado Direito: Lista de Alunos e Chamada em 1-Click */}
        <section className="space-y-4">
          
          {/* BARRA DE AÇÕES EM LOTE (Chamada por Exceção) */}
          {alunos.length > 0 && (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleMarcarTodosPresentes}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-2xs transition-all active:scale-95 cursor-pointer"
                  >
                    <UserCheck size={16} />
                    <span>Marcar Todos Presentes (1-Click)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleMarcarTodosFaltas}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/70 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                  >
                    <XCircle size={15} />
                    <span>Todas Faltas</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetStatus}
                    className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold transition-colors"
                    title="Resetar Seleções"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>

                {/* Badges de Resumo em Tempo Real */}
                <div className="flex items-center gap-2 text-xs font-black">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 border border-emerald-100">
                    ✅ {stats.presentes} Presentes
                  </span>
                  {stats.faltas > 0 && (
                    <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-700 border border-rose-100">
                      ❌ {stats.faltas} Faltas
                    </span>
                  )}
                  {stats.atrasos > 0 && (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800 border border-amber-100">
                      ⏰ {stats.atrasos} Atrasos
                    </span>
                  )}
                </div>
              </div>

              {/* Filtro de Pesquisa Rápida por Aluno */}
              {alunos.length > 8 && (
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Filtrar aluno por nome..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-700 outline-none focus:bg-white focus:border-emerald-600"
                  />
                </div>
              )}
            </div>
          )}

          {/* LISTA DE ALUNOS (Mobile & Desktop) */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {alunos.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto text-slate-300">
                  <UserCheck size={24} />
                </div>
                <p className="text-xs font-bold text-slate-400">
                  Selecione a turma e disciplina no painel lateral para carregar os estudantes.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredAlunos.map((a, index) => {
                  const current = statusMap[a.id] || 'presente'
                  return (
                    <div key={a.id} className="p-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-black text-slate-500">
                          {index + 1}
                        </span>
                        <p className="text-xs sm:text-sm font-bold text-slate-900">{a.nome}</p>
                      </div>

                      {/* Botões de Ação por Toque Rápido */}
                      <div className="flex items-center gap-1.5 self-end sm:self-center">
                        {[
                          { value: 'presente', label: 'Presente', icon: CheckCircle2, cls: 'bg-emerald-600 text-white border-emerald-600 shadow-2xs font-black' },
                          { value: 'falta', label: 'Falta', icon: XCircle, cls: 'bg-rose-600 text-white border-rose-600 shadow-2xs font-black' },
                          { value: 'atraso', label: 'Atraso', icon: Clock, cls: 'bg-amber-500 text-white border-amber-500 shadow-2xs font-black' },
                        ].map((opt) => {
                          const IconComp = opt.icon;
                          const active = current === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setStatusMap((s) => ({ ...s, [a.id]: opt.value as AttendanceStatus }))}
                              className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs transition-all active:scale-95 ${
                                active
                                  ? opt.cls
                                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 font-medium'
                              }`}
                            >
                              <IconComp size={14} />
                              <span>{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </form>
    </div>
  )
}

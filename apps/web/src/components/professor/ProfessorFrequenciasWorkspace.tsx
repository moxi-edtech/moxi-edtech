"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { enqueueOfflineAction } from '@/lib/offline/queue'
import { createIdempotencyKey } from '@/lib/idempotency'
import { useOfflineStatus } from '@/hooks/useOfflineStatus'
import { PortalSheet } from "@/components/portal/ui/PortalSheet";
import { usePortalMobile } from "@/components/portal/ui/usePortalMobile";
import { SlidersHorizontal } from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { useToast } from '@/components/feedback/FeedbackSystem';
import { formatTurmaDisplayName } from "@/utils/formatters";
import { ACADEMIC_YEAR_PARAM } from "@/lib/academic-year/context";
import { DesistenciaMatriculaAction } from "@/components/matriculas/DesistenciaMatriculaAction";
import { usePortalDrawerGuard } from "@/components/portal/ui/PortalDrawerNavigator";

import { Printer, CheckCircle2, XCircle, Clock, UserCheck, Search, RotateCcw, Ellipsis } from 'lucide-react'

type Atrib = { id: string; turma: { id: string; nome: string | null }; disciplina: { id: string; nome: string | null } }
type Aluno = { id: string; nome: string; matriculaId?: string | null }
type AlunoApi = { id?: string; aluno_id?: string; matricula_id?: string; profile_id?: string; nome?: string; aluno_nome?: string }
type AttendanceStatus = 'presente' | 'falta' | 'atraso'

function academicContextNextStep(message: string) {
  if (/ACTIVE_ACADEMIC_YEAR_NOT_CONFIGURED|ano letivo.*(ativo|configurad)/i.test(message)) {
    return 'Configure ou active um ano letivo em Administração > Configurações > Calendário e atualize esta página.'
  }
  if (/ACADEMIC_CONTEXT_TIMEOUT|timeout|demorou|tempo limite/i.test(message)) {
    return 'A consulta demorou mais do que o esperado. Tente novamente; os dados preenchidos serão preservados.'
  }
  if (/403|permissão|atribuíd/i.test(message)) {
    return 'Confirme com a secretaria se o professor está atribuído a esta turma e disciplina.'
  }
  return 'Atualize a página. Se continuar, confirme com a secretaria o ano letivo e a atribuição da disciplina.'
}

export function ProfessorFrequenciasWorkspace({ embedded = false, requestedAcademicYearId = "", urlTurmaId = null, urlDisciplinaId = null }: { embedded?: boolean; requestedAcademicYearId?: string; urlTurmaId?: string | null; urlDisciplinaId?: string | null }) {
  const { success, error, warning } = useToast();
  const [atribs, setAtribs] = useState<Atrib[]>([])
  const [turmaId, setTurmaId] = useState('')
  const [disciplinaId, setDisciplinaId] = useState('')
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [searchFilter, setSearchFilter] = useState('')
  const [openActionsId, setOpenActionsId] = useState<string | null>(null)
  const [data, setData] = useState(() => new Date().toISOString().slice(0,10))
  const [saving, setSaving] = useState(false)
  const [contextOpen, setContextOpen] = useState(false)
  const mobile = usePortalMobile()
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [loadedRosterKey, setLoadedRosterKey] = useState("")
  const [statusMap, setStatusMap] = useState<Record<string, 'presente'|'falta'|'atraso'>>({})
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'pending' | 'saved' | 'failed'>('idle')
  const [reportMonth, setReportMonth] = useState(() => (new Date().getMonth() + 1).toString().padStart(2, '0'))
  const { online } = useOfflineStatus()
  const [academicYearId, setAcademicYearId] = useState(requestedAcademicYearId)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [studentsError, setStudentsError] = useState<string | null>(null)

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
    const controller = new AbortController()
    setAlunos([])
    setLoadedRosterKey("")
    setStudentsError(null)
    setStudentsLoading(Boolean(turmaId && disciplinaId))
    if (!turmaId || !disciplinaId) return () => controller.abort()
    void (async () => {
      try {
      const params = new URLSearchParams({ disciplina_id: disciplinaId })
      if (academicYearId) params.set(ACADEMIC_YEAR_PARAM, academicYearId)
      const res = await fetch(`/api/professor/turmas/${turmaId}/alunos?${params.toString()}`, { cache: 'no-store', signal: controller.signal })
      const json = await res.json().catch(()=>null)
      if (controller.signal.aborted) return
      if (!res.ok || !json?.ok) {
        setAlunos([])
        setStudentsError(json?.message || json?.error || 'Não foi possível carregar os alunos desta turma.')
        return
      }
      setAlunos((json.items as AlunoApi[] || []).map((r) => ({ id: r.id || r.aluno_id || r.profile_id || '', nome: r.nome || r.aluno_nome || 'Aluno', matriculaId: r.matricula_id ?? null })).filter((r) => r.id))
      setLoadedRosterKey(JSON.stringify([turmaId, disciplinaId, academicYearId]))
      } catch (cause) {
        if (!controller.signal.aborted) setStudentsError(cause instanceof Error ? cause.message : 'Não foi possível carregar os alunos desta turma.')
      } finally {
        if (!controller.signal.aborted) setStudentsLoading(false)
      }
    })()
    return () => controller.abort()
  }, [turmaId, disciplinaId, academicYearId])

  useEffect(() => {
    setSubmitStatus('idle')
    setStatusMap({})
  }, [turmaId, disciplinaId, data, academicYearId])

  const atribsByTurma = useMemo(() => atribs.reduce((acc, a) => {
    const arr = acc.get(a.turma.id) || []
    arr.push(a)
    acc.set(a.turma.id, arr)
    return acc
  }, new Map<string, Atrib[]>()), [atribs])

  const attendanceDirty = Object.keys(statusMap).length > 0 && submitStatus !== 'saved' && submitStatus !== 'pending'
  const contextLocked = saving || attendanceDirty
  usePortalDrawerGuard(attendanceDirty, saving)
  const rosterReady = loadedRosterKey === JSON.stringify([turmaId, disciplinaId, academicYearId]) && !studentsLoading && !studentsError

  const filteredAlunos = useMemo(() => {
    if (!searchFilter.trim()) return alunos;
    const q = searchFilter.toLowerCase();
    return alunos.filter((a) => a.nome.toLowerCase().includes(q));
  }, [alunos, searchFilter]);

  const studentNumbers = useMemo(() =>
    new Map(alunos.map((student, index) => [student.id, index + 1] as const)), [alunos]);
  useEffect(() => { setOpenActionsId(null); }, [turmaId, disciplinaId]);

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
    setSubmitStatus('idle');
    success("Presença em Lote", "Todos os alunos foram marcados como Presentes.");
  };

  const handleMarcarTodosFaltas = () => {
    const next: Record<string, 'falta'> = {};
    for (const a of alunos) next[a.id] = 'falta';
    setStatusMap(next);
    setSubmitStatus('idle');
  };

  const handleResetStatus = () => {
    setSubmitStatus('idle');
    setStatusMap({});
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (!turmaId || !disciplinaId) throw new Error('Selecione turma e disciplina.')
      if (!rosterReady || alunos.length === 0) throw new Error('Aguarde a lista de alunos válida antes de guardar.')
      if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error('Seleccione uma data válida.')
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
      setSubmitStatus('failed')
      error("Erro ao guardar", message || "Não foi possível registar as presenças. Por favor, tente novamente.")
    } finally {
      setSaving(false);
    }
  }

  const contextControls = (<div className="space-y-2">
              <select aria-label="Turma" disabled={contextLocked}
                value={turmaId}
                onChange={(e) => {
                  setTurmaId(e.target.value)
                  setDisciplinaId('')
                }}
                className="min-h-11 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-semibold text-foreground outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
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

              <select aria-label="Disciplina"
                value={disciplinaId}
                onChange={(e) => setDisciplinaId(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-semibold text-foreground outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 disabled:opacity-50"
                required
                disabled={!turmaId || contextLocked}
              >
                <option value="">Selecione a Disciplina</option>
                {(atribsByTurma.get(turmaId) || []).map((a) => (
                  <option key={a.disciplina.id} value={a.disciplina.id}>
                    {a.disciplina.nome || a.disciplina.id}
                  </option>
                ))}
              </select>

              <input
                type="date" aria-label="Data da chamada" disabled={contextLocked}
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-semibold text-foreground outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
                required
              />
            </div>);

  return (
    <div className={embedded ? "min-w-0 space-y-4" : "mx-auto w-full min-w-0 max-w-6xl space-y-6 md:p-6"}>
      {!embedded && <div className="mb-3 sm:mb-4">
        <DashboardHeader
          title="Frequências & Diário de Classe"
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Professor", href: "/professor" },
            { label: "Frequências" },
          ]}
        />
      </div>}

      <form onSubmit={onSubmit} className={embedded ? "grid min-w-0 gap-4" : "grid gap-4 sm:gap-6 lg:grid-cols-[320px_1fr]"}>
        {loadError && (
          <div className="lg:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-bold">{loadError}</p>
            <p className="mt-1 text-xs">{academicContextNextStep(loadError)}</p>
          </div>
        )}
        <aside className="space-y-3 sm:space-y-4">
          {mobile && !embedded ? <>
            <button type="button" disabled={contextLocked} aria-haspopup="dialog" aria-expanded={contextOpen} onClick={()=>setContextOpen(true)} className="klasse-portal-press flex min-h-14 w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left disabled:opacity-50">
              <SlidersHorizontal className="size-5 shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0"><span className="block text-sm font-semibold">Contexto da chamada</span><span className="block break-words text-xs text-muted-foreground">{[atribs.find(a=>a.turma.id===turmaId)?.turma.nome, (atribsByTurma.get(turmaId)||[]).find(a=>a.disciplina.id===disciplinaId)?.disciplina.nome, data].filter(Boolean).join(" · ")}</span></span>
            </button>
            <PortalSheet open={contextOpen} onClose={()=>setContextOpen(false)} title="Contexto da chamada" description="Selecciona turma, disciplina e data." size="expanded" footer={<button type="button" onClick={()=>setContextOpen(false)} className="klasse-portal-press min-h-11 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">Concluir selecção</button>}>
              {contextControls}
            </PortalSheet>
          </> : <div className="space-y-3 rounded-xl border border-border bg-card p-4"><h2 className="text-sm font-semibold">Turma e disciplina</h2>{contextControls}</div>}
          {attendanceDirty && <p className="text-xs text-muted-foreground">Guarda ou limpa a chamada antes de mudar de contexto.</p>}
          {studentsLoading && <p role="status" className="text-sm text-muted-foreground">A carregar alunos…</p>}

          {/* Status da Sincronização */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-xs font-semibold text-muted-foreground ">
            <div className="font-black uppercase tracking-wider text-muted-foreground text-[10px]">Status da Chamada</div>
            {submitStatus === 'saved' && <div className="flex items-center gap-1.5 text-emerald-700 font-bold"><CheckCircle2 size={16} /> Presenças sincronizadas com a escola.</div>}
            {submitStatus === 'pending' && <div className="flex items-center gap-1.5 text-amber-700 font-bold"><Clock size={16} /> Salvo offline (sincronizará ao reconectar).</div>}
            {submitStatus === 'failed' && <div className="flex flex-wrap items-center gap-2 text-rose-600 font-bold"><XCircle size={16} /> <span>Falha ao sincronizar.</span><button type="submit" className="rounded-lg bg-rose-100 px-2 py-1 text-[10px] font-black uppercase text-rose-700 hover:bg-rose-200">Tentar novamente</button></div>}
            {submitStatus === 'idle' && <div className="text-muted-foreground">Selecione a turma para iniciar o diário.</div>}
          </div>

          {/* Relatório de Mapa de Frequência */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3 ">
            <div className="text-xs font-black uppercase tracking-wider text-muted-foreground">Mapa de Frequência PDF</div>
            <select
              value={reportMonth}
              onChange={(e) => setReportMonth(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground outline-none focus:border-emerald-600"
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
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-xs font-black text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Imprimir Mapa
            </button>
          </div>

          <button
            type="submit"
            disabled={saving || !rosterReady || alunos.length === 0 || !turmaId || !disciplinaId || !data}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-wider text-white  transition-all active:scale-95 disabled:opacity-50 ${submitStatus === 'failed' ? 'bg-rose-600 hover:bg-rose-700' : submitStatus === 'saved' ? 'bg-emerald-700 hover:bg-emerald-800' : submitStatus === 'pending' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
          >
            {saving ? 'A Guardar Chamada...' : submitStatus === 'saved' ? <><CheckCircle2 className="h-4 w-4" /> Chamada Guardada</> : submitStatus === 'pending' ? 'Chamada Guardada Offline' : submitStatus === 'failed' ? 'Tentar Novamente' : 'Finalizar & Guardar Chamada'}
          </button>
        </aside>

        {/* Lado Direito: Lista de Alunos e Chamada em 1-Click */}
        <section className="space-y-4">
          {studentsError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <p className="font-bold">Não foi possível carregar os alunos.</p>
              <p className="mt-1">{studentsError}</p>
              <p className="mt-1 text-xs">Confirme a atribuição do professor à disciplina e tente novamente.</p>
            </div>
          )}
          
          {/* BARRA DE AÇÕES EM LOTE (Chamada por Exceção) */}
          {alunos.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4  space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleMarcarTodosPresentes}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black  transition-all active:scale-95 cursor-pointer"
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
                    className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-muted hover:bg-muted text-muted-foreground text-xs font-semibold transition-colors"
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
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Filtrar aluno por nome..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-muted text-xs text-foreground outline-none focus:bg-card focus:border-emerald-600"
                  />
                </div>
              )}
            </div>
          )}

          {/* Chamada por exceção: a desistência fica nas opções secundárias. */}
          <div className="overflow-hidden rounded-xl border border-border bg-card ">
            {alunos.length === 0 ? (
              <div className="space-y-2 px-4 py-8 text-center">
                <UserCheck size={24} className="mx-auto text-muted-foreground" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">Selecione a turma e disciplina para carregar os alunos.</p>
              </div>
            ) : filteredAlunos.length === 0 ? (
              <p role="status" className="p-5 text-center text-sm text-muted-foreground">Nenhum aluno encontrado para esta pesquisa.</p>
            ) : (
              <div className="divide-y divide-border">
                {filteredAlunos.map((a) => {
                  const current = statusMap[a.id] || 'presente';
                  const number = studentNumbers.get(a.id);
                  const actionsOpen = openActionsId === a.id;
                  return (
                    <div key={a.id} className="space-y-2.5 px-3 py-3 transition-colors hover:bg-muted/30 sm:px-4">
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-start gap-2.5">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums text-muted-foreground" aria-label={'Aluno número ' + number}>{number}</span>
                          <p className="min-w-0 flex-1 break-words pt-0.5 text-sm font-semibold leading-snug text-foreground">{a.nome}</p>
                        </div>
                        {a.matriculaId && turmaId && (
                          <button type="button"
                            onClick={() => setOpenActionsId((value) => value === a.id ? null : a.id)}
                            aria-expanded={actionsOpen} aria-controls={'opcoes-aluno-' + a.id}
                            aria-label={'Outras ações para ' + a.nome}
                            className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-xl border border-border px-2 text-xs font-medium text-muted-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-klasse-gold">
                            <Ellipsis size={16} aria-hidden="true" /><span>Opções</span>
                          </button>
                        )}
                      </div>
                      <div role="group" aria-label={'Presença de ' + a.nome} className="grid grid-cols-3 gap-1.5">
                        {([
                          { value: 'presente', label: 'Presente', icon: CheckCircle2, selected: 'border-klasse-green bg-klasse-green text-white' },
                          { value: 'falta', label: 'Falta', icon: XCircle, selected: 'border-rose-600 bg-rose-600 text-white' },
                          { value: 'atraso', label: 'Atraso', icon: Clock, selected: 'border-amber-500 bg-amber-500 text-klasse-gold-900' },
                        ] as const).map((opt) => {
                          const Icon = opt.icon;
                          const active = current === opt.value;
                          return (
                            <button key={opt.value} type="button" aria-pressed={active}
                              onClick={() => {
                                setStatusMap((previous) => ({ ...previous, [a.id]: opt.value }));
                                setSubmitStatus('idle');
                              }}
                              className={'inline-flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-xl border px-1 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-klasse-gold sm:gap-1.5 sm:px-3 ' + (active ? opt.selected : 'border-border bg-card text-muted-foreground hover:bg-muted')}>
                              <Icon size={15} className="shrink-0" aria-hidden="true" /><span>{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      {a.matriculaId && turmaId && actionsOpen && (
                        <div id={'opcoes-aluno-' + a.id} className="rounded-xl border border-border bg-muted/40 p-1.5">
                          <DesistenciaMatriculaAction variant="menu" tipo="sinalizar" alunoId={a.id}
                            alunoNome={a.nome} turmaId={turmaId} matriculaId={a.matriculaId} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </form>
    </div>
  )
}

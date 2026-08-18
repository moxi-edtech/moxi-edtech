'use client'

import { AlertTriangle, Calculator, CalendarDays, CheckCircle2, Edit3, RefreshCw, Search, Banknote, Grid, List, ShieldCheck, ArrowRight } from "lucide-react"
import React, { useState, useMemo } from "react"

import { initialForm, usePrecosLogic } from "./usePrecosLogic"
import type { TabelaPrecoItem } from "./usePrecosLogic"

function formatarMoeda(valor: number | null | undefined) {
  if (valor === null || valor === undefined) return "—"
  return new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 })
    .format(valor)
    .replace("AOA", "Kz")
}

function converterNumeroPorExtenso(num: number): string {
  if (!num || num <= 0) return "Zero Kwanzas"
  if (num === 1) return "Um Kwanza"

  const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "catorze", "quinze", "dezasseis", "dezassete", "dezoito", "dezenove"]
  const dezenas = ["", "dez", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"]
  const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"]

  function converterDezenas(n: number): string {
    if (n < 20) return unidades[n]
    const d = Math.floor(n / 10)
    const r = n % 10
    return r ? `${dezenas[d]} e ${unidades[r]}` : dezenas[d]
  }

  function converterCentenas(n: number): string {
    if (n === 100) return "cem"
    const c = Math.floor(n / 100)
    const r = n % 100
    return r ? `${centenas[c]} e ${converterDezenas(r)}` : centenas[c]
  }

  if (num < 1000) {
    const res = converterCentenas(num)
    return res.charAt(0).toUpperCase() + res.slice(1) + " Kwanzas"
  }

  if (num < 1000000) {
    const milhares = Math.floor(num / 1000)
    const resto = num % 1000
    const parteMil = milhares === 1 ? "mil" : `${converterCentenas(milhares)} mil`
    const parteResto = resto ? (resto < 100 || resto % 100 === 0 ? ` e ${converterCentenas(resto)}` : `, ${converterCentenas(resto)}`) : ""
    const finalStr = parteMil + parteResto
    return finalStr.charAt(0).toUpperCase() + finalStr.slice(1) + " Kwanzas"
  }

  return formatarMoeda(num)
}

const InputGroup = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{label}</label>
    {children}
  </div>
)

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>{children}</div>
)

export default function PrecosClient({
  escolaId,
  embedded = false,
  showDueDate = true,
}: {
  escolaId: string;
  embedded?: boolean;
  showDueDate?: boolean;
}) {
  const {
    state: {
      sessions,
      selectedSession,
      anoLetivo,
      cursos,
      classes,
      tabelas,
      resolved,
      simulacao,
      form,
      loading,
      saving,
      resolving,
      applying,
      previewingApply,
      applyPreviewCount,
      applyScope,
      classesFiltradasForm,
      classesFiltradasSimulacao,
      destinosOrdenados,
      pendingPricingTargets,
      configuredPricingCount,
      pendingPricingCount,
      destinoAtualLabel,
    },
    actions: {
      setSelectedSession,
      setAnoLetivoFallback,
      setForm,
      setSimulacao,
      setApplyScope,
      carregarTabelas,
      salvar,
      editar,
      previewAplicacaoPendentes,
      aplicarAosPendentes,
    },
  } = usePrecosLogic(escolaId)

  const [viewMode, setViewMode] = useState<"list" | "matrix">("list")
  const destinoAtualLabelSafe = useMemo(() => destinoAtualLabel || "—", [destinoAtualLabel])

  // Extenso previews
  const mensalidadeExtenso = useMemo(() => {
    const num = parseFloat(form.valor_mensalidade)
    if (!Number.isFinite(num) || num <= 0) return null
    return converterNumeroPorExtenso(num)
  }, [form.valor_mensalidade])

  const matriculaExtenso = useMemo(() => {
    const num = parseFloat(form.valor_matricula)
    if (!Number.isFinite(num) || num <= 0) return null
    return converterNumeroPorExtenso(num)
  }, [form.valor_matricula])

  const confirmacaoExtenso = useMemo(() => {
    const num = parseFloat(form.valor_confirmacao)
    if (!Number.isFinite(num) || num <= 0) return null
    return converterNumeroPorExtenso(num)
  }, [form.valor_confirmacao])

  // Regra geral fallback item if present
  const regraGeral = useMemo(() => {
    return tabelas.find((t) => !t.curso_id && !t.classe_id) ?? null
  }, [tabelas])

  // Matrix cell lookup helper
  const getCellData = (cursoId: string, classeId: string) => {
    // 1. Direct match for course + class
    const exact = tabelas.find((t) => t.curso_id === cursoId && t.classe_id === classeId)
    if (exact) return { item: exact, type: "exact" as const }

    // 2. Class default (applies to this class across courses)
    const classDefault = tabelas.find((t) => !t.curso_id && t.classe_id === classeId)
    if (classDefault) return { item: classDefault, type: "class_default" as const }

    // 3. Course default (no class)
    const courseDefault = tabelas.find((t) => t.curso_id === cursoId && !t.classe_id)
    if (courseDefault) return { item: courseDefault, type: "course_default" as const }

    // 4. School general rule (no course, no class)
    if (regraGeral) return { item: regraGeral, type: "general" as const }

    return { item: null, type: "none" as const }
  }

  return (
    <div className={embedded ? "space-y-8 font-sans text-slate-900" : "max-w-7xl mx-auto p-6 space-y-8 font-sans text-slate-900"}>
      {!embedded && (
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Configuração de Preços</h1>
            <p className="text-slate-500 mt-1 text-sm">Defina as regras de cobrança para matrículas e mensalidades.</p>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <CalendarDays className="w-4 h-4 text-slate-500" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ano Letivo</span>
              {sessions.length > 0 ? (
                <select
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  className="bg-transparent text-sm font-semibold text-slate-900 outline-none cursor-pointer"
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  value={anoLetivo}
                  onChange={(e) => setAnoLetivoFallback(Number(e.target.value) || new Date().getFullYear())}
                  className="bg-transparent text-sm font-semibold w-20 outline-none"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Grid Section */}
      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Regras Ativas & Visual Matrix */}
        <div className="lg:col-span-5 space-y-4 order-2 lg:order-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Banknote className="w-4 h-4 text-slate-500" />
              <h3 className="font-bold text-sm text-slate-900">Regras Ativas ({destinosOrdenados.length})</h3>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded-md text-xs font-semibold transition-all ${
                    viewMode === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                  }`}
                  title="Modo Lista"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("matrix")}
                  className={`p-1.5 rounded-md text-xs font-semibold transition-all ${
                    viewMode === "matrix" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                  }`}
                  title="Modo Matriz (Cursos x Classes)"
                >
                  <Grid className="w-3.5 h-3.5" />
                </button>
              </div>
              <button
                onClick={carregarTabelas}
                disabled={loading}
                className="p-1.5 text-slate-500 hover:text-slate-900 transition-colors"
                title="Atualizar dados"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Configuradas</span>
              <span className="mt-1 block text-lg font-bold text-slate-900">{configuredPricingCount}</span>
              <span className="text-[11px] text-slate-500">turmas com matrícula e mensalidade</span>
            </div>
            <div className={`rounded-xl border px-3 py-2.5 ${pendingPricingCount > 0 ? "border-amber-200 bg-amber-50/40" : "border-slate-200 bg-white"}`}>
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Pendentes</span>
              <span className="mt-1 block text-lg font-bold text-slate-900">{pendingPricingCount}</span>
              <span className="text-[11px] text-slate-500">turmas que exigem atenção</span>
            </div>
            <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 sm:col-span-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Estado</span>
              <span className="mt-1 block text-sm font-bold text-slate-900">
                {pendingPricingCount > 0 ? "Configuração incompleta" : "Pronto para cobrança"}
              </span>
              <span className="text-[11px] text-slate-500">ano letivo {anoLetivo}</span>
            </div>
          </div>

          {pendingPricingTargets.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-white p-3.5 shadow-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Turmas sem tabela de preço completa</h4>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    O Radar conta turmas, não serviços do catálogo. Configure matrícula e mensalidade para cada turma abaixo.
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {pendingPricingTargets.map(({ classe, curso }) => (
                  <button
                    key={classe.id}
                    type="button"
                    onClick={() => setForm((prev) => ({
                      ...initialForm,
                      curso_id: classe.curso_id ?? "",
                      classe_id: classe.id,
                      dia_vencimento: prev.dia_vencimento,
                    }))}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-left transition-colors hover:border-slate-400 hover:bg-white"
                  >
                    <span>
                      <span className="block text-xs font-semibold text-slate-900">{classe.nome}</span>
                      <span className="block text-[11px] text-slate-500">{curso?.nome || "Curso não identificado"}</span>
                    </span>
                    <span className="text-[11px] font-semibold text-slate-600">Configurar</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* List View */}
          {viewMode === "list" && (
            <div className="space-y-2.5 max-h-[620px] overflow-y-auto pr-1">
              {destinosOrdenados.map((item: TabelaPrecoItem) => {
                const isGeral = !item.curso_id && !item.classe_id
                const cursoNome = cursos.find((c) => c.id === item.curso_id)?.nome
                const classeNome = classes.find((c) => c.id === item.classe_id)?.nome
                const isSelected = form.id === item.id

                return (
                  <div
                    key={item.id || `${item.curso_id || 'geral'}-${item.classe_id || 'geral'}`}
                    onClick={() => editar(item)}
                    className={`group relative p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/10"
                        : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        {isGeral ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            isSelected ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-700"
                          }`}>
                            Regra Geral (Padrão)
                          </span>
                        ) : (
                          <div className="flex flex-col">
                            {cursoNome && (
                              <span className={`font-semibold text-xs ${isSelected ? "text-white" : "text-slate-900"}`}>
                                {cursoNome}
                              </span>
                            )}
                            {classeNome && (
                              <span className={`text-[11px] ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                                {classeNome}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className={`transition-opacity ${isSelected ? "opacity-100 text-slate-300" : "opacity-0 group-hover:opacity-100 text-slate-400"}`}>
                        <Edit3 className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    <div className={`flex items-center justify-between text-xs pt-2.5 border-t border-dashed ${
                      isSelected ? "border-slate-800 text-slate-300" : "border-slate-100 text-slate-600"
                    }`}>
                      <div>
                        <span className="text-[10px] opacity-70 block uppercase tracking-wider font-medium">Mensalidade</span>
                        <span className="font-mono font-semibold">{formatarMoeda(item.valor_mensalidade)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] opacity-70 block uppercase tracking-wider font-medium">Matrícula</span>
                        <span className="font-mono font-semibold">{formatarMoeda(item.valor_matricula)}</span>
                      </div>
                    </div>
                    <div className={`mt-2 flex items-center justify-between border-t border-dashed pt-2 text-xs ${
                      isSelected ? "border-slate-800 text-slate-300" : "border-slate-100 text-slate-600"
                    }`}>
                      <span className="text-[10px] uppercase tracking-wider opacity-70">Rematrícula</span>
                      <span className="font-mono font-bold">
                        {item.valor_confirmacao == null ? "Global" : formatarMoeda(item.valor_confirmacao)}
                      </span>
                    </div>
                  </div>
                )
              })}

              {destinosOrdenados.length === 0 && !loading && (
                <div className="text-center p-8 border border-dashed border-slate-200 rounded-xl bg-slate-50">
                  <p className="text-xs font-medium text-slate-500">Nenhuma regra definida para {anoLetivo}.</p>
                </div>
              )}
            </div>
          )}

          {/* Matrix Grid View (Cursos x Classes) */}
          {viewMode === "matrix" && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-3 shadow-sm max-h-[620px] overflow-y-auto">
              <p className="text-[11px] text-slate-500 mb-3 font-medium">
                Selecione uma célula para configurar o preço específico dessa combinação.
              </p>
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70">
                    <th className="p-2 font-bold text-slate-600">Curso</th>
                    {classes.map((cls) => (
                      <th key={cls.id} className="p-2 text-center font-bold text-slate-600 whitespace-nowrap">
                        {cls.nome}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cursos.map((curso) => (
                    <tr key={curso.id} className="hover:bg-slate-50/50">
                      <td className="p-2 font-semibold text-slate-900 whitespace-nowrap">{curso.nome}</td>
                      {classes.map((cls) => {
                        const { item, type } = getCellData(curso.id, cls.id)
                        const isExact = type === "exact"
                        const isCourseDefault = type === "course_default"
                        const isClassDefault = type === "class_default"

                        return (
                          <td
                            key={cls.id}
                            onClick={() => {
                              if (item) editar(item)
                              else {
                                setForm({
                                  ...initialForm,
                                  curso_id: curso.id,
                                  classe_id: cls.id,
                                })
                              }
                            }}
                            className={`p-2 text-center cursor-pointer transition-colors border-l border-slate-100 ${
                              isExact
                                ? "bg-slate-900 text-white font-semibold"
                                : isCourseDefault
                                ? "bg-amber-50/80 text-amber-900"
                                : isClassDefault
                                ? "bg-teal-50/80 text-teal-900"
                                : "hover:bg-slate-100 text-slate-600"
                            }`}
                            title={
                              isExact
                                ? "Preço específico para esta classe"
                                : isCourseDefault
                                ? "Herda da regra do curso"
                                : isClassDefault
                                ? "Preço definido para esta classe em todos os cursos"
                                : "Herda da regra geral da escola"
                            }
                          >
                            <div className="font-mono text-[11px]">
                              Mens.: {item ? formatarMoeda(item.valor_mensalidade) : "—"}
                            </div>
                            <div className="font-mono text-[10px]">
                              Remat.: {item?.valor_confirmacao == null ? "Global" : formatarMoeda(item.valor_confirmacao)}
                            </div>
                            <div className="text-[9px] opacity-70">
                              {isExact ? "Curso + classe" : isCourseDefault ? "Curso" : isClassDefault ? "Classe" : "Geral"}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column: Rule Editor Form */}
        <div className="lg:col-span-7 space-y-6 order-1 lg:order-2">
          <Card className="p-1 overflow-hidden">
            <div className="bg-slate-50/70 p-5 border-b border-slate-100">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">
                      {form.id ? "Editar Regra de Preço" : "Nova Regra de Preço"}
                    </h2>
                    {form.id && (
                      <span className="rounded bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                        Edição em curso
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Regras específicas por classe prevalecem sobre regras de curso e regra geral.
                  </p>
                </div>
                {form.id && (
                  <button
                    onClick={() => setForm(initialForm)}
                    className="text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 transition-colors font-medium"
                  >
                    Cancelar Edição
                  </button>
                )}
              </div>
            </div>

            <form onSubmit={salvar} className="p-5 space-y-6">
              <div className="grid md:grid-cols-2 gap-5">
                <InputGroup label="Curso Alvo">
                  <select
                    value={form.curso_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, curso_id: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:border-slate-400 outline-none transition-all cursor-pointer"
                  >
                    <option value="">(Toda a Escola - Regra Geral)</option>
                    {cursos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </InputGroup>

                <InputGroup label="Classe Alvo">
                  <select
                    value={form.classe_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, classe_id: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:border-slate-400 outline-none transition-all cursor-pointer"
                  >
                    <option value="">{form.curso_id ? "(Todas as classes deste curso)" : "(Todas as classes)"}</option>
                    {classesFiltradasForm.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </InputGroup>
              </div>

              <div className="grid md:grid-cols-3 gap-5">
                      <InputGroup label="Valor da Matrícula">
                  <div className="space-y-1">
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-slate-400 text-xs font-medium">Kz</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        value={form.valor_matricula}
                        onChange={(e) => setForm((prev) => ({ ...prev, valor_matricula: e.target.value }))}
                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg font-mono text-xs font-semibold text-slate-900 focus:border-slate-400 outline-none"
                      />
                    </div>
                    {matriculaExtenso && (
                      <p className="text-[10px] font-medium text-slate-500 italic pl-1">
                        {matriculaExtenso}
                      </p>
                    )}
                  </div>
                      </InputGroup>
                      <InputGroup label="Valor da Rematrícula">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.valor_confirmacao}
                          onChange={(e) => setForm((prev) => ({ ...prev, valor_confirmacao: e.target.value }))}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                          placeholder="0 = sem rematrícula · vazio = valor global"
                        />
                        {confirmacaoExtenso && <p className="mt-1 text-[11px] text-slate-500">{confirmacaoExtenso}</p>}
                      </InputGroup>

                <InputGroup label="Mensalidade (Propina)">
                  <div className="space-y-1">
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-slate-400 text-xs font-medium">Kz</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        value={form.valor_mensalidade}
                        onChange={(e) => setForm((prev) => ({ ...prev, valor_mensalidade: e.target.value }))}
                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg font-mono text-xs font-semibold text-slate-900 focus:border-slate-400 outline-none"
                      />
                    </div>
                    {mensalidadeExtenso && (
                      <p className="text-[10px] font-medium text-slate-500 italic pl-1">
                        {mensalidadeExtenso}
                      </p>
                    )}
                  </div>
                </InputGroup>

                {showDueDate && (
                  <InputGroup label="Dia de Vencimento">
                    <input
                      type="number"
                      min="1"
                      max="31"
                      placeholder="Ex: 10"
                      value={form.dia_vencimento}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, dia_vencimento: event.target.value }))
                      }
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:border-slate-400 outline-none"
                    />
                  </InputGroup>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="font-semibold text-slate-500">Destino:</span>
                  <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                    {destinoAtualLabelSafe}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-xs transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  {form.id ? "Guardar Alterações" : "Criar Regra de Preço"}
                </button>
              </div>
            </form>
          </Card>

          {/* Aplicar aos Pendentes Panel */}
          <Card className="p-5 border-slate-200 bg-white">
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Atualização em Lote de Mensalidades Pendentes
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Reaplica os valores da regra selecionada sobre as mensalidades pendentes em aberto.
                </p>
              </div>

              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <label className="text-xs font-semibold text-slate-600">Escopo da Atualização:</label>
                <select
                  value={applyScope}
                  onChange={(event) => setApplyScope(event.target.value === "all" ? "all" : "future")}
                  className="w-full md:w-auto px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-slate-400 cursor-pointer"
                >
                  <option value="future">Apenas pendentes futuros (recomendado)</option>
                  <option value="all">Todas as mensalidades pendentes</option>
                </select>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={previewAplicacaoPendentes}
                  disabled={previewingApply}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {previewingApply ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5 text-slate-500" />}
                  Pré-visualizar Impacto
                </button>

                <button
                  type="button"
                  onClick={aplicarAosPendentes}
                  disabled={applying}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold disabled:opacity-50 transition-colors shadow-sm"
                >
                  {applying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  Aplicar aos Pendentes
                </button>
              </div>

              {applyPreviewCount !== null && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700 flex items-center justify-between">
                  <span>Impacto estimado na faturação:</span>
                  <span className="font-bold text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded">
                    {applyPreviewCount} mensalidade(s) pendente(s)
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* Simulator Panel */}
          <Card className="bg-slate-50/70 border-slate-200 p-5">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-slate-500" />
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Simulador de Preço Final (Verificação de Fallback)
                </h4>
              </div>
              <p className="text-xs text-slate-500">
                Selecione uma combinação de Curso e Classe para testar qual valor final o sistema calculará no momento da cobrança.
              </p>

              <div className="grid md:grid-cols-2 gap-3 pt-1">
                <select
                  value={simulacao.curso_id}
                  onChange={(e) => setSimulacao((prev) => ({ ...prev, curso_id: e.target.value }))}
                  className="bg-white border border-slate-200 text-xs font-medium rounded-lg p-2.5 outline-none focus:border-slate-400 cursor-pointer"
                >
                  <option value="">Selecione um curso...</option>
                  {cursos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
                <select
                  value={simulacao.classe_id}
                  onChange={(e) => setSimulacao((prev) => ({ ...prev, classe_id: e.target.value }))}
                  className="bg-white border border-slate-200 text-xs font-medium rounded-lg p-2.5 outline-none focus:border-slate-400 cursor-pointer"
                >
                  <option value="">Selecione uma classe...</option>
                  {classesFiltradasSimulacao.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 mt-2">
                {resolving ? (
                  <div className="text-xs text-slate-500 flex items-center gap-2 py-1">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" /> A calcular resultado final...
                  </div>
                ) : resolved?.tabela ? (
                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline border-b border-slate-100 pb-2">
                      <span className="text-xs text-slate-500">Mensalidade (Propina):</span>
                      <span className="text-lg font-bold font-mono text-slate-900">
                        {formatarMoeda(resolved.tabela.valor_mensalidade)}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline text-xs text-slate-600">
                      <span>Taxa de Matrícula:</span>
                      <span className="font-mono font-semibold">
                        {formatarMoeda(resolved.tabela.valor_matricula)}
                      </span>
                    </div>
                    <div className="pt-1 flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      Origem da Regra: <span className="text-slate-900">{resolved.origem || "Regra Definida"}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-xs text-slate-400 py-1 font-medium">
                    Escolha um curso e classe acima para simular a liquidação.
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

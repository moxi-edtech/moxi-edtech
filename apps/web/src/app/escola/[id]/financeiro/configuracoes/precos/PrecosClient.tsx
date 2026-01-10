'use client'

import { Calculator, CalendarDays, CheckCircle2, Edit3, Loader2, Search, Banknote } from "lucide-react"
import React from "react"

import { initialForm, usePrecosLogic } from "./usePrecosLogic"
import type { TabelaPrecoItem } from "./usePrecosLogic"

function formatarMoeda(valor: number | null | undefined) {
  if (valor === null || valor === undefined) return "—"
  return new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA" }).format(valor)
}

const InputGroup = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</label>
    {children}
  </div>
)

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>{children}</div>
)

export default function PrecosClient({ escolaId }: { escolaId: string }) {
  const {
    state: {
      sessions,
      selectedSession,
      anoLetivo,
      cursos,
      classes,
      resolved,
      simulacao,
      form,
      loading,
      saving,
      resolving,
      classesFiltradasForm,
      classesFiltradasSimulacao,
      destinosOrdenados,
      destinoAtualLabel,
    },
    actions: { setSelectedSession, setAnoLetivoFallback, setForm, setSimulacao, carregarTabelas, salvar, editar },
  } = usePrecosLogic(escolaId)

  const destinoAtualLabelSafe = React.useMemo(() => destinoAtualLabel || "—", [destinoAtualLabel])

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8 font-sans text-slate-900">
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

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4 space-y-4 order-2 lg:order-1">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Banknote className="w-4 h-4 text-slate-500" /> Regras Ativas ({destinosOrdenados.length})
            </h3>
            <button
              onClick={carregarTabelas}
              disabled={loading}
              className="text-xs font-medium text-slate-500 hover:text-emerald-600 transition-colors"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Atualizar"}
            </button>
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
            {destinosOrdenados.map((item: TabelaPrecoItem) => {
              const isGeral = !item.curso_id && !item.classe_id
              const cursoNome = cursos.find((c) => c.id === item.curso_id)?.nome
              const classeNome = classes.find((c) => c.id === item.classe_id)?.nome

              return (
                <div
                  key={item.id || `${item.curso_id || 'geral'}-${item.classe_id || 'geral'}`}
                  onClick={() => editar(item)}
                  className={`group relative p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md ${
                    form.id === item.id
                      ? "bg-emerald-50/50 border-emerald-500 ring-1 ring-emerald-500"
                      : "bg-white border-slate-200 hover:border-emerald-300"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      {isGeral ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wide">
                          Regra Geral
                        </span>
                      ) : (
                        <div className="flex flex-col">
                          {cursoNome && <span className="font-semibold text-sm text-slate-900">{cursoNome}</span>}
                          {classeNome && <span className="text-xs text-slate-500">{classeNome}</span>}
                        </div>
                      )}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Edit3 className="w-4 h-4 text-emerald-600" />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm mt-3 pt-3 border-t border-slate-100 border-dashed">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Mensalidade</span>
                      <span className="font-mono font-medium text-slate-700">{formatarMoeda(item.valor_mensalidade)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Matrícula</span>
                      <span className="font-mono font-medium text-slate-700">{formatarMoeda(item.valor_matricula)}</span>
                    </div>
                  </div>
                </div>
              )
            })}

            {destinosOrdenados.length === 0 && !loading && (
              <div className="text-center p-8 border border-dashed border-slate-200 rounded-xl bg-slate-50">
                <p className="text-sm text-slate-500">Nenhuma regra definida para {anoLetivo}.</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-8 space-y-6 order-1 lg:order-2">
          <Card className="p-1 overflow-hidden">
            <div className="bg-slate-50/50 p-6 border-b border-slate-100">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{form.id ? "Editar Regra" : "Nova Regra de Preço"}</h2>
                  <p className="text-sm text-slate-500 mt-1">Configure os valores aplicáveis. Regras específicas sobrescrevem a geral.</p>
                </div>
                {form.id && (
                  <button
                    onClick={() => setForm(initialForm)}
                    className="text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 hover:text-red-600 hover:border-red-200 transition-colors"
                  >
                    Cancelar Edição
                  </button>
                )}
              </div>
            </div>

            <form onSubmit={salvar} className="p-6 space-y-8">
              <div className="grid md:grid-cols-2 gap-6">
                <InputGroup label="Aplicar ao Curso">
                  <select
                    value={form.curso_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, curso_id: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                  >
                    <option value="">(Todos os cursos)</option>
                    {cursos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </InputGroup>

                <InputGroup label="Aplicar à Classe">
                  <select
                    value={form.classe_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, classe_id: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
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

              <div className="grid md:grid-cols-3 gap-6">
                <InputGroup label="Valor da Matrícula">
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 text-sm">Kz</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={form.valor_matricula}
                      onChange={(e) => setForm((prev) => ({ ...prev, valor_matricula: e.target.value }))}
                      className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg font-mono text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                    />
                  </div>
                </InputGroup>

                <InputGroup label="Mensalidade (Propina)">
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 text-sm">Kz</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={form.valor_mensalidade}
                      onChange={(e) => setForm((prev) => ({ ...prev, valor_mensalidade: e.target.value }))}
                      className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg font-mono text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                    />
                  </div>
                </InputGroup>

                <InputGroup label="Dia de Vencimento">
                  <input
                    type="number"
                    min="1"
                    max="31"
                    placeholder="Ex: 5"
                    value={form.dia_vencimento}
                    onChange={(e) => setForm((prev) => ({ ...prev, dia_vencimento: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  />
                </InputGroup>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Salvando para: <span className="font-medium text-slate-900">{destinoAtualLabelSafe}</span>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm transition-all shadow-sm shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {form.id ? "Atualizar Regra" : "Criar Regra"}
                </button>
              </div>
            </form>
          </Card>

          <Card className="bg-slate-50 border-slate-200">
            <div className="p-4 flex flex-col md:flex-row gap-6 items-center">
              <div className="flex-1 w-full space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calculator className="w-4 h-4 text-slate-400" />
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Simulador de Preço Final</h4>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={simulacao.curso_id}
                    onChange={(e) => setSimulacao((prev) => ({ ...prev, curso_id: e.target.value }))}
                    className="bg-white border border-slate-200 text-sm rounded-lg p-2 outline-none focus:border-emerald-500"
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
                    className="bg-white border border-slate-200 text-sm rounded-lg p-2 outline-none focus:border-emerald-500"
                  >
                    <option value="">Selecione uma classe...</option>
                    {classesFiltradasSimulacao.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="hidden md:block w-px h-16 bg-slate-200 mx-4"></div>

              <div className="flex-1 w-full">
                {resolving ? (
                  <div className="text-sm text-slate-400 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Calculando...
                  </div>
                ) : resolved?.tabela ? (
                  <div className="space-y-1">
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm text-slate-500">Mensalidade</span>
                      <span className="text-xl font-bold text-slate-900">{formatarMoeda(resolved.tabela.valor_mensalidade)}</span>
                    </div>
                    <div className="flex justify-between items-baseline text-xs text-slate-500">
                      <span>Matrícula</span>
                      <span>{formatarMoeda(resolved.tabela.valor_matricula)}</span>
                    </div>
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-50 text-[10px] font-medium text-blue-700 border border-blue-100">
                      <Search className="w-3 h-3" />
                      Fonte: {resolved.origem || "Regra Definida"}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-sm text-slate-400 py-2">
                    Selecione curso e classe para simular o valor final.
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

'use client'

import { FormEvent, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
 
type Catalogo = { id: string; nome: string }

type TabelaPrecoItem = {
  id?: string
  escola_id?: string
  ano_letivo: number
  curso_id: string | null
  classe_id: string | null
  valor_matricula: number | null
  valor_mensalidade: number | null
  dia_vencimento: number | null
}

type ResolvedPreco = {
  tabela: TabelaPrecoItem | null
  origem?: string
}

function formatarMoeda(valor: number | null | undefined) {
  if (valor === null || valor === undefined) return "—"
  return `AOA ${Number(valor).toFixed(2)}`
}

function destinoLabel(item: TabelaPrecoItem, cursos: Catalogo[], classes: Catalogo[]) {
  if (!item.curso_id && !item.classe_id) return "Regra geral da escola"
  const cursoNome = cursos.find((c) => c.id === item.curso_id)?.nome
  const classeNome = classes.find((c) => c.id === item.classe_id)?.nome
  if (item.curso_id && item.classe_id) return `${cursoNome || 'Curso'} • ${classeNome || 'Classe'}`
  if (item.curso_id) return cursoNome || "Curso"
  if (item.classe_id) return classeNome || "Classe"
  return "—"
}

type FormState = {
  id?: string
  curso_id: string
  classe_id: string
  valor_matricula: string
  valor_mensalidade: string
  dia_vencimento: string
}

const initialForm: FormState = {
  curso_id: "",
  classe_id: "",
  valor_matricula: "",
  valor_mensalidade: "",
  dia_vencimento: "",
}

export default function PrecosClient({ escolaId }: { escolaId: string }) {
  const [anoLetivo, setAnoLetivo] = useState<number>(new Date().getFullYear())
  const [cursos, setCursos] = useState<Catalogo[]>([])
  const [classes, setClasses] = useState<Catalogo[]>([])
  const [tabelas, setTabelas] = useState<TabelaPrecoItem[]>([])
  const [resolved, setResolved] = useState<ResolvedPreco | null>(null)
  const [simulacao, setSimulacao] = useState<{ curso_id: string; classe_id: string }>({ curso_id: "", classe_id: "" })
  const [form, setForm] = useState<FormState>(initialForm)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [resolving, setResolving] = useState(false)

  useEffect(() => {
    carregarCatalogos()
  }, [])

  useEffect(() => {
    carregarTabelas()
  }, [anoLetivo])

  useEffect(() => {
    if (!simulacao.curso_id && !simulacao.classe_id) return
    simular()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulacao.curso_id, simulacao.classe_id, anoLetivo])

  const destinosOrdenados = useMemo(() => {
    return [...tabelas].sort((a, b) => {
      const aKey = `${a.curso_id || ''}-${a.classe_id || ''}`
      const bKey = `${b.curso_id || ''}-${b.classe_id || ''}`
      return aKey.localeCompare(bKey)
    })
  }, [tabelas])

  async function carregarCatalogos() {
    try {
      const [cursosRes, classesRes] = await Promise.all([
        fetch(`/api/escolas/${escolaId}/cursos`, { cache: "no-store" }),
        fetch(`/api/escolas/${escolaId}/classes`, { cache: "no-store" }),
      ])

      const cursosJson = await cursosRes.json().catch(() => null)
      const classesJson = await classesRes.json().catch(() => null)
      if (cursosRes.ok && Array.isArray(cursosJson?.data)) setCursos(cursosJson.data as Catalogo[])
      if (classesRes.ok && Array.isArray(classesJson?.data)) setClasses(classesJson.data as Catalogo[])
    } catch (e) {
      console.error(e)
    }
  }

  async function carregarTabelas() {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/financeiro/tabelas?escola_id=${encodeURIComponent(escolaId)}&ano_letivo=${encodeURIComponent(anoLetivo)}`,
        { cache: "no-store" }
      )
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Erro ao carregar preços")
      setTabelas((json.items as TabelaPrecoItem[]) || [])
      setResolved(json.resolved || null)
    } catch (e: any) {
      toast.error(e?.message || "Erro ao carregar tabelas")
    } finally {
      setLoading(false)
    }
  }

  async function simular() {
    setResolving(true)
    try {
      const res = await fetch(
        `/api/financeiro/tabelas?escola_id=${encodeURIComponent(escolaId)}&ano_letivo=${encodeURIComponent(
          anoLetivo
        )}&curso_id=${encodeURIComponent(simulacao.curso_id || "")}&classe_id=${encodeURIComponent(simulacao.classe_id || "")}`,
        { cache: "no-store" }
      )
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Erro ao resolver preços")
      setResolved(json.resolved || null)
    } catch (e: any) {
      toast.error(e?.message || "Erro ao simular preço")
    } finally {
      setResolving(false)
    }
  }

  const destinoAtual = useMemo(() => {
    if (!form.curso_id && !form.classe_id) return "Regra geral"
    const cursoNome = cursos.find((c) => c.id === form.curso_id)?.nome
    const classeNome = classes.find((c) => c.id === form.classe_id)?.nome
    if (form.curso_id && form.classe_id) return `${cursoNome || 'Curso'} • ${classeNome || 'Classe'}`
    if (form.curso_id) return cursoNome || "Curso"
    if (form.classe_id) return classeNome || "Classe"
    return "—"
  }, [form.curso_id, form.classe_id, cursos, classes])

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload: any = {
        ano_letivo: anoLetivo,
        curso_id: form.curso_id || null,
        classe_id: form.classe_id || null,
        valor_matricula: form.valor_matricula ? Number(form.valor_matricula) : undefined,
        valor_mensalidade: form.valor_mensalidade ? Number(form.valor_mensalidade) : undefined,
        dia_vencimento: form.dia_vencimento ? Number(form.dia_vencimento) : undefined,
      }

      let method: "POST" | "PATCH" = "POST"
      if (form.id) {
        method = "PATCH"
        payload.id = form.id
      } else {
        payload.escola_id = escolaId
      }

      const res = await fetch("/api/financeiro/tabelas", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Erro ao salvar preços")

      toast.success("Tabela salva com sucesso")
      setForm(initialForm)
      carregarTabelas()
    } catch (e: any) {
      toast.error(e?.message || "Falha ao salvar")
    } finally {
      setSaving(false)
    }
  }

  function editar(item: TabelaPrecoItem) {
    setForm({
      id: item.id,
      curso_id: item.curso_id || "",
      classe_id: item.classe_id || "",
      valor_matricula: item.valor_matricula?.toString() || "",
      valor_mensalidade: item.valor_mensalidade?.toString() || "",
      dia_vencimento: item.dia_vencimento?.toString() || "",
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Tabelas de Preços</h1>
          <p className="text-sm text-gray-600">Defina matrícula, mensalidade e vencimento por curso e classe.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700">Ano letivo</label>
          <input
            type="number"
            value={anoLetivo}
            onChange={(e) => setAnoLetivo(Number(e.target.value) || new Date().getFullYear())}
            className="w-28 rounded border border-gray-300 px-3 py-1.5 text-sm"
            min={1900}
            max={3000}
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <form onSubmit={salvar} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-4">
          <div>
            <h2 className="font-semibold text-gray-800">Criar/editar regra</h2>
            <p className="text-sm text-gray-500">Selecione curso/classe e informe os valores.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm text-gray-700 space-y-1">
              <span>Curso (opcional)</span>
              <select
                value={form.curso_id}
                onChange={(e) => setForm((prev) => ({ ...prev, curso_id: e.target.value }))}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Regra geral ou por classe</option>
                {cursos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-gray-700 space-y-1">
              <span>Classe (opcional)</span>
              <select
                value={form.classe_id}
                onChange={(e) => setForm((prev) => ({ ...prev, classe_id: e.target.value }))}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Regra geral ou por curso</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <label className="text-sm text-gray-700 space-y-1">
              <span>Valor da matrícula</span>
              <input
                type="number"
                step="0.01"
                min={0}
                placeholder="AOA"
                value={form.valor_matricula}
                onChange={(e) => setForm((prev) => ({ ...prev, valor_matricula: e.target.value }))}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="text-sm text-gray-700 space-y-1">
              <span>Valor da mensalidade</span>
              <input
                type="number"
                step="0.01"
                min={0}
                placeholder="AOA"
                value={form.valor_mensalidade}
                onChange={(e) => setForm((prev) => ({ ...prev, valor_mensalidade: e.target.value }))}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="text-sm text-gray-700 space-y-1">
              <span>Dia de vencimento</span>
              <input
                type="number"
                min={1}
                max={31}
                placeholder="Ex: 10"
                value={form.dia_vencimento}
                onChange={(e) => setForm((prev) => ({ ...prev, dia_vencimento: e.target.value }))}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
            <span className="px-2 py-1 bg-gray-100 rounded-md">Destino: {destinoAtual}</span>
            {form.id && <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md">Editando regra existente</span>}
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar tabela"}
            </button>
            {form.id && (
              <button
                type="button"
                onClick={() => setForm(initialForm)}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Cancelar edição
              </button>
            )}
          </div>
        </form>

        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-800">Preços configurados</h2>
              <p className="text-sm text-gray-500">Regras cadastradas para {anoLetivo}.</p>
            </div>
            <button
              onClick={carregarTabelas}
              className="text-sm px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
              disabled={loading}
            >
              {loading ? "Atualizando..." : "Recarregar"}
            </button>
          </div>

          <div className="space-y-2 max-h-[540px] overflow-auto pr-1">
            {destinosOrdenados.map((item) => (
              <div
                key={item.id || `${item.curso_id}-${item.classe_id}`}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border border-gray-100 rounded-lg p-3"
              >
                <div>
                  <div className="font-medium text-gray-800">{destinoLabel(item, cursos, classes)}</div>
                  <div className="text-xs text-gray-500">Vencimento: {item.dia_vencimento || "—"}</div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
                  <span className="px-2 py-1 bg-gray-100 rounded">{formatarMoeda(item.valor_matricula)}</span>
                  <span className="px-2 py-1 bg-gray-100 rounded">{formatarMoeda(item.valor_mensalidade)}</span>
                  <button
                    onClick={() => editar(item)}
                    className="px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
                  >
                    Editar
                  </button>
                </div>
              </div>
            ))}
            {destinosOrdenados.length === 0 && (
              <p className="text-sm text-gray-500">Nenhuma regra cadastrada ainda.</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
        <div>
          <h2 className="font-semibold text-gray-800">Simular preço atual</h2>
          <p className="text-sm text-gray-500">Use a cascata de regras para ver o preço efetivo.</p>
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
          <label className="text-sm text-gray-700 space-y-1">
            <span>Curso</span>
            <select
              value={simulacao.curso_id}
              onChange={(e) => setSimulacao((prev) => ({ ...prev, curso_id: e.target.value }))}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Nenhum</option>
              {cursos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-gray-700 space-y-1">
            <span>Classe</span>
            <select
              value={simulacao.classe_id}
              onChange={(e) => setSimulacao((prev) => ({ ...prev, classe_id: e.target.value }))}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Nenhuma</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <button
              onClick={simular}
              disabled={resolving}
              className="w-full px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
            >
              {resolving ? "Calculando..." : "Calcular preço"}
            </button>
          </div>
        </div>

        <div className="border border-dashed border-gray-200 rounded-lg p-4 bg-gray-50">
          {resolved?.tabela ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="text-sm text-gray-600">Origem: {resolved.origem || "—"}</div>
                <div className="text-lg font-semibold text-gray-900">{formatarMoeda(resolved.tabela.valor_mensalidade)}</div>
                <div className="text-sm text-gray-600">Matrícula: {formatarMoeda(resolved.tabela.valor_matricula)}</div>
                <div className="text-sm text-gray-600">Vencimento: {resolved.tabela.dia_vencimento || "—"}</div>
              </div>
              <div className="text-xs text-gray-500">Ano letivo {resolved.tabela.ano_letivo}</div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Selecione curso ou classe para ver o preço calculado.</p>
          )}
        </div>
      </div>
    </div>
  )
 }

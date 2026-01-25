"use client"

import { useEffect, useState } from "react"
import type React from "react"

type VendaProps = { escolaId: string }

type Item = {
  id: string
  nome: string
  categoria: string
  preco: number
  controla_estoque: boolean
  estoque_atual: number
  ativo: boolean
}

export default function VendaCaixaClient({ escolaId }: VendaProps) {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    nome: "",
    categoria: "outros",
    preco: "0",
    controla_estoque: false,
    estoque_atual: "0",
    ativo: true,
  })

  const [sale, setSale] = useState({
    aluno_id: "",
    item_id: "",
    quantidade: "1",
    valor_unitario: "",
    desconto: "0",
    metodo_pagamento: "numerario",
    descricao: "",
    status: "pago",
  })

  useEffect(() => {
    fetchItems()
  }, [])

  useEffect(() => {
    const selected = items.find((i) => i.id === sale.item_id)
    if (selected && !sale.valor_unitario) {
      setSale((prev) => ({ ...prev, valor_unitario: String(selected.preco) }))
    }
  }, [sale.item_id, sale.valor_unitario, items])

  async function fetchItems() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/financeiro/itens?ativos=false", { cache: "no-store" })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || "Erro ao carregar itens")
      setItems(json.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setEditingId(null)
    setForm({ nome: "", categoria: "outros", preco: "0", controla_estoque: false, estoque_atual: "0", ativo: true })
  }

  async function handleItemSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)

    const payload = {
      ...form,
      preco: Number(form.preco),
      estoque_atual: Number(form.estoque_atual),
      controla_estoque: Boolean(form.controla_estoque),
    }

    const method = editingId ? "PUT" : "POST"
    const res = await fetch("/api/financeiro/itens", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingId ? { ...payload, id: editingId } : payload),
    })
    const json = await res.json()
    if (!json.ok) {
      setError(json.error || "Erro ao salvar item")
    } else {
      setMessage(editingId ? "Item atualizado" : "Item criado")
      resetForm()
      fetchItems()
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Desativar este item?")) return
    const res = await fetch(`/api/financeiro/itens?id=${encodeURIComponent(id)}`, { method: "DELETE" })
    const json = await res.json()
    if (!json.ok) setError(json.error || "Erro ao desativar")
    else {
      setMessage("Item desativado")
      fetchItems()
    }
  }

  async function handleVenda(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)

    const res = await fetch("/api/financeiro/itens/venda", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...sale,
        quantidade: Number(sale.quantidade),
        valor_unitario: sale.valor_unitario ? Number(sale.valor_unitario) : undefined,
        desconto: Number(sale.desconto || 0),
      }),
    })
    const json = await res.json()
    if (!json.ok) {
      setError(json.error || "Erro ao registrar venda")
    } else {
      const novoEstoque = json?.result?.estoque_atual
      setMessage(
        `Venda registada. Lançamento ${json?.result?.lancamento_id || ""}${
          novoEstoque !== undefined ? ` | Estoque atual: ${novoEstoque}` : ""
        }`
      )
      setSale({
        aluno_id: "",
        item_id: "",
        quantidade: "1",
        valor_unitario: "",
        desconto: "0",
        metodo_pagamento: "numerario",
        descricao: "",
        status: "pago",
      })
      fetchItems()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Vendas e Caixa</h1>
          <p className="text-sm text-gray-500">Registre itens avulsos, controle estoque e lançamentos.</p>
        </div>
        <div className="text-xs text-gray-500">Escola: {escolaId}</div>
      </div>

      {(error || message) && (
        <div
          className={`p-3 rounded border text-sm ${
            error ? "bg-red-50 border-red-200 text-red-700" : "bg-green-50 border-green-200 text-green-700"
          }`}
        >
          {error || message}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white border rounded-xl shadow-sm p-4">
          <h2 className="font-semibold mb-2">Itens do catálogo</h2>
          <p className="text-xs text-gray-500 mb-4">Gerencie preços e estoque dos produtos vendidos avulsamente.</p>

          <form onSubmit={handleItemSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                Nome
                <input
                  required
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="mt-1 w-full border rounded px-2 py-1"
                />
              </label>
              <label className="text-sm">
                Categoria
                <select
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  className="mt-1 w-full border rounded px-2 py-1"
                >
                  <option value="uniforme">Uniforme</option>
                  <option value="documento">Documento</option>
                  <option value="material">Material</option>
                  <option value="transporte">Transporte</option>
                  <option value="servico">Serviço</option>
                  <option value="outros">Outros</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                Preço (AOA)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={form.preco}
                  onChange={(e) => setForm({ ...form, preco: e.target.value })}
                  className="mt-1 w-full border rounded px-2 py-1"
                />
              </label>
              <label className="text-sm flex items-center gap-2 mt-6">
                <input
                  type="checkbox"
                  checked={form.controla_estoque}
                  onChange={(e) => setForm({ ...form, controla_estoque: e.target.checked })}
                />
                Controla estoque
              </label>
            </div>
            {form.controla_estoque && (
              <label className="text-sm block">
                Estoque atual
                <input
                  type="number"
                  min="0"
                  value={form.estoque_atual}
                  onChange={(e) => setForm({ ...form, estoque_atual: e.target.value })}
                  className="mt-1 w-full border rounded px-2 py-1"
                />
              </label>
            )}
            <div className="flex items-center gap-3">
              <button type="submit" className="bg-moxinexa-teal text-white px-4 py-2 rounded">
                {editingId ? "Atualizar" : "Adicionar"}
              </button>
              {editingId && (
                <button type="button" onClick={resetForm} className="text-sm text-gray-600">
                  Cancelar edição
                </button>
              )}
            </div>
          </form>

          <div className="mt-6">
            <h3 className="font-medium text-sm mb-2">Itens cadastrados</h3>
            {loading ? (
              <div className="text-sm text-gray-500">Carregando itens...</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-gray-500">Nenhum item cadastrado ainda.</div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-auto pr-1">
                {items.map((item) => (
                  <div key={item.id} className="border rounded-lg px-3 py-2 flex justify-between items-center">
                    <div>
                      <div className="font-medium">{item.nome}</div>
                      <div className="text-xs text-gray-500">
                        {item.categoria} · Preço: AOA {Number(item.preco).toFixed(2)} · Estoque:{" "}
                        {item.controla_estoque ? item.estoque_atual : "N/A"}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <button
                        onClick={() => {
                          setEditingId(item.id)
                          setForm({
                            nome: item.nome,
                            categoria: item.categoria,
                            preco: String(item.preco),
                            controla_estoque: item.controla_estoque,
                            estoque_atual: String(item.estoque_atual ?? 0),
                            ativo: item.ativo,
                          })
                        }}
                        className="text-blue-600"
                      >
                        Editar
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="text-red-600">
                        Desativar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border rounded-xl shadow-sm p-4">
          <h2 className="font-semibold mb-2">Registrar venda avulsa</h2>
          <p className="text-xs text-gray-500 mb-4">
            A venda gera um lançamento financeiro e baixa de estoque em um único passo.
          </p>

          <form onSubmit={handleVenda} className="space-y-3">
            <label className="text-sm block">
              Aluno (ID)
              <input
                required
                value={sale.aluno_id}
                onChange={(e) => setSale({ ...sale, aluno_id: e.target.value })}
                className="mt-1 w-full border rounded px-2 py-1"
                placeholder="UUID do aluno"
              />
            </label>
            <label className="text-sm block">
              Item
              <select
                required
                value={sale.item_id}
                onChange={(e) => setSale({ ...sale, item_id: e.target.value, valor_unitario: "" })}
                className="mt-1 w-full border rounded px-2 py-1"
              >
                <option value="">Selecione</option>
                {items
                  .filter((i) => i.ativo)
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nome} — AOA {Number(i.preco).toFixed(2)}
                    </option>
                  ))}
              </select>
            </label>
            <div className="grid grid-cols-3 gap-3">
              <label className="text-sm">
                Quantidade
                <input
                  type="number"
                  min="1"
                  required
                  value={sale.quantidade}
                  onChange={(e) => setSale({ ...sale, quantidade: e.target.value })}
                  className="mt-1 w-full border rounded px-2 py-1"
                />
              </label>
              <label className="text-sm">
                Valor unitário (AOA)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={sale.valor_unitario}
                  onChange={(e) => setSale({ ...sale, valor_unitario: e.target.value })}
                  className="mt-1 w-full border rounded px-2 py-1"
                  placeholder="Usar preço do item"
                />
              </label>
              <label className="text-sm">
                Desconto
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={sale.desconto}
                  onChange={(e) => setSale({ ...sale, desconto: e.target.value })}
                  className="mt-1 w-full border rounded px-2 py-1"
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                Método de pagamento
                <select
                  value={sale.metodo_pagamento}
                  onChange={(e) => setSale({ ...sale, metodo_pagamento: e.target.value })}
                  className="mt-1 w-full border rounded px-2 py-1"
                >
                  <option value="numerario">Numerário</option>
                  <option value="multicaixa">Multicaixa</option>
                  <option value="transferencia">Transferência</option>
                  <option value="deposito">Depósito</option>
                </select>
              </label>
              <label className="text-sm">
                Status
                <select
                  value={sale.status}
                  onChange={(e) => setSale({ ...sale, status: e.target.value })}
                  className="mt-1 w-full border rounded px-2 py-1"
                >
                  <option value="pago">Pago</option>
                  <option value="pendente">Pendente</option>
                </select>
              </label>
            </div>
            <label className="text-sm block">
              Descrição (opcional)
              <textarea
                value={sale.descricao}
                onChange={(e) => setSale({ ...sale, descricao: e.target.value })}
                className="mt-1 w-full border rounded px-2 py-1"
                rows={3}
                placeholder="Ex.: Venda de uniforme tamanho M"
              />
            </label>
            <button type="submit" className="bg-moxinexa-teal text-white px-4 py-2 rounded">
              Registrar venda
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

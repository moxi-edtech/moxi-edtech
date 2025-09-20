"use client"

import { useState } from 'react'
import PortalLayout from "@/components/layout/PortalLayout"
import AuditPageView from "@/components/audit/AuditPageView"

export default function Page() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [sexo, setSexo] = useState<'M'|'F'|'O'|'N'|''>('')
  const [biNumero, setBiNumero] = useState('')
  const [responsavelNome, setResponsavelNome] = useState('')
  const [responsavelContato, setResponsavelContato] = useState('')
  const [loading, setLoading] = useState(false)
  const [ok, setOk] = useState('')
  const [err, setErr] = useState('')
  const [criarAcesso, setCriarAcesso] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setOk(''); setErr('')
    try {
      setLoading(true)
      // escola_id será resolvida pelo path do lado do admin da escola; aqui usamos endpoint geral
      // Para secretaria sem id na URL, precisamos descobrir escola_id a partir do profile
      const resProf = await fetch('/api/debug/session')
      const prof = await resProf.json().catch(()=>({}))
      const escolaId = prof?.profile?.escola_id
      if (!escolaId) throw new Error('Sem escola vinculada')

      const res = await fetch(`/api/escolas/${escolaId}/alunos/novo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          email: email || undefined,
          data_nascimento: dataNascimento || undefined,
          sexo: sexo || undefined,
          bi_numero: biNumero || undefined,
          responsavel_nome: responsavelNome || undefined,
          responsavel_contato: responsavelContato || undefined,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Falha ao criar aluno')

      // Opcional: criar acesso (convite) para o aluno
      if (criarAcesso) {
        if (!email) throw new Error('Para criar acesso, informe o e-mail do aluno')
        const resInvite = await fetch(`/api/escolas/${escolaId}/alunos/invite`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, nome })
        })
        const jsonInvite = await resInvite.json().catch(()=>({}))
        if (!resInvite.ok || !jsonInvite?.ok) throw new Error(jsonInvite?.error || 'Falha ao convidar aluno')
        const numero = jsonInvite?.numero as string | undefined
        setOk(`Aluno criado com sucesso.${numero ? ` Número de acesso: ${numero}` : ''}`)
      } else {
        setOk('Aluno criado com sucesso.')
      }

      setNome(''); setEmail(''); setDataNascimento(''); setSexo(''); setBiNumero(''); setResponsavelNome(''); setResponsavelContato(''); setCriarAcesso(false)
    } catch (e: any) {
      setErr(e?.message || 'Erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PortalLayout>
      <AuditPageView portal="secretaria" action="PAGE_VIEW" entity="aluno_novo" />
      <div className="bg-white rounded-xl shadow border p-5 max-w-xl">
        <h1 className="text-lg font-semibold mb-3">Cadastrar novo aluno</h1>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nome</label>
            <input value={nome} onChange={e=>setNome(e.target.value)} required className="mt-1 w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">E-mail (opcional)</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 w-full border rounded px-3 py-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Data de nascimento</label>
              <input type="date" value={dataNascimento} onChange={e=>setDataNascimento(e.target.value)} className="mt-1 w-full border rounded px-3 py-2" />
              {dataNascimento && (
                <p className="text-xs text-gray-500 mt-1">
                  Idade: {(() => { const d=new Date(dataNascimento); const t=new Date(); let age=t.getFullYear()-d.getFullYear(); const m=t.getMonth()-d.getMonth(); if (m<0 || (m===0 && t.getDate()<d.getDate())) age--; return isNaN(age) ? '-' : age; })()} anos
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Sexo</label>
              <select value={sexo} onChange={e=>setSexo(e.target.value as any)} className="mt-1 w-full border rounded px-3 py-2">
                <option value="">Selecione</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
                <option value="O">Outro</option>
                <option value="N">Prefiro não informar</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Nº do Bilhete de Identidade (BI) / Cédula</label>
              <input value={biNumero} onChange={e=>setBiNumero(e.target.value)} className="mt-1 w-full border rounded px-3 py-2" placeholder="Ex.: 001234567LA045 (opcional)" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Responsável</label>
              <input value={responsavelNome} onChange={e=>setResponsavelNome(e.target.value)} className="mt-1 w-full border rounded px-3 py-2" placeholder="Nome do responsável (opcional)" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Contato do responsável</label>
              <input value={responsavelContato} onChange={e=>setResponsavelContato(e.target.value)} className="mt-1 w-full border rounded px-3 py-2" placeholder="Telefone/E-mail (opcional)" />
            </div>
          </div>

          <div className="border-t pt-4 space-y-2">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4" checked={criarAcesso} onChange={(e)=>setCriarAcesso(e.target.checked)} />
              <span>Criar acesso para o aluno (enviar convite)</span>
            </label>
            {criarAcesso && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">E-mail para convite</label>
                  <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required className="mt-1 w-full border rounded px-3 py-2" placeholder="aluno@email.com" />
                  <p className="text-xs text-gray-500 mt-1">O aluno irá definir a senha no primeiro acesso.</p>
                </div>
              </div>
            )}
          </div>
          {err && <div className="text-sm text-red-600">{err}</div>}
          {ok && <div className="text-sm text-green-600">{ok}</div>}
          <button disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">{loading ? 'Salvando...' : 'Salvar'}</button>
        </form>
      </div>
    </PortalLayout>
  )
}

// apps/web/src/app/super-admin/escolas/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import Sidebar from "@/components/super-admin/Sidebar";
import Header from "@/components/super-admin/Header";
import ChartsSection from "@/components/super-admin/ChartsSection";
import ActivitiesSection from "@/components/super-admin/ActivitiesSection";
import { getBranding } from '@/lib/branding'
import QuickActionsSection from "@/components/super-admin/QuickActionsSection";
import AuditPageView from "@/components/audit/AuditPageView";

import {
  AcademicCapIcon,
  UsersIcon,
  BanknotesIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";

type EscolaDetalhes = {
  id: string | number;
  nome: string;
  status: string;
  plano: string;
  cidade: string;
  estado: string;
  total_alunos: number;
  total_professores: number;
  notas_lancadas: number;
  pagamentos_em_dia: number;
  ultimo_acesso: string | null;
};

// 🔹 fallback mock
const mockEscola: EscolaDetalhes = {
  id: "mock-1",
  nome: "Escola Mock de Teste",
  status: "ativa",
  plano: "Premium",
  cidade: "São Paulo",
  estado: "SP",
  total_alunos: 1200,
  total_professores: 58,
  notas_lancadas: 80,
  pagamentos_em_dia: 92,
  ultimo_acesso: null,
};

export default function Page() {
  const params = useParams();
  const supabase = createClient();

  const [escola, setEscola] = useState<EscolaDetalhes | null>(null);
  const [loading, setLoading] = useState(true);
  const [alunoPortalEnabled, setAlunoPortalEnabled] = useState<boolean>(false)
  const [plano, setPlano] = useState<'basico'|'standard'|'premium'>('basico')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        // se params.id vier como string (Next.js retorna sempre string)
        const escolaId = Array.isArray(params.id) ? params.id[0] : params.id;

        let fetched: unknown = null
        let error: unknown = null

        const { data, error: verror } = await supabase
          .from('escolas_view' as unknown as never)
          .select('id, nome, status, plano, cidade, estado, total_alunos, total_professores')
          .eq('id', String(escolaId))
          .maybeSingle()
        if (!verror) fetched = data
        else error = verror

        // Fallback para tabela 'escolas' quando a view não existir ou estiver faltando no schema cache
        if (error) {
          const msg = (error as any)?.message as string | undefined
          const code = (error as any)?.code as string | undefined
          const missingView = (
            code === '42P01' ||
            (msg && /does not exist|relation .* does not exist|schema cache|Could not find .* in the schema cache/i.test(msg))
          )
          if (missingView) {
            const { data: raw, error: e2 } = await supabase
              .from('escolas' as unknown as never)
              .select('id, nome, status, plano, endereco')
              .eq('id', String(escolaId))
              .maybeSingle()
            if (!e2 && raw) {
              fetched = {
                id: (raw as any).id,
                nome: (raw as any).nome,
                status: (raw as any).status,
                plano: (raw as any).plano,
                cidade: (raw as any).endereco ?? null,
                estado: null,
                total_alunos: 0,
                total_professores: 0,
              }
              error = null
            }
          }
        }

        if (!error && fetched && active) {
          const e = fetched as Record<string, unknown>
          setEscola({
            id: String(e.id ?? ''),
            nome: String(e.nome ?? ''),
            status: (typeof e.status === 'string' ? e.status : 'ativa') as EscolaDetalhes['status'],
            plano: typeof e.plano === 'string' ? e.plano : 'Básico',
            cidade: (typeof e.cidade === 'string' ? e.cidade : (typeof e.endereco === 'string' ? e.endereco : '')),
            estado: typeof e.estado === 'string' ? e.estado : '',
            total_alunos: Number((e as unknown as { total_alunos?: unknown }).total_alunos ?? 0),
            total_professores: Number((e as unknown as { total_professores?: unknown }).total_professores ?? 0),
            notas_lancadas: 0,
            pagamentos_em_dia: 0,
            ultimo_acesso: null,
          })

          // fetch flags from escolas
          const { data: flags } = await supabase
            .from('escolas')
            .select('aluno_portal_enabled, plano')
            .eq('id', String(e.id ?? ''))
            .maybeSingle()
          setAlunoPortalEnabled(Boolean((flags as any)?.aluno_portal_enabled))
          const planVal = (flags as any)?.plano as string | undefined
          if (planVal && ['basico','standard','premium'].includes(planVal)) setPlano(planVal as 'basico'|'standard'|'premium')
        } else {
          console.warn("⚠️ Nenhuma escola encontrada, usando mock");
          setEscola(mockEscola);
        }
      } catch (e) {
        console.error("❌ Erro ao buscar escola:", e);
        setEscola(mockEscola);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [params.id, supabase]);

  if (loading) {
    return <p className="p-6">Carregando dados da escola...</p>;
  }

  if (!escola) {
    return <p className="p-6">Escola não encontrada.</p>;
  }

  const brand = getBranding()
  const waNumber = (brand.financeWhatsApp || '').replace(/\D/g, '')
  const waHref = waNumber ? `https://wa.me/${waNumber}` : null

  const kpis = [
    { title: "Alunos", value: escola.total_alunos, icon: UsersIcon },
    { title: "Professores", value: escola.total_professores, icon: UserGroupIcon },
    { title: "Notas Lançadas", value: `${escola.notas_lancadas}%`, icon: AcademicCapIcon },
    { title: "Pagamentos em Dia", value: `${escola.pagamentos_em_dia}%`, icon: BanknotesIcon },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="p-6 overflow-y-auto space-y-6">
          <AuditPageView portal="super_admin" action="PAGE_VIEW" entity="escola_edit" />
          {escola.status === 'suspensa' && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">
              <p className="font-semibold">Escola suspensa por pagamento</p>
              <p className="text-sm mt-1">A escola está com o acesso suspenso até regularização. Algumas ações ficam bloqueadas.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {brand.financeEmail && (
                  <a href={`mailto:${brand.financeEmail}`} className="px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 text-sm">Falar com Financeiro (e-mail)</a>
                )}
                {waHref && (
                  <a href={waHref} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 text-sm">Falar no WhatsApp</a>
                )}
              </div>
            </div>
          )}
          <h1 className="text-2xl font-bold">
            {escola.nome} ({escola.cidade} - {escola.estado})
          </h1>
          <p className="text-gray-500">
            Plano: {escola.plano} · Status: {escola.status}
          </p>

          {/* Configurações de Plano e Recursos */}
          <section className="bg-white shadow rounded-lg p-4 border">
            <h2 className="text-lg font-semibold mb-3">Plano e Recursos</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plano</label>
                <select value={plano} onChange={(e)=>setPlano(e.target.value as 'basico'|'standard'|'premium')} className="border rounded px-3 py-2 w-full">
                  <option value="basico">Básico (Financeiro Essencial)</option>
                  <option value="standard">Standard (Financeiro Avançado)</option>
                  <option value="premium">Premium (Financeiro + Fiscal)</option>
                </select>
                <p className="text-xs text-gray-500 mt-2">
                  - Básico: cobranças internas, registros manuais, relatórios simples, despesas manuais.<br/>
                  - Standard: + boletos/links, relatórios detalhados, alertas automáticos, exportações.<br/>
                  - Premium: + módulo fiscal, integração contábil, dashboards avançados, multiunidades.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <input id="aluno_portal" type="checkbox" className="h-4 w-4" checked={alunoPortalEnabled} onChange={(e)=>setAlunoPortalEnabled(e.target.checked)} />
                <label htmlFor="aluno_portal" className="text-sm">Habilitar Portal do Aluno</label>
              </div>
            </div>
            <div className="mt-4">
              <button disabled={saving} onClick={async ()=>{
                setSaving(true); setMsg('')
                try {
                  const escolaId = String(escola.id)
                  const res = await fetch(`/api/super-admin/escolas/${escolaId}/update`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aluno_portal_enabled: alunoPortalEnabled, plano }) })
                  const data = await res.json(); if (!res.ok) throw new Error(data?.error || 'Falha ao salvar')
                  setMsg('Configurações salvas com sucesso.')
                } catch (e: any) { setMsg(e?.message || 'Erro ao salvar') } finally { setSaving(false) }
              }} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar alterações'}</button>
              {msg && <span className="ml-3 text-sm text-gray-600">{msg}</span>}
            </div>
          </section>

          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {kpis.map((kpi) => (
              <div
                key={kpi.title}
                className="bg-white shadow rounded-lg p-4 flex items-center"
              >
                <kpi.icon className="w-10 h-10 text-blue-600 mr-4" />
                <div>
                  <p className="text-sm text-gray-500">{kpi.title}</p>
                  <p className="text-xl font-bold">{kpi.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Charts Section - dados locais da escola */}
          <ChartsSection escolaId={String(escola.id)} />

          {/* Activities e QuickActions */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ActivitiesSection activities={[]} />
            </div>
            <div className="lg:col-span-1">
              <QuickActionsSection />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

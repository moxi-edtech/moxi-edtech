// Dashboard do Admin — versão finalizada (Next.js + Supabase + boas práticas)
import React from "react";
export const dynamic = 'force-dynamic';

import {
  BanknotesIcon,
  BuildingLibraryIcon,
  ChartBarIcon,
  ChartPieIcon,
  PlusIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabaseServer';
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import SignOutButton from '@/components/auth/SignOutButton';

// Tipos
interface KPI {
  title: string;
  value: number | string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; // ✅ ajustado
  trend?: 'up' | 'down' | 'neutral';
  change?: string;
}

interface Activity {
  id: string;
  text: string;
  time: string;
  created_at: string;
}

interface QuickAction {
  label: string;
  route: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; // ✅ ajustado
  requiredRole?: string[];
}


// Componente Card
function Card({ title, value, icon: Icon, trend, change }: KPI) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-800">{value}</p>
          {trend && change && (
            <p
              className={`text-xs ${
                trend === 'up'
                  ? 'text-green-600'
                  : trend === 'down'
                  ? 'text-red-600'
                  : 'text-gray-600'
              }`}
            >
              {trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→'} {change}
            </p>
          )}
        </div>
        <div className="rounded-xl bg-gray-100 p-3">
          <Icon className="h-6 w-6 text-blue-600" />
        </div>
      </div>
    </div>
  );
}

// Skeleton (unused) — remove or re-enable if needed

// Placeholder de gráficos
function ChartPlaceholder({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <ChartPieIcon className="h-5 w-5 text-blue-600" />
        <h3 className="text-sm font-medium text-gray-700">{title}</h3>
      </div>
      <div className="grid h-56 place-items-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400">
        Gráfico (placeholder)
      </div>
    </div>
  );
}

// Item de atividade
function ActivityItem({ text, time }: { text: string; time: string }) {
  return (
    <li className="flex items-start gap-3 border-b border-gray-100 py-3 last:border-b-0">
      <span className="mt-1 h-2 w-2 rounded-full bg-blue-600" />
      <div className="flex-1">
        <p className="text-sm text-gray-700">{text}</p>
        <p className="text-xs text-gray-400">{time}</p>
      </div>
    </li>
  );
}

// QuickActions
function QuickActionButton({ label, route, icon: Icon }: QuickAction) {
  return (
    <Link
      href={route}
      className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <Icon className="h-5 w-5 text-blue-600" />
      {label}
    </Link>
  );
}

// Página principal
export default async function Page() {
  const session = await getSession();
  if (!session || !['super_admin', 'admin'].includes(session.user.role)) {
    redirect('/login');
  }

  const supabase = await supabaseServer()
  const escolaId = await resolveEscolaIdForUser(
    supabase,
    session.user.id,
    session.user.escola_id
  );

  const { data: countsRow } = escolaId
    ? await supabase
        .from('vw_admin_dashboard_counts')
        .select('alunos_ativos, turmas_total, professores_total')
        .eq('escola_id', escolaId)
        .maybeSingle()
    : { data: null };

  const { data: pagamentosRows } = escolaId
    ? await supabase
        .from('vw_pagamentos_status')
        .select('status, total')
        .eq('escola_id', escolaId)
    : { data: [] };

  const alunosCount = countsRow?.alunos_ativos ?? 0;
  const turmasCount = countsRow?.turmas_total ?? 0;
  const professoresCount = countsRow?.professores_total ?? 0;
  const pagamentosCount = (pagamentosRows || []).reduce((acc, row: any) => {
    const status = String(row?.status || '').toLowerCase();
    if (status === 'pago' || status === 'concluido') return acc + Number(row?.total || 0);
    return acc;
  }, 0);




  const kpis: KPI[] = [
    { title: 'Alunos ativos', value: alunosCount, icon: BuildingLibraryIcon },
    { title: 'Turmas', value: turmasCount, icon: ChartBarIcon },
    { title: 'Professores', value: professoresCount, icon: UserGroupIcon },
    { title: 'Pagamentos pagos', value: pagamentosCount, icon: BanknotesIcon },
  ];

  // Mock inicial de atividades (trocar por audit_logs futuramente)
  const activities: Activity[] = [
    { id: '1', text: 'Aluno João matriculado na Turma A', time: 'há 2h', created_at: '' },
    { id: '2', text: 'Pagamento #123 confirmado', time: 'há 3h', created_at: '' },
    { id: '3', text: 'Professora Maria criou disciplina Matemática', time: 'ontem', created_at: '' },
  ];

  const quickActions: QuickAction[] = [
    { label: 'Criar Usuário', route: '/admin/usuarios/novo', icon: PlusIcon },
    { label: 'Criar Escola', route: '/admin/escolas/novo', icon: BuildingLibraryIcon },
    { label: 'Lançar Nota', route: '/admin/academico/notas/novo', icon: ChartBarIcon },
    { label: 'Registrar Pagamento', route: '/admin/financeiro/pagamentos/novo', icon: BanknotesIcon },
  ];

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Dashboard</h1>
          <p className="text-sm text-gray-500">Visão geral do ambiente administrativo</p>
        </div>
        <SignOutButton />
      </div>

      {/* KPIs */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.title} {...k} />
        ))}
      </section>

      {/* Gráficos */}
      <section className="grid gap-4 lg:grid-cols-2">
        <ChartPlaceholder title="Matrículas por escola" />
        <ChartPlaceholder title="Pagamentos: recebidos x pendentes" />
      </section>

      {/* Atividades + Atalhos */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-medium text-gray-700">
            Últimas atividades
          </h3>
          <ul>
            {activities.map((a) => (
              <ActivityItem key={a.id} text={a.text} time={a.time} />
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-medium text-gray-700">
            Atalhos rápidos
          </h3>
          <div className="flex flex-wrap gap-3">
            {quickActions.map((qa) => (
              <QuickActionButton key={qa.label} {...qa} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

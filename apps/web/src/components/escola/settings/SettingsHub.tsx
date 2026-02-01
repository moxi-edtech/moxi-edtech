"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Building2, 
  BookOpen, 
  Users, 
  CreditCard, 
  ShieldCheck, 
  ChevronRight,
  ArrowLeft,
  Layers,
  CalendarCheck,
  Wand2,
  AlertTriangle,
} from "lucide-react";
import { Progress } from "~/components/ui/Progress";

interface SettingsHubProps {
  escolaId: string;
  onOpenWizard: () => void;
}

export default function SettingsHub({ escolaId, onOpenWizard }: SettingsHubProps) {
  const [avaliacaoPending, setAvaliacaoPending] = useState<boolean | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [setupStatus, setSetupStatus] = useState<{
    ano_letivo_ok?: boolean;
    periodos_ok?: boolean;
    curriculo_ok?: boolean;
    turmas_ok?: boolean;
  } | null>(null);
  const [estruturaCounts, setEstruturaCounts] = useState<{
    cursos_total?: number;
    classes_total?: number;
    disciplinas_total?: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchStatus() {
      if (!escolaId) return;
      try {
        const res = await fetch(`/api/escola/${escolaId}/admin/setup/status`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || "Erro ao carregar configurações.");
        if (cancelled) return;

        const data = json?.data ?? {};
        if (typeof data?.progress_percent === 'number') {
          setProgress(data.progress_percent);
        }
        if (typeof data?.avaliacao_frequencia_ok === 'boolean') {
          setAvaliacaoPending(!data.avaliacao_frequencia_ok);
        }
        setSetupStatus({
          ano_letivo_ok: data?.ano_letivo_ok,
          periodos_ok: data?.periodos_ok,
          curriculo_ok: data?.curriculo_ok,
          turmas_ok: data?.turmas_ok,
        });

        const counts = data?.estrutura_counts;
        if (counts) {
          setEstruturaCounts({
            cursos_total: counts.cursos_total ?? 0,
            classes_total: counts.classes_total ?? 0,
            disciplinas_total: counts.disciplinas_total ?? 0,
          });
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) setAvaliacaoPending(null);
      }
    }
    fetchStatus();
    return () => {
      cancelled = true;
    };
  }, [escolaId]);

  const avaliacaoLabel = avaliacaoPending === null
    ? null
    : avaliacaoPending
    ? "Etapa por configurar"
    : "Configurado";
  const avaliacaoTone = avaliacaoPending
    ? "bg-amber-100 text-amber-800"
    : "bg-emerald-100 text-emerald-800";

  const anoLetivoOk = setupStatus?.ano_letivo_ok && setupStatus?.periodos_ok;
  const curriculoOk = setupStatus?.curriculo_ok;
  const turmasOk = setupStatus?.turmas_ok;
  const estruturaMeta = estruturaCounts
    ? `Cursos: ${estruturaCounts.cursos_total ?? 0} · Classes: ${estruturaCounts.classes_total ?? 0} · Disciplinas: ${estruturaCounts.disciplinas_total ?? 0}`
    : null;

  const cardStatus = (ok?: boolean) =>
    ok === undefined
      ? { label: null, tone: undefined }
      : ok
      ? { label: "Configurado", tone: "bg-emerald-100 text-emerald-800" }
      : { label: "Etapa por configurar", tone: "bg-amber-100 text-amber-800" };

  const anoLetivoAtual = new Date().getFullYear();
  const impactItems = [
    { label: "Cursos", value: estruturaCounts?.cursos_total ?? 0 },
    { label: "Classes", value: estruturaCounts?.classes_total ?? 0 },
    { label: "Disciplinas", value: estruturaCounts?.disciplinas_total ?? 0 },
  ];

  const quickMenu = [
    {
      label: "Calendário",
      icon: CalendarCheck,
      href: `/escola/${escolaId}/admin/configuracoes/academico-completo`,
    },
    {
      label: "Avaliação",
      icon: BookOpen,
      href: `/escola/${escolaId}/admin/configuracoes/avaliacao-frequencia`,
    },
    {
      label: "Turmas",
      icon: Users,
      href: `/escola/${escolaId}/admin/configuracoes/academico-completo`,
    },
    {
      label: "Financeiro",
      icon: CreditCard,
      href: `/escola/${escolaId}/admin/configuracoes/financeiro`,
    },
    {
      label: "Fluxos",
      icon: Layers,
      href: `/escola/${escolaId}/secretaria/fluxo-academico`,
    },
    {
      label: "Avançado",
      icon: ShieldCheck,
      href: `/escola/${escolaId}/admin/configuracoes/seguranca`,
    },
  ];

  type SettingsCard = {
    title: string;
    desc: string;
    icon: typeof Building2;
    href?: string;
    action?: () => void;
    color: string;
    statusLabel?: string | null;
    statusTone?: string;
    meta?: string | null;
  };

  const setupCards: SettingsCard[] = [
    ...((progress ?? 0) < 100 ? [
      {
        title: "Assistente de Setup",
        desc: "Reconfigurar turmas e ano letivo (Wizard).",
        icon: Wand2,
        action: onOpenWizard,
        color: "bg-teal-50 text-teal-600",
        statusLabel: progress !== null ? `Progresso ${progress}%` : null,
        statusTone: progress !== null
          ? progress === 100
            ? "bg-emerald-100 text-emerald-800"
            : "bg-amber-100 text-amber-800"
          : undefined,
      },
    ] : []),
    {
      title: "Ano Letivo & Períodos",
      desc: "Defina o ano letivo e os trimestres.",
      icon: CalendarCheck,
      href: `/escola/${escolaId}/admin/configuracoes/academico-completo`,
      color: "bg-blue-50 text-blue-600",
      statusLabel: cardStatus(anoLetivoOk).label,
      statusTone: cardStatus(anoLetivoOk).tone,
    },
    {
      title: "Frequência & Avaliação",
      desc: "Defina regras globais e modelo de avaliação.",
      icon: BookOpen,
      href: `/escola/${escolaId}/admin/configuracoes/avaliacao-frequencia`,
      color: "bg-amber-50 text-amber-600",
      statusLabel: avaliacaoLabel,
      statusTone: avaliacaoTone,
    },
    {
      title: "Currículo (Presets)",
      desc: "Aplicar presets e publicar o currículo.",
      icon: BookOpen,
      href: `/escola/${escolaId}/admin/configuracoes/academico-completo`,
      color: "bg-emerald-50 text-emerald-600",
      statusLabel: cardStatus(curriculoOk).label,
      statusTone: cardStatus(curriculoOk).tone,
    },
    {
      title: "Turmas",
      desc: "Gere turmas a partir do currículo publicado.",
      icon: Users,
      href: `/escola/${escolaId}/admin/configuracoes/academico-completo`,
      color: "bg-slate-100 text-slate-600",
      statusLabel: cardStatus(turmasOk).label,
      statusTone: cardStatus(turmasOk).tone,
    },
  ];

  const adminCards: SettingsCard[] = [
    {
      title: "Identidade da Escola",
      desc: "Logo, nome, NIF e contactos.",
      icon: Building2,
      href: `/escola/${escolaId}/admin/configuracoes/identidade`,
      color: "bg-blue-50 text-blue-600"
    },
    {
      title: "Oferta Formativa",
      desc: "Gerir catálogo de cursos e adicionar novos níveis.",
      icon: Layers,
      href: `/escola/${escolaId}/admin/configuracoes/estrutura`,
      color: "bg-indigo-50 text-indigo-600",
      meta: estruturaMeta,
    },
    {
      title: "Gestão de Acessos",
      desc: "Permissões de professores e staff.",
      icon: Users,
      href: `/escola/${escolaId}/admin/configuracoes/acessos`,
      color: "bg-purple-50 text-purple-600"
    },
    {
      title: "Financeiro",
      desc: "Multas, moedas e contas bancárias.",
      icon: CreditCard,
      href: `/escola/${escolaId}/admin/configuracoes/financeiro`,
      color: "bg-emerald-50 text-emerald-600"
    },
    {
      title: "Segurança & Logs",
      desc: "Auditoria e backups.",
      icon: ShieldCheck,
      href: `/escola/${escolaId}/admin/configuracoes/seguranca`,
      color: "bg-slate-100 text-slate-600"
    },
    {
      title: "Zona de Perigo",
      desc: "Apagar dados acadêmicos (turmas, matrículas, etc).",
      icon: AlertTriangle,
      href: `/escola/${escolaId}/admin/configuracoes`,
      color: "bg-red-50 text-red-600"
    }
  ];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Configurações do Sistema</h2>
            <p className="text-sm text-slate-500">Ano Letivo {anoLetivoAtual} · Experiência simples e poderosa.</p>
          </div>
          <button
            type="button"
            onClick={onOpenWizard}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:text-slate-900 hover:border-slate-300"
          >
            Reabrir assistente
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[200px_1fr_240px] gap-6">
          <div className="space-y-2 text-sm">
            {quickMenu.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 text-slate-600 hover:text-slate-900 hover:border-slate-200"
              >
                <item.icon className="h-4 w-4" />
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Configuração atual</h3>
              <p className="text-xs text-slate-500">
                Cada ajuste mostra o impacto em tempo real para decisões seguras.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {impactItems.map((item) => (
                <div key={item.label} className="rounded-lg bg-white border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">{item.label}</p>
                  <p className="text-lg font-semibold text-slate-800">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${cardStatus(anoLetivoOk).tone ?? 'bg-slate-100 text-slate-500'}`}>Ano letivo</span>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${cardStatus(curriculoOk).tone ?? 'bg-slate-100 text-slate-500'}`}>Currículo</span>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${cardStatus(turmasOk).tone ?? 'bg-slate-100 text-slate-500'}`}>Turmas</span>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/escola/${escolaId}/admin/configuracoes/academico-completo`}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
              >
                Anterior
                <ArrowLeft className="w-3 h-3" />
              </Link>
              <Link
                href={`/escola/${escolaId}/admin/configuracoes/avaliacao-frequencia`}
                className="inline-flex items-center gap-2 rounded-full bg-klasse-gold px-4 py-2 text-xs font-semibold text-white"
              >
                Próximo
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-700">Barra de status</h4>
              <p className="text-xs text-slate-500">Impacto imediato das mudanças.</p>
            </div>
            <ul className="text-xs text-slate-600 space-y-2">
              <li>Afeta a configuração de {estruturaCounts?.classes_total ?? 0} classes.</li>
              <li>Altera o plano de {estruturaCounts?.disciplinas_total ?? 0} disciplinas.</li>
              <li>Reverbera em {estruturaCounts?.cursos_total ?? 0} cursos ativos.</li>
            </ul>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={onOpenWizard}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Salvar e revisar
              </button>
              <Link
                href={`/escola/${escolaId}/secretaria/fluxo-academico`}
                className="w-full text-center rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
              >
                Testar fluxo
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Header com Voltar */}
      <div className="flex flex-col gap-2">
        <div>
          <Link 
            href={`/escola/${escolaId}/admin/dashboard`} 
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors py-2 px-3 -ml-3 rounded-lg hover:bg-slate-100"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao Dashboard
          </Link>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Definições</h1>
            <p className="text-slate-500 mt-1">Gerencie as preferências globais da escola.</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Setup Acadêmico</h2>
          {progress !== null && (
            <div className="mt-3 bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Progresso do setup</p>
                  <p className="text-xs text-slate-500">Complete as etapas para liberar o portal.</p>
                </div>
                <span className={`text-sm font-bold ${progress === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {progress}%
                </span>
              </div>
              <div className="mt-3">
                <Progress value={progress} className="h-2 bg-slate-100" />
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
            {setupCards.map((card, idx) => (
              <div 
                key={`setup-${idx}`}
                onClick={() => card.action ? card.action() : window.location.href = card.href || '#'}
                className="group bg-white p-6 rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between h-full"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-xl transition-colors ${card.color}`}>
                      <card.icon size={24} />
                    </div>
                    <ChevronRight className="text-slate-300 group-hover:text-slate-600 transition-colors" />
                  </div>
                  {card.statusLabel && (
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${card.statusTone || 'bg-slate-100 text-slate-600'}`}>
                      {card.statusLabel}
                    </span>
                  )}
                  <h3 className="font-bold text-slate-800 text-lg mb-2 group-hover:text-slate-900">
                    {card.title}
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    {card.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Administração</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
            {adminCards.map((card, idx) => (
              <div 
                key={`admin-${idx}`}
                onClick={() => card.action ? card.action() : window.location.href = card.href || '#'}
                className="group bg-white p-6 rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between h-full"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-xl transition-colors ${card.color}`}>
                      <card.icon size={24} />
                    </div>
                    <ChevronRight className="text-slate-300 group-hover:text-slate-600 transition-colors" />
                  </div>
                  {card.statusLabel && (
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${card.statusTone || 'bg-slate-100 text-slate-600'}`}>
                      {card.statusLabel}
                    </span>
                  )}
                  <h3 className="font-bold text-slate-800 text-lg mb-2 group-hover:text-slate-900">
                    {card.title}
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    {card.desc}
                  </p>
                  {card.meta && (
                    <p className="text-xs text-slate-400 mt-2">
                      {card.meta}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

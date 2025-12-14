"use client";

import Link from "next/link";
import { 
  Building2, 
  BookOpen, 
  Users, 
  CreditCard, 
  Bell, 
  ShieldCheck, 
  ChevronRight,
  ArrowLeft,
  Layers, // Ícone novo para a Oferta Formativa
  Wand2,
  AlertTriangle,
} from "lucide-react";

interface SettingsHubProps {
  escolaId: string;
  onOpenWizard: () => void;
}

export default function SettingsHub({ escolaId, onOpenWizard }: SettingsHubProps) {
  
  const cards = [
    {
      title: "Identidade da Escola",
      desc: "Logo, nome, NIF e contactos.",
      icon: Building2,
      href: `/escola/${escolaId}/admin/configuracoes/identidade`,
      color: "bg-blue-50 text-blue-600"
    },
    // --- NOVO CARD ESPECÍFICO PARA A ROTA DE ESTRUTURA ---
    {
      title: "Oferta Formativa",
      desc: "Gerir catálogo de cursos e adicionar novos níveis.",
      icon: Layers,
      href: `/escola/${escolaId}/admin/configuracoes/estrutura`, // A rota nova
      color: "bg-indigo-50 text-indigo-600"
    },
    // -----------------------------------------------------
    {
      title: "Assistente de Setup",
      desc: "Reconfigurar turmas e ano letivo (Wizard).",
      icon: Wand2,
      action: onOpenWizard, // Este abre o Wizard (modal/componente)
      color: "bg-teal-50 text-teal-600"
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

      {/* Grid de Cartões */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card, idx) => (
          <div 
            key={idx}
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
  );
}
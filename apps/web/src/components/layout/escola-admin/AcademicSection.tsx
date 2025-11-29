"use client";

import { Settings, TrendingUp, CreditCard, Users, BookOpen, ArrowRight } from "lucide-react";

export default function AcademicSection() {
  const items = [
    {
      title: "Configurações Acadêmicas",
      icon: Settings,
      description: "Gerir disciplinas e calendário"
    },
    {
      title: "Promoção",
      icon: TrendingUp,
      description: "Progressão de alunos"
    },
    {
      title: "Pagamentos",
      icon: CreditCard,
      description: "Gestão financeira"
    },
    {
      title: "Funcionários",
      icon: Users,
      description: "Equipe e professores"
    },
    {
      title: "Biblioteca",
      icon: BookOpen,
      description: "Acervo e empréstimos"
    },
  ];

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Gestão Acadêmica</h3>
          <p className="text-gray-500 text-sm mt-1">Configure todos os aspectos acadêmicos</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
          Ver tudo
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item, idx) => (
          <button
            key={idx}
            className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200 text-left w-full"
          >
            <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <item.icon className="w-5 h-5 text-gray-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 text-sm mb-1">{item.title}</div>
              <div className="text-gray-500 text-xs">{item.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
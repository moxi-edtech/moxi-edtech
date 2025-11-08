"use client";

import { MegaphoneIcon } from "@heroicons/react/24/outline";

export default function NoticesSection() {
  const notices = [
    {
      title: "Comunicado de Reabertura da Escola",
      date: "15 Ago 2023",
      icon: MegaphoneIcon,
      bg: "bg-emerald-50",
      color: "text-emerald-600",
    },
    {
      title: "Reunião de Pais e Professores",
      date: "10 Ago 2023",
      icon: MegaphoneIcon,
      bg: "bg-blue-50",
      color: "text-blue-600",
    },
    {
      title: "Informações do Dia do Desporto",
      date: "5 Ago 2023",
      icon: MegaphoneIcon,
      bg: "bg-orange-50",
      color: "text-orange-600",
    },
  ];

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Avisos</h2>
        <button className="px-3 py-1.5 rounded-md bg-[#0B2C45] text-white text-sm font-medium hover:bg-[#0D4C73]">
          Ver Todos
        </button>
      </div>

      <ul className="divide-y divide-gray-100">
        {notices.map((notice, idx) => (
          <li key={idx} className="flex items-center gap-4 py-3">
            <div
              className={`${notice.bg} w-10 h-10 rounded-lg flex items-center justify-center`}
            >
              <notice.icon className={`w-5 h-5 ${notice.color}`} />
            </div>
            <div className="flex-1">
              <div className="font-medium text-gray-700">{notice.title}</div>
              <div className="text-xs text-gray-500">Publicado em: {notice.date}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
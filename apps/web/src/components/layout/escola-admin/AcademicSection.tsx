"use client";

import {
  Cog6ToothIcon,
  ArrowTrendingUpIcon,
  BanknotesIcon,
  UserGroupIcon,
  BookOpenIcon,
} from "@heroicons/react/24/outline";

export default function AcademicSection() {
  const items = [
    {
      title: "Configurações Acadêmicas",
      icon: Cog6ToothIcon,
      bg: "bg-emerald-50",
      color: "text-emerald-600",
    },
    {
      title: "Promoção",
      icon: ArrowTrendingUpIcon,
      bg: "bg-blue-50",
      color: "text-blue-600",
    },
    {
      title: "Pagamentos",
      icon: BanknotesIcon,
      bg: "bg-orange-50",
      color: "text-orange-600",
    },
    {
      title: "Funcionários",
      icon: UserGroupIcon,
      bg: "bg-purple-50",
      color: "text-purple-600",
    },
    {
      title: "Biblioteca",
      icon: BookOpenIcon,
      bg: "bg-cyan-50",
      color: "text-cyan-600",
    },
  ];

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm mt-6">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-lg font-semibold text-gray-800">Gestão Acadêmica</h2>
        <button className="px-3 py-1.5 rounded-md bg-[#0B2C45] text-white text-sm font-medium hover:bg-[#0D4C73]">
          Gerir
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="bg-gray-50 rounded-lg p-5 text-center cursor-pointer hover:bg-gray-100 hover:shadow transition"
          >
            <div
              className={`${item.bg} w-14 h-14 flex items-center justify-center rounded-full mx-auto mb-3`}
            >
              <item.icon className={`w-7 h-7 ${item.color}`} />
            </div>
            <div className="font-medium text-gray-700">{item.title}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
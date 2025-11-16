"use client";

import { MegaphoneIcon } from "@heroicons/react/24/outline";

type Aviso = { id: string; titulo: string; dataISO: string };

export default function NoticesSection({ notices }: { notices?: Aviso[] }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Avisos</h2>
        <a href="#" className="px-3 py-1.5 rounded-md bg-[#0B2C45] text-white text-sm font-medium hover:bg-[#0D4C73]">
          Ver Todos
        </a>
      </div>

      {(!notices || notices.length === 0) ? (
        <p className="text-sm text-gray-500">Sem avisos.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {notices.map((notice) => (
            <li key={notice.id} className="flex items-center gap-4 py-3">
              <div className={`bg-emerald-50 w-10 h-10 rounded-lg flex items-center justify-center`}>
                <MegaphoneIcon className={`w-5 h-5 text-emerald-600`} />
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-700">{notice.titulo}</div>
                <div className="text-xs text-gray-500">Publicado em: {new Date(notice.dataISO).toLocaleDateString('pt-BR')}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

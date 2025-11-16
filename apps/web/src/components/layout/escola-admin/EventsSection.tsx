"use client";

type Evento = { id: string; titulo: string; dataISO: string };

export default function EventsSection({ events }: { events?: Evento[] }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Eventos</h2>
        <a href="#" className="px-3 py-1.5 rounded-md bg-[#0B2C45] text-white text-sm font-medium hover:bg-[#0D4C73]">
          Ver Todos
        </a>
      </div>

      {(!events || events.length === 0) ? (
        <p className="text-sm text-gray-500">Sem eventos.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {events.map((event) => (
            <li key={event.id} className="flex items-center gap-4 py-3">
              <div className={`bg-indigo-50 text-indigo-600 w-10 h-10 rounded-lg flex items-center justify-center text-lg`}>
                📅
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-700">{event.titulo}</div>
                <div className="text-xs text-gray-500">Data: {new Date(event.dataISO).toLocaleDateString('pt-BR')}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

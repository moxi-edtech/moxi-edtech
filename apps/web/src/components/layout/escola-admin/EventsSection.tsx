"use client";

export default function EventsSection() {
  const events = [
    {
      title: "Semana Cultural",
      date: "20 Set 2023",
      icon: "📅",
      bg: "bg-indigo-50",
      color: "text-indigo-600",
    },
    {
      title: "Feira de Ciências",
      date: "5 Out 2023",
      icon: "🔬",
      bg: "bg-green-50",
      color: "text-green-600",
    },
    {
      title: "Formatura da 12ª Classe",
      date: "15 Nov 2023",
      icon: "🎉",
      bg: "bg-pink-50",
      color: "text-pink-600",
    },
  ];

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Eventos</h2>
        <button className="px-3 py-1.5 rounded-md bg-[#0B2C45] text-white text-sm font-medium hover:bg-[#0D4C73]">
          Ver Todos
        </button>
      </div>

      <ul className="divide-y divide-gray-100">
        {events.map((event, idx) => (
          <li key={idx} className="flex items-center gap-4 py-3">
            <div
              className={`${event.bg} ${event.color} w-10 h-10 rounded-lg flex items-center justify-center text-lg`}
            >
              {event.icon}
            </div>
            <div className="flex-1">
              <div className="font-medium text-gray-700">{event.title}</div>
              <div className="text-xs text-gray-500">Data: {event.date}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

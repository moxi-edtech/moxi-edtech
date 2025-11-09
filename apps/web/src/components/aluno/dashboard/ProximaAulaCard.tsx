export default function ProximaAulaCard({ data }: { data: null | { weekday?: number; inicio?: string; fim?: string; sala?: string | null } }) {
  const has = Boolean(data);
  const titulo = has ? `Dia ${data?.weekday ?? '-'}` : '—';
  const detalhe = has ? `${data?.inicio ?? '-'}–${data?.fim ?? '-'}` : 'Hoje • —';
  return (
    <div className="bg-white p-6 rounded-xl shadow border">
      <h2 className="text-gray-600 text-sm font-medium">Próxima aula</h2>
      <p className="text-3xl font-bold text-indigo-600 mt-2">{titulo}</p>
      <p className="text-gray-400 text-sm">{detalhe}</p>
    </div>
  );
}

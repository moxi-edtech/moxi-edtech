export default function UltimasNotasCard({ data }: { data: null | { valor?: number; created_at?: string } }) {
  const valor = data?.valor ?? null;
  return (
    <div className="bg-white p-6 rounded-xl shadow border">
      <h2 className="text-gray-600 text-sm font-medium">Última nota</h2>
      <p className="text-3xl font-bold text-indigo-600 mt-2">{valor == null ? '—' : String(valor)}</p>
      <p className="text-gray-400 text-sm">{data?.created_at ? new Date(data.created_at).toLocaleDateString() : '—'}</p>
    </div>
  );
}

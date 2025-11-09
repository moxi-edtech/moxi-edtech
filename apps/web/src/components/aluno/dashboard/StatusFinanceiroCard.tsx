export default function StatusFinanceiroCard({ data }: { data: null | { emDia?: boolean; pendentes?: number } }) {
  const label = data?.emDia ? 'Em dia' : `Pendências: ${data?.pendentes ?? '-'}`;
  return (
    <div className="bg-white p-6 rounded-xl shadow border">
      <h2 className="text-gray-600 text-sm font-medium">Status financeiro</h2>
      <p className="text-3xl font-bold text-indigo-600 mt-2">{label}</p>
      <p className="text-gray-400 text-sm">Resumo</p>
    </div>
  );
}

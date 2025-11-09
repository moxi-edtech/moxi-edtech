export default function AvisosRecentesCard({ items }: { items: Array<{ id: string; titulo: string; resumo: string; origem: string; data: string }> }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow border">
      <h2 className="text-gray-600 text-sm font-medium mb-3">Avisos recentes</h2>
      {items.length === 0 ? (
        <div className="text-sm text-gray-600">Nenhum aviso por enquanto.</div>
      ) : (
        <ul className="space-y-2">
          {items.map((a) => (
            <li key={a.id} className="text-sm">
              <div className="text-gray-500">{a.origem} • {new Date(a.data).toLocaleDateString()}</div>
              <div className="font-medium">{a.titulo}</div>
              <div className="text-gray-600">{a.resumo}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

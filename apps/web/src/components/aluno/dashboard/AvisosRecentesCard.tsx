import { Notice } from "@/components/ui/alert";
import { AlunoCard } from "@/components/aluno/shared/AlunoCard";

export default function AvisosRecentesCard({ items }: { items: Array<{ id: string; titulo: string; resumo: string; origem: string; data: string }> }) {
  return (
    <AlunoCard>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">Avisos recentes</p>
        <span className="text-xs text-slate-400">Atualizações</span>
      </div>
      {items.length === 0 ? (
        <div className="mt-3 text-sm text-slate-500">Nenhum aviso por enquanto.</div>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((a) => (
            <li key={a.id}><Notice title={a.titulo} description={a.resumo} eyebrow={`${a.origem} • ${new Date(a.data).toLocaleDateString("pt-AO")}`} className="mb-0" /></li>
          ))}
        </ul>
      )}
    </AlunoCard>
  );
}

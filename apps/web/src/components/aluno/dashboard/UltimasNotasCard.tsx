import { Award } from "lucide-react";
import { AlunoCard } from "@/components/aluno/shared/AlunoCard";
import { SectionTitle } from "@/components/aluno/shared/SectionTitle";

export default function UltimasNotasCard({ data }: { data: null | { valor?: number; created_at?: string } }) {
  const valor = data?.valor ?? null;
  const highlight = valor == null ? "text-slate-400" : valor >= 14 ? "text-klasse-green-600" : valor >= 10 ? "text-klasse-gold-600" : "text-rose-500";
  return (
    <AlunoCard>
      <div className="flex items-center justify-between">
        <SectionTitle>Última nota</SectionTitle>
        <Award className="h-4 w-4 text-slate-400" />
      </div>
      <p className={`mt-3 text-2xl font-semibold ${highlight}`}>{valor == null ? "—" : String(valor)}</p>
      <p className="text-sm text-slate-500">
        {data?.created_at ? new Date(data.created_at).toLocaleDateString("pt-PT") : "—"}
      </p>
    </AlunoCard>
  );
}

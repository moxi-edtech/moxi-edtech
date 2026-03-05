import { Wallet } from "lucide-react";
import { AlunoCard } from "@/components/aluno/shared/AlunoCard";
import { SectionTitle } from "@/components/aluno/shared/SectionTitle";

export default function StatusFinanceiroCard({ data }: { data: null | { emDia?: boolean; pendentes?: number } }) {
  const pendentes = data?.pendentes ?? 0;
  const emDia = Boolean(data?.emDia);
  const label = emDia ? "Em dia" : `Pendentes: ${pendentes}`;
  const color = emDia ? "text-klasse-green-700" : pendentes > 0 ? "text-klasse-gold-700" : "text-slate-500";

  return (
    <AlunoCard>
      <div className="flex items-center justify-between">
        <SectionTitle>Financeiro</SectionTitle>
        <Wallet className="h-4 w-4 text-slate-400" />
      </div>
      <p className={`mt-3 text-2xl font-semibold ${color}`}>{label}</p>
      <p className="text-sm text-slate-500">Resumo do aluno</p>
    </AlunoCard>
  );
}

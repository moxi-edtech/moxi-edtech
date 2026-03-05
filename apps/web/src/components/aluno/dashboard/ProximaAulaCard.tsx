import { CalendarClock } from "lucide-react";
import { AlunoCard } from "@/components/aluno/shared/AlunoCard";
import { SectionTitle } from "@/components/aluno/shared/SectionTitle";

export default function ProximaAulaCard({
  data,
}: {
  data: null | { weekday?: number; inicio?: string; fim?: string; sala?: string | null };
}) {
  const has = Boolean(data);
  const titulo = has ? `Dia ${data?.weekday ?? "—"}` : "—";
  const detalhe = has ? `${data?.inicio ?? "—"}–${data?.fim ?? "—"}` : "Hoje • —";
  const sala = data?.sala ? `Sala ${data.sala}` : null;

  return (
    <AlunoCard>
      <div className="flex items-center justify-between">
        <SectionTitle>Próxima aula</SectionTitle>
        <CalendarClock className="h-4 w-4 text-slate-400" />
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-900">{titulo}</p>
      <p className="text-sm text-slate-500">{detalhe}</p>
      {sala && <p className="mt-2 text-xs text-slate-400">{sala}</p>}
    </AlunoCard>
  );
}

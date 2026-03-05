import { FileText } from "lucide-react";
import { AlunoCard } from "@/components/aluno/shared/AlunoCard";
import { Pill } from "@/components/aluno/shared/Pill";

export function TabDocumentos() {
  return (
    <div className="space-y-4">
      <AlunoCard>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Documentos</p>
            <p className="text-xs text-slate-500">Emissão rápida e segura.</p>
          </div>
          <FileText className="h-5 w-5 text-slate-400" />
        </div>
      </AlunoCard>

      <AlunoCard className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Boletim de notas</p>
          <p className="text-xs text-slate-500">Disponível em breve</p>
        </div>
        <Pill label="Em breve" colorClass="text-slate-500" bgClass="bg-slate-100" />
      </AlunoCard>
    </div>
  );
}

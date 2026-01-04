"use client";

import { Loader2, KeyRound } from "lucide-react";
import { useEscolaId } from "@/hooks/useEscolaId";
import { LiberarAcessoAlunos } from "@/components/secretaria/LiberarAcessoAlunos";

export default function SecretariaAcessoPage() {
  const { escolaId, isLoading, error } = useEscolaId();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-slate-600 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Carregando escola...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-red-700 bg-red-50 border border-red-200 rounded-xl p-6">
        {error}
      </div>
    );
  }

  if (!escolaId) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-600 gap-2">
        <KeyRound className="w-6 h-6" />
        Vincule-se a uma escola para liberar acessos.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <KeyRound className="w-4 h-4 text-teal-600" />
            Portal do Aluno
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Liberação de Acesso</h1>
          <p className="text-sm text-slate-500 mt-1">
            Gere códigos e credenciais para que os alunos acessem o portal.
          </p>
        </div>
      </div>

      <LiberarAcessoAlunos escolaId={escolaId} />
    </div>
  );
}


'use client'

import { useState } from "react";
import { FileText, Download, Loader2, CheckCircle2 } from "lucide-react";
import { AlunoCard } from "@/components/aluno/shared/AlunoCard";
import { Pill } from "@/components/aluno/shared/Pill";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/components/feedback/FeedbackSystem";

export function TabDocumentos() {
  const searchParams = useSearchParams();
  const { error } = useToast();
  const studentId = searchParams?.get("aluno") ?? null;
  
  const [loading, setLoading] = useState<string | null>(null);

  const handleEmit = async (type: 'boletim' | 'declaracao') => {
    setLoading(type);
    try {
      const res = await fetch(`/api/aluno/documentos/emitir${studentId ? `?studentId=${studentId}` : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao emitir documento');
      
      if (json.url) {
        window.open(json.url, '_blank');
      }
    } catch (err: any) {
      error("Erro na emissão", "Não conseguimos gerar o seu documento no momento. Por favor, tente novamente em instantes.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <header className="px-1">
        <h2 className="text-lg font-bold text-slate-900">Secretaria Digital</h2>
        <p className="text-xs text-slate-500">Emissão de documentos oficiais com validação digital.</p>
      </header>

      <AlunoCard 
        onClick={() => !loading && handleEmit('boletim')}
        className="group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-100">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Boletim de Notas</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Histórico trimestral atualizado</p>
            </div>
          </div>
          {loading === 'boletim' ? (
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          ) : (
            <Download className="h-4 w-4 text-slate-300 transition-colors group-hover:text-blue-600" />
          )}
        </div>
      </AlunoCard>

      <AlunoCard 
        onClick={() => !loading && handleEmit('declaracao')}
        className="group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-klasse-green-50 text-klasse-green-600 transition-colors group-hover:bg-klasse-green-100">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Declaração de Matrícula</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Comprovativo de vínculo ativo</p>
            </div>
          </div>
          {loading === 'declaracao' ? (
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          ) : (
            <Download className="h-4 w-4 text-slate-300 transition-colors group-hover:text-klasse-green-600" />
          )}
        </div>
      </AlunoCard>

      <div className="mt-8 p-4 rounded-2xl bg-slate-100 border border-slate-200">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Dica de Segurança</p>
        <p className="text-xs text-slate-600 leading-relaxed">
          Todos os documentos emitidos pelo portal possuem um <strong>QR Code de Autenticidade</strong>. 
          A escola ou qualquer instituição interessada pode validar o documento apontando a câmera para o código.
        </p>
      </div>
    </div>
  );
}

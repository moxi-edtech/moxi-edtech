"use client";

import { useEffect, useState } from "react";
import { 
  UserCircle, Fingerprint, Calendar, Loader2, Save, X, AlertCircle
} from "lucide-react";
import { ModalShell } from "@/components/ui/ModalShell";
import { useToast } from "@/components/feedback/FeedbackSystem";

export interface FichaRapidaModalProps {
  alunoId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function FichaRapidaModal({ alunoId, onClose, onSuccess }: FichaRapidaModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aluno, setAluno] = useState<any>(null);
  const { toast } = useToast();

  const [form, setForm] = useState({
    bi_numero: "",
    data_nascimento: "",
    pai_nome: "",
    mae_nome: "",
    responsavel: "",
    telefone_responsavel: "",
  });

  useEffect(() => {
    setLoading(true);
    fetch(`/api/secretaria/alunos/${alunoId}`)
      .then(r => r.json())
      .then(j => {
        if (j.ok) {
          setAluno(j.item);
          setForm({
            bi_numero: j.item.bi_numero || "",
            data_nascimento: j.item.data_nascimento || "",
            pai_nome: j.item.pai_nome || "",
            mae_nome: j.item.mae_nome || "",
            responsavel: j.item.responsavel || j.item.responsavel_nome || "",
            telefone_responsavel: j.item.telefone_responsavel || j.item.responsavel_contato || "",
          });
        } else {
          setError(j.error);
        }
      })
      .catch(() => setError("Falha ao carregar dados do aluno"))
      .finally(() => setLoading(false));
  }, [alunoId]);

  const handleSave = async () => {
    const hasData = Object.values(form).some(v => v.trim() !== "");
    if (!hasData) {
       toast({ title: "Nada para salvar", message: "Preencha pelo menos um campo.", variant: "warning" });
       return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/secretaria/alunos/${alunoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: "Ficha atualizada", message: "Os dados foram salvos com sucesso.", variant: "success" });
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toast({ title: "Erro ao salvar", message: json.error, variant: "error" });
      }
    } catch {
      toast({ title: "Erro de conexão", message: "Não foi possível comunicar com o servidor.", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      open={true}
      onClose={onClose}
      title="Completar Ficha do Aluno"
      description={aluno?.nome || "Carregando..."}
    >
      <div className="space-y-6 py-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
             <Loader2 className="w-8 h-8 text-klasse-gold animate-spin" />
             <p className="text-sm text-slate-500 font-medium">Localizando ficha do aluno...</p>
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6 text-center space-y-3">
             <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
             <p className="text-sm font-bold text-rose-900">{error}</p>
             <button onClick={onClose} className="text-xs font-bold uppercase text-rose-600 hover:underline">Fechar</button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100 shrink-0">
                  <UserCircle className="text-slate-400" />
               </div>
               <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aluno</p>
                  <p className="text-sm font-black text-slate-900 truncate">{aluno.nome}</p>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                   <Fingerprint size={12} /> Nº do BI / NIF
                </label>
                <input 
                  type="text" 
                  value={form.bi_numero}
                  onChange={e => setForm(p => ({ ...p, bi_numero: e.target.value.toUpperCase() }))}
                  placeholder="Ex: 001234567LA041"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:ring-4 focus:ring-klasse-gold/10 focus:border-klasse-gold transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                   <Calendar size={12} /> Data de Nascimento
                </label>
                <input 
                  type="date" 
                  value={form.data_nascimento}
                  onChange={e => setForm(p => ({ ...p, data_nascimento: e.target.value }))}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:ring-4 focus:ring-klasse-gold/10 focus:border-klasse-gold transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nome do Pai</label>
                <input 
                  type="text" 
                  value={form.pai_nome}
                  onChange={e => setForm(p => ({ ...p, pai_nome: e.target.value }))}
                  placeholder="Nome completo do pai"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:ring-4 focus:ring-klasse-gold/10 focus:border-klasse-gold transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nome da Mãe</label>
                <input 
                  type="text" 
                  value={form.mae_nome}
                  onChange={e => setForm(p => ({ ...p, mae_nome: e.target.value }))}
                  placeholder="Nome completo da mãe"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:ring-4 focus:ring-klasse-gold/10 focus:border-klasse-gold transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Encarregado</label>
                <input 
                  type="text" 
                  value={form.responsavel}
                  onChange={e => setForm(p => ({ ...p, responsavel: e.target.value }))}
                  placeholder="Nome do encarregado"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:ring-4 focus:ring-klasse-gold/10 focus:border-klasse-gold transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Telefone Encarregado</label>
                <input 
                  type="text" 
                  value={form.telefone_responsavel}
                  onChange={e => setForm(p => ({ ...p, telefone_responsavel: e.target.value }))}
                  placeholder="Ex: 923 000 000"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:ring-4 focus:ring-klasse-gold/10 focus:border-klasse-gold transition-all"
                />
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
               <p className="text-[11px] text-amber-800 leading-relaxed italic">
                 * Para anexar cópias de documentos ou fotos, utilize o Perfil Completo do Aluno. Esta janela é para regularização rápida de dados cadastrais.
               </p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
               <button 
                onClick={onClose}
                disabled={saving}
                className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all flex items-center gap-2"
               >
                 <X size={16} /> Cancelar
               </button>
               <button 
                onClick={handleSave}
                disabled={saving}
                className="px-8 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-sm hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
               >
                 {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                 Salvar Ficha
               </button>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}

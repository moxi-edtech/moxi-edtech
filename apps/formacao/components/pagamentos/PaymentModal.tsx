"use client";

import { useEffect, useState } from "react";
import { Upload, X, CheckCircle2, CreditCard, Loader2, ArrowRight } from "lucide-react";
import { toast } from "@/lib/toast";

type Item = { id: string; descricao: string; valor_total: number };
const money = new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 });
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export function PaymentModal({ 
  open, 
  item, 
  onClose, 
  onUploaded,
  iban
}: { 
  open: boolean; 
  item: Item | null; 
  onClose: () => void; 
  onUploaded: (id: string) => void;
  iban?: string;
}) {
  const [sending, setSending] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [valorInformado, setValorInformado] = useState("");
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    if (!open) {
      setFile(null);
      setValorInformado("");
      setMensagem("");
    }
  }, [open]);

  if (!open || !item) return null;

  const handleSubmit = async () => {
    if (!file) {
      alert("Por favor, selecione um comprovativo.");
      return;
    }

    setSending(true);
    try {
      const fd = new FormData();
      fd.append("itemId", item.id);
      fd.append("file", file);
      if (valorInformado) fd.append("valorInformado", valorInformado);
      if (mensagem) fd.append("mensagem", mensagem);

      const res = await fetch("/api/formacao/pagamentos/comprovativo", {
        method: "POST",
        body: fd,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Falha no upload");

      toast({ title: "Enviado!", description: "A secretaria irá validar o pagamento em breve." });
      onUploaded(item.id);
      onClose();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-300">
        <header className="relative border-b border-slate-100 bg-slate-50/50 p-6">
          <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-white hover:text-slate-600">
            <X size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1F6B3B] text-white shadow-lg shadow-[#1F6B3B]/20">
              <CreditCard size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-[#1F6B3B]">Pagamento</h3>
              <p className="text-xs font-semibold text-slate-600">{item.descricao}</p>
            </div>
          </div>
        </header>

        <div className="p-6 space-y-6">
          <div className="rounded-2xl border-2 border-dashed border-[#E3B23C]/20 bg-[#E3B23C]/5 p-5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#E3B23C]">Transferência Bancária</p>
            <h4 className="mt-2 text-lg font-black tracking-tight text-slate-900">{iban || "AO06 0000 0000 0000 0000 0000 0"}</h4>
            <p className="mt-1 text-xs text-slate-500 italic">Destinatário: Centro de Formação</p>
          </div>

          <div className="space-y-4">
            <div className="grid gap-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Valor Transferido (Opcional)</label>
              <input 
                type="number"
                value={valorInformado}
                onChange={(e) => setValorInformado(e.target.value)}
                placeholder={String(item.valor_total)}
                className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-3 text-sm outline-none transition-all focus:bg-white focus:ring-8 focus:ring-[#1F6B3B]/5 focus:border-[#1F6B3B] font-bold"
              />
            </div>

            <div className="group relative flex flex-col items-center justify-center rounded-[2rem] border-4 border-dashed min-h-[180px] transition-all duration-500 border-slate-100 bg-slate-50 hover:border-[#1F6B3B] hover:bg-white">
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="absolute inset-0 cursor-pointer opacity-0 z-10"
                accept="image/*,.pdf"
              />
              {file ? (
                <div className="flex flex-col items-center p-6 text-center">
                  <CheckCircle2 className="text-emerald-500 mb-2" size={48} />
                  <p className="text-sm font-black text-slate-900 truncate max-w-[240px]">{file.name}</p>
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Talão Selecionado</span>
                </div>
              ) : (
                <div className="flex flex-col items-center p-6 text-center">
                  <Upload className="text-slate-300 group-hover:text-[#1F6B3B] mb-3" size={32} />
                  <p className="text-sm font-black text-slate-900">Anexar Comprovativo</p>
                  <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-tighter">JPG, PNG ou PDF (Máx 5MB)</p>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={sending || !file}
            className="w-full flex items-center justify-center gap-2 rounded-[2rem] bg-[#1F6B3B] py-5 text-sm font-black text-white shadow-2xl shadow-[#1F6B3B]/30 transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
          >
            {sending ? <Loader2 size={20} className="animate-spin" /> : <>Confirmar Envio <ArrowRight size={18} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}

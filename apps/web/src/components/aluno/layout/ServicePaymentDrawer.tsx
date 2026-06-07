"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { X, Upload, CheckCircle2, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const money = new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 });
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

function uploadWithProgress(url: string, formData: FormData, onProgress: (pct: number) => void) {
  return new Promise<{ ok?: boolean; error?: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText || "{}");
        if (xhr.status >= 200 && xhr.status < 300) resolve(json);
        else reject(new Error(json?.error ?? "Falha no upload"));
      } catch {
        reject(new Error("Resposta inválida do servidor"));
      }
    };
    xhr.onerror = () => reject(new Error("Falha de rede ao enviar comprovativo"));
    xhr.send(formData);
  });
}

export function ServicePaymentDrawer({
  open,
  documento,
  dadosPagamento,
  onClose,
  onSuccess,
}: {
  open: boolean;
  documento: { codigo: string, nome: string, valor: number, intentId?: string | null } | null;
  dadosPagamento: {
    iban?: string;
    banco?: string;
    titular_conta?: string;
    kwik_chave?: string;
  } | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState("");

  if (!open || !documento) return null;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const original = e.target.files?.[0];
    if (!original) return;

    setError(null);
    if (!ALLOWED.includes(original.type)) {
      setError("Tipo inválido. Envie PDF, JPG, PNG ou WEBP.");
      return;
    }

    if (original.size > MAX_BYTES) {
      setError("Arquivo muito grande. Limite de 5MB.");
      return;
    }

    const fd = new FormData();
    fd.append("intentId", documento.intentId || "");
    fd.append("file", original);
    if (mensagem.trim()) fd.append("mensagem", mensagem.trim());

    setSending(true);
    setProgress(0);

    try {
      const json = await uploadWithProgress("/api/aluno/documentos/comprovativo", fd, setProgress);
      if (!json?.ok) throw new Error(json?.error ?? "Falha ao enviar");
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Erro ao enviar comprovativo");
    } finally {
      setSending(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end justify-center"
        onClick={onClose}
      >
        <motion.div 
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="w-full max-w-lg bg-white rounded-t-[2.5rem] shadow-2xl p-6 pb-12 overflow-y-auto max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-slate-900">Pagamento de Serviço</h3>
            <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition">
              <X size={20} />
            </button>
          </div>

          <div className="bg-slate-50 rounded-3xl p-5 mb-6 border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Documento Solicitado</p>
            <p className="text-lg font-black text-slate-900">{documento.nome}</p>
            <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-slate-500">Valor a pagar:</span>
                <span className="text-xl font-black text-klasse-green">{money.format(documento.valor)}</span>
            </div>
          </div>

          {dadosPagamento && (
            <div className="mb-6 rounded-2xl bg-klasse-green-50/50 p-4 border border-klasse-green-100">
                <p className="text-[10px] font-bold text-klasse-green-700 uppercase tracking-widest mb-3">Coordenadas para Pagamento</p>
                <div className="space-y-2 text-sm text-slate-700 font-medium">
                    {dadosPagamento.banco && <p><span className="text-slate-400 font-normal">Banco:</span> {dadosPagamento.banco}</p>}
                    {dadosPagamento.iban && (
                        <div className="flex items-center justify-between gap-2">
                            <p className="break-all text-xs"><span className="text-slate-400 font-normal">IBAN:</span> {dadosPagamento.iban}</p>
                        </div>
                    )}
                    {dadosPagamento.titular_conta && <p><span className="text-slate-400 font-normal">Titular:</span> {dadosPagamento.titular_conta}</p>}
                    {dadosPagamento.kwik_chave && <p><span className="text-slate-400 font-normal">KWIK:</span> {dadosPagamento.kwik_chave}</p>}
                </div>
            </div>
          )}

          <div className="space-y-4">
             <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">
                    Mensagem (opcional)
                </label>
                <textarea
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                    placeholder="Alguma observação sobre o pagamento?"
                    className="w-full rounded-2xl border-slate-200 text-sm focus:ring-klasse-green focus:border-klasse-green p-4 bg-slate-50 border-0"
                    rows={2}
                    disabled={sending}
                />
             </div>

             <div className="relative">
                <input
                    type="file"
                    id="doc-upload"
                    className="hidden"
                    accept=".pdf,image/jpeg,image/png,image/webp"
                    onChange={handleUpload}
                    disabled={sending}
                />
                <label 
                    htmlFor="doc-upload"
                    className={`flex flex-col items-center justify-center gap-3 w-full py-8 border-2 border-dashed rounded-[2rem] transition-all cursor-pointer ${
                        sending ? 'bg-slate-50 border-slate-200' : 'bg-klasse-green-50/30 border-klasse-green-200 hover:bg-klasse-green-50'
                    }`}
                >
                    {sending ? (
                        <>
                            <Loader2 size={32} className="text-klasse-green animate-spin" />
                            <p className="text-sm font-bold text-klasse-green">Enviando... {progress}%</p>
                        </>
                    ) : (
                        <>
                            <div className="h-12 w-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-klasse-green">
                                <Upload size={24} />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-bold text-slate-900">Anexar Comprovativo</p>
                                <p className="text-[10px] text-slate-500 mt-1">PDF ou Imagem (Máx 5MB)</p>
                            </div>
                        </>
                    )}
                </label>
             </div>

             {error && (
                <div className="p-3 bg-rose-50 text-rose-600 rounded-xl text-[11px] font-bold flex items-center gap-2">
                    <X size={14} /> {error}
                </div>
             )}
          </div>

          <p className="mt-6 text-[10px] text-slate-400 text-center leading-relaxed px-4">
            Após o envio, a secretaria irá validar o recebimento. <br/>
            O documento será liberado para download automaticamente.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

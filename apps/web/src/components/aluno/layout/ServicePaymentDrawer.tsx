"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Upload, Loader2 } from "lucide-react";

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
  studentId,
  academicYearId,
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
  studentId?: string | null;
  academicYearId?: string | null;
}) {
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setProgress(0);
      setMensagem("");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open, documento?.intentId]);

  const selectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const original = e.target.files?.[0];
    setSelectedFile(null);
    if (!original) return;

    setError(null);
    if (!ALLOWED.includes(original.type)) {
      setError("Tipo inválido. Envie PDF, JPG, PNG ou WEBP.");
      return;
    }

    if (original.size === 0) {
      setError("O comprovativo está vazio.");
      return;
    }
    if (original.size > MAX_BYTES) {
      setError("Arquivo muito grande. Limite de 5MB.");
      return;
    }
    setSelectedFile(original);
  };

  const handleUpload = async () => {
    if (!documento?.intentId || !selectedFile || sending) return;
    const original = selectedFile;
    const fd = new FormData();
    fd.append("intentId", documento.intentId || "");
    fd.append("file", original);
    if (studentId) fd.append("studentId", studentId);
    if (academicYearId) fd.append("ano_letivo_id", academicYearId);
    if (mensagem.trim()) fd.append("mensagem", mensagem.trim());

    setSending(true);
    setProgress(0);

    try {
      const json = await uploadWithProgress("/api/aluno/documentos/comprovativo", fd, setProgress);
      if (!json?.ok) throw new Error(json?.error ?? "Falha ao enviar");
      setSelectedFile(null);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao enviar comprovativo");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open && Boolean(documento)} onOpenChange={(next) => { if (!next && !sending) onClose(); }}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto rounded-2xl bg-background p-5 text-foreground sm:p-6">
        <DialogTitle>Pagamento do boletim</DialogTitle>
        <DialogDescription>
          Confere o valor, realiza a transferência e envia o comprovativo. A secretaria irá validar antes de liberar as notas.
        </DialogDescription>
        {documento && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/50 p-4">
              <p className="text-xs font-medium text-muted-foreground">Serviço solicitado</p>
              <p className="mt-1 font-semibold">{documento.nome}</p>
              <p className="mt-2 text-lg font-semibold">{money.format(documento.valor)}</p>
            </div>
            {!dadosPagamento?.iban && !dadosPagamento?.kwik_chave ? (
              <p role="status" className="rounded-xl border border-amber-500/40 p-3 text-sm">
                A escola ainda não disponibilizou IBAN ou chave KWIK. Confirma os dados com a secretaria antes de pagar.
              </p>
            ) : (
              <div className="space-y-1 rounded-xl border border-border p-4 text-sm">
                <p className="font-semibold">Dados para pagamento</p>
                {dadosPagamento?.banco && <p>Banco: {dadosPagamento.banco}</p>}
                {dadosPagamento?.iban && <p className="break-all">IBAN: {dadosPagamento.iban}</p>}
                {dadosPagamento?.titular_conta && <p>Titular: {dadosPagamento.titular_conta}</p>}
                {dadosPagamento?.kwik_chave && <p>KWIK: {dadosPagamento.kwik_chave}</p>}
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor={fileInputId + "-message"} className="text-sm font-medium">Mensagem à secretaria (opcional)</label>
              <textarea id={fileInputId + "-message"} value={mensagem} onChange={(event) => setMensagem(event.target.value)}
                disabled={sending} maxLength={500} rows={2} placeholder="Ex.: Referência da transferência"
                className="w-full rounded-lg border border-input bg-background p-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <div className="space-y-2">
              <label htmlFor={fileInputId} className="text-sm font-medium">Comprovativo (PDF ou imagem, até 5 MB)</label>
              <input ref={fileInputRef} id={fileInputId} type="file" accept=".pdf,image/jpeg,image/png,image/webp"
                onChange={selectFile} disabled={sending}
                className="block w-full rounded-lg border border-input bg-background p-3 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              {selectedFile && <p className="break-all text-sm text-muted-foreground">Selecionado: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB). Ainda não foi enviado.</p>}
            </div>
            {sending && <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> A enviar comprovativo: {progress}%</p>}
            {error && <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
            <p className="text-sm text-muted-foreground">O envio não confirma o pagamento. Aguarda a validação da secretaria; não precisas de realizar outra transferência.</p>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={onClose} disabled={sending} className="min-h-11 rounded-lg border border-border px-4 text-sm font-semibold disabled:opacity-50">Cancelar</button>
              <button type="button" onClick={() => void handleUpload()} disabled={!selectedFile || !documento.intentId || sending}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
                <Upload className="h-4 w-4" /> {sending ? "A enviar…" : "Confirmar e enviar comprovativo"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

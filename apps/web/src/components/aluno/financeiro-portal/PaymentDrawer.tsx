"use client";

import { useEffect, useRef, useState } from "react";
import { PortalSheet } from "@/components/portal/ui/PortalSheet";

type Mensalidade = { id: string; competencia: string; valor: number };
type DadosPagamento = {
  iban?: string;
  banco?: string;
  titular?: string;
  titular_conta?: string;
  kwik_chave?: string;
};
const money = new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 });
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file);
  const maxW = 1600;
  const ratio = Math.min(1, maxW / bitmap.width);
  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.78));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
}

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

export function PaymentDrawer({
  open,
  mensalidades,
  dadosPagamento,
  onClose,
  onUploaded,
  studentId,
}: {
  open: boolean;
  mensalidades: Mensalidade[];
  dadosPagamento: DadosPagamento | null;
  onClose: () => void;
  onUploaded: (mensalidadeIds: string[]) => void;
  studentId?: string | null;
}) {
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [friendlyError, setFriendlyError] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!open) return;
    setMensagem("");
    setSelectedFile(null);
    setFriendlyError(null);
    setProgress(0);
  }, [open, studentId]);

  const total = mensalidades.reduce((sum, item) => sum + item.valor, 0);

  const submitFile = async (original: File) => {
    if (inFlight.current || !mensalidades.length) return;
    setFriendlyError(null);
    if (!ALLOWED.includes(original.type) || original.size === 0) {
      setFriendlyError("Tipo inválido. Envie PDF, JPG, PNG ou WEBP.");
      return;
    }

    inFlight.current = true;
    setSending(true);
    setProgress(0);
    try {
    const file = await compressImage(original);
    if (file.size > MAX_BYTES) {
      setFriendlyError("Arquivo muito grande. Limite de 5MB após compressão.");
      return;
    }

    const fd = new FormData();
    mensalidades.forEach((item) => fd.append("mensalidadeIds", item.id));
    fd.append("file", file);
    if (mensagem.trim()) {
      fd.append("mensagem", mensagem.trim());
    }
    if (studentId) fd.append("studentId", studentId);

      const json = await uploadWithProgress("/api/aluno/financeiro/comprovativo", fd, setProgress);
      if (!json?.ok) throw new Error(json?.error ?? "Falha ao anexar comprovativo");
      onUploaded(mensalidades.map((item) => item.id));
      onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Não foi possível anexar o comprovativo. Tente novamente.";
      setFriendlyError(message);
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };

  return (
    <PortalSheet open={open && mensalidades.length > 0} onClose={onClose} busy={sending} size="expanded" title="Pagamento consolidado" description={`${mensalidades.length} mensalidade(s) · Total exacto: ${money.format(total)}`}
      footer={<button type="button" disabled={!selectedFile || sending || !mensalidades.length} onClick={() => { if (selectedFile) void submitFile(selectedFile); }} className="klasse-portal-press min-h-11 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{sending ? "A enviar…" : "Confirmar e enviar comprovativo"}</button>}>
        <div className="mt-3 flex flex-wrap gap-2">
          {mensalidades.map((item) => <span key={item.id} className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">{item.competencia} · {money.format(item.valor)}</span>)}
        </div>
        <div className="mt-4 rounded-xl bg-muted p-3 text-sm text-foreground">
          <p className="font-medium text-foreground">Coordenadas bancárias</p>
          <p>Banco: {dadosPagamento?.banco || "Consultar secretaria"}</p>
          <p className="break-all">IBAN: {dadosPagamento?.iban || "Indisponível no momento"}</p>
          {(dadosPagamento?.titular_conta || dadosPagamento?.titular) && (
            <p>Titular: {dadosPagamento?.titular_conta || dadosPagamento?.titular}</p>
          )}
          {dadosPagamento?.kwik_chave && <p>KWIK: {dadosPagamento.kwik_chave}</p>}
          {mensalidades[0] && <p>Referência: LOTE-{mensalidades[0].id.slice(0, 8).toUpperCase()}</p>}
        </div>
        <label className="mt-4 block">
          <span className="mb-2 block text-xs text-muted-foreground">Mensagem para a secretaria (opcional)</span>
          <textarea
            className="block w-full rounded-xl border border-border px-3 py-2 text-sm"
            rows={3}
            maxLength={500}
            placeholder="Ex.: Pagamento parcial enviado da conta do encarregado."
            value={mensagem}
            onChange={(event) => setMensagem(event.target.value)}
            disabled={sending}
          />
        </label>
        <label className="mt-4 block">
          <span className="mb-2 block text-xs text-muted-foreground">Comprovativo (PDF/Imagem)</span>
          <input type="file" className="block min-h-11 w-full rounded-xl border border-border bg-card p-2 text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-muted file:px-3 file:py-2 file:text-foreground focus-visible:ring-2 focus-visible:ring-ring" accept=".pdf,image/jpeg,image/png,image/webp" onChange={(e) => { setFriendlyError(null); setSelectedFile(e.target.files?.[0] ?? null); }} disabled={sending} />
        </label>
        {sending && <p role="status" aria-live="polite" className="mt-2 text-sm text-muted-foreground">A enviar comprovativo: {progress}%</p>}
        {friendlyError && <p role="alert" className="mt-2 text-sm text-destructive">{friendlyError}</p>}
        {selectedFile && <p className="break-all text-sm text-muted-foreground">Ficheiro seleccionado: {selectedFile.name}</p>}
        <p className="text-xs text-muted-foreground">Confirma o envio. O comprovativo será validado pela secretaria.</p>
    </PortalSheet>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

type Mensalidade = { id: string; competencia: string; valor: number };
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

export function PaymentDrawer({ open, mensalidade, onClose, onUploaded, studentId }: { open: boolean; mensalidade: Mensalidade | null; onClose: () => void; onUploaded: (mensalidadeId: string) => void; studentId?: string | null; }) {
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [friendlyError, setFriendlyError] = useState<string | null>(null);
  const [valorInformado, setValorInformado] = useState("");
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    if (!open || !mensalidade) return;
    setValorInformado("");
    setMensagem("");
  }, [open, mensalidade]);

  if (!open || !mensalidade) return null;

  const submitFile = async (original: File) => {
    setFriendlyError(null);
    if (!ALLOWED.includes(original.type)) {
      setFriendlyError("Tipo inválido. Envie PDF, JPG, PNG ou WEBP.");
      return;
    }

    const file = await compressImage(original);
    if (file.size > MAX_BYTES) {
      setFriendlyError("Arquivo muito grande. Limite de 5MB após compressão.");
      return;
    }

    const fd = new FormData();
    fd.append("mensalidadeId", mensalidade.id);
    fd.append("file", file);
    const valorAtual = valorInformado.trim();
    if (valorAtual) {
      const parsed = Number(valorAtual.replace(",", "."));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setFriendlyError("Valor informado inválido.");
        return;
      }
      fd.append("valorInformado", String(parsed));
    }
    if (mensagem.trim()) {
      fd.append("mensagem", mensagem.trim());
    }
    if (studentId) fd.append("studentId", studentId);

    setSending(true);
    setProgress(0);
    try {
      const json = await uploadWithProgress("/api/aluno/financeiro/comprovativo", fd, setProgress);
      if (!json?.ok) throw new Error(json?.error ?? "Falha ao anexar comprovativo");
      setValorInformado("");
      onUploaded(mensalidade.id);
      onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Não foi possível anexar o comprovativo. Tente novamente.";
      setFriendlyError(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose}>
      <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-4 shadow-xl" style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-semibold text-slate-900">Pagamento — {mensalidade.competencia}</p>
        <p className="text-xs text-slate-500">Valor: {money.format(mensalidade.valor)}</p>
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-medium text-slate-900">Coordenadas bancárias</p>
          <p>Banco: BFA</p>
          <p>IBAN: AO06 0000 0000 0000 0000 0000 0</p>
          <p>Referência: MENS-{mensalidade.id.slice(0, 8).toUpperCase()}</p>
        </div>
        <label className="mt-4 block">
          <span className="mb-2 block text-xs text-slate-500">Valor enviado (opcional para parcial)</span>
          <input
            type="number"
            min={1}
            step="0.01"
            className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder={String(mensalidade.valor)}
            value={valorInformado}
            onChange={(event) => setValorInformado(event.target.value)}
            disabled={sending}
          />
        </label>
        <label className="mt-4 block">
          <span className="mb-2 block text-xs text-slate-500">Mensagem para a secretaria (opcional)</span>
          <textarea
            className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            rows={3}
            maxLength={500}
            placeholder="Ex.: Pagamento parcial enviado da conta do encarregado."
            value={mensagem}
            onChange={(event) => setMensagem(event.target.value)}
            disabled={sending}
          />
        </label>
        <label className="mt-4 block">
          <span className="mb-2 block text-xs text-slate-500">Comprovativo (PDF/Imagem)</span>
          <input type="file" className="block w-full text-sm" accept=".pdf,image/jpeg,image/png,image/webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) void submitFile(f); }} disabled={sending} />
        </label>
        {sending && <p className="mt-2 text-xs text-slate-500">Upload: {progress}%</p>}
        {friendlyError && <p className="mt-2 text-xs text-red-600">{friendlyError}</p>}
        <Button tone="green" className="mt-4 min-h-11 w-full" disabled={sending}>{sending ? "A anexar..." : "Anexar Comprovativo"}</Button>
      </div>
    </div>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, X, FileText, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import imageCompression from 'browser-image-compression';

interface DocumentUploadProps {
  label: string;
  description: string;
  onUploadSuccess: (url: string) => void;
  onRemove?: (path: string) => Promise<void> | void;
  escolaId: string;
  candidaturaId: string;
  initialPath?: string | null;
}

export function DocumentUpload({ label, description, onUploadSuccess, onRemove, escolaId, candidaturaId, initialPath }: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [currentPath, setCurrentPath] = useState<string | null>(initialPath ?? null);
  const [fileUrl, setFileUrl] = useState<string | null>(initialPath ? `EXISTS` : null);
  const [error, setError] = useState<string | null>(null);
  const [retryFile, setRetryFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (initialPath) {
      setFileUrl("EXISTS");
      setCurrentPath(initialPath);
      fetch("/api/public/admissoes/documentos/signed-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escolaId, candidaturaId, path: initialPath }),
      })
        .then((res) => res.json())
        .then((json: { ok?: boolean; signedUrl?: string }) => {
          if (!cancelled && json.ok && json.signedUrl) setFileUrl(json.signedUrl);
        })
        .catch(() => {
          if (!cancelled) setFileUrl("EXISTS");
        });
    } else {
      setFileUrl(null);
      setCurrentPath(null);
    }
    return () => {
      cancelled = true;
    };
  }, [candidaturaId, escolaId, initialPath]);

  const uploadFile = async (file: File) => {
    if (!file) return;

    // Validações básicas
    const MAX_SIZE_MB = 2;
    const isImage = file.type.startsWith('image/');
    
    // Se não for imagem, barreira dura de 2MB
    if (!isImage && file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`O ficheiro é muito pesado. O limite é ${MAX_SIZE_MB}MB.`);
      setRetryFile(file);
      return;
    }

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError("Formato não suportado. Use PDF, JPG ou PNG.");
      setRetryFile(file);
      return;
    }

    setUploading(true);
    setError(null);

    try {
      let fileToUpload: File | Blob = file;

      // Se for imagem, aplicamos compressão mágica no navegador
      if (isImage) {
        const options: Parameters<typeof imageCompression>[1] = {
          maxSizeMB: 0.5, // Alvo de 500KB para imagens
          maxWidthOrHeight: 1920,
          useWebWorker: true,
          fileType: 'image/webp' // Convertemos para WebP para máxima eficiência
        };
        
        try {
          fileToUpload = await imageCompression(file, options);
          console.log(`[Compression]: Original ${file.size / 1024}KB -> Compressed ${fileToUpload.size / 1024}KB`);
        } catch (compErr) {
          console.error("Compression failed, using original:", compErr);
          // Se falhar a compressão, ainda checamos o limite de 2MB
          if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            throw new Error(`Imagem muito grande e falhou ao comprimir. Limite: ${MAX_SIZE_MB}MB`);
          }
        }
      }

      const form = new FormData();
      form.set("escolaId", escolaId);
      form.set("candidaturaId", candidaturaId);
      form.set("label", label);
      form.set("file", fileToUpload, isImage ? "documento.webp" : file.name);

      const res = await fetch("/api/public/admissoes/documentos/upload", {
        method: "POST",
        body: form,
      });
      const json = await res.json().catch(() => null) as { ok?: boolean; path?: string; signedUrl?: string; error?: string } | null;
      if (!res.ok || !json?.ok || !json.path) {
        throw new Error(json?.error || "Erro ao enviar arquivo.");
      }

      setFileUrl(json.signedUrl ?? "EXISTS");
      setCurrentPath(json.path);
      setRetryFile(null);
      onUploadSuccess(json.path);
    } catch (err: unknown) {
      console.error("Upload error:", err);
      setError(err instanceof Error ? err.message : "Erro ao enviar arquivo. Tente novamente.");
      setRetryFile(file);
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
  };

  const handleRemove = async () => {
    if (!currentPath) {
      setFileUrl(null);
      return;
    }

    setRemoving(true);
    setError(null);
    try {
      await onRemove?.(currentPath);
      setCurrentPath(null);
      setFileUrl(null);
      setRetryFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: unknown) {
      console.error("Remove error:", err);
      setError(err instanceof Error ? err.message : "Erro ao remover arquivo. Tente novamente.");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="group rounded-[1.1rem] border border-emerald-950/10 bg-white p-3.5 shadow-[0_10px_28px_rgba(45,34,12,0.06)] transition-colors hover:border-emerald-900/20 sm:rounded-[1.35rem] sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 sm:rounded-2xl ${fileUrl ? 'bg-emerald-50 text-emerald-700' : 'bg-[#fff8ec] text-amber-700'}`}>
            {fileUrl ? <CheckCircle2 size={24} /> : <FileText size={24} />}
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-black text-slate-950">{label}</h4>
            <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">{description}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fileUrl ? void handleRemove() : fileInputRef.current?.click()}
          disabled={uploading || removing}
          className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${fileUrl ? 'bg-slate-100 text-slate-400 hover:text-red-500' : 'bg-slate-950 text-white hover:bg-slate-800'}`}
        >
          {uploading || removing ? <Loader2 size={18} className="animate-spin" /> : (fileUrl ? <X size={18} /> : <Upload size={18} />)}
        </button>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        onChange={handleUpload}
      />

      {error && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold text-red-600 uppercase">
          <span className="flex items-center gap-2"><AlertCircle size={12} />{error}</span>
          {retryFile && <button type="button" onClick={() => void uploadFile(retryFile)} disabled={uploading} className="rounded-lg bg-red-50 px-2 py-1 text-[10px] font-black text-red-700 normal-case hover:bg-red-100 disabled:opacity-60">Tentar novamente</button>}
        </div>
      )}

      {fileUrl && (
        <div className="mt-3 flex items-center gap-2 text-[10px] font-black uppercase text-emerald-700">
          <CheckCircle2 size={12} />
          Arquivo enviado com sucesso
        </div>
      )}
    </div>
  );
}

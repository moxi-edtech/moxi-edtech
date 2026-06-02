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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validações básicas
    const MAX_SIZE_MB = 2;
    const isImage = file.type.startsWith('image/');
    
    // Se não for imagem, barreira dura de 2MB
    if (!isImage && file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`O ficheiro é muito pesado. O limite é ${MAX_SIZE_MB}MB.`);
      return;
    }

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError("Formato não suportado. Use PDF, JPG ou PNG.");
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
      onUploadSuccess(json.path);
    } catch (err: unknown) {
      console.error("Upload error:", err);
      setError(err instanceof Error ? err.message : "Erro ao enviar arquivo. Tente novamente.");
    } finally {
      setUploading(false);
    }
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
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: unknown) {
      console.error("Remove error:", err);
      setError(err instanceof Error ? err.message : "Erro ao remover arquivo. Tente novamente.");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-900 transition-colors group">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${fileUrl ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-400'}`}>
            {fileUrl ? <CheckCircle2 size={24} /> : <FileText size={24} />}
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-900">{label}</h4>
            <p className="text-xs text-slate-500">{description}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fileUrl ? void handleRemove() : fileInputRef.current?.click()}
          disabled={uploading || removing}
          className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${fileUrl ? 'bg-slate-100 text-slate-400 hover:text-red-500' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
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
        <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-red-600 uppercase">
          <AlertCircle size={12} />
          {error}
        </div>
      )}

      {fileUrl && (
        <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-green-600 uppercase">
          <CheckCircle2 size={12} />
          Arquivo enviado com sucesso
        </div>
      )}
    </div>
  );
}

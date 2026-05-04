"use client";

import { useState, useRef } from "react";
import { Upload, X, FileText, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface DocumentUploadProps {
  label: string;
  description: string;
  onUploadSuccess: (url: string) => void;
  escolaId: string;
  candidaturaId: string;
}

export function DocumentUpload({ label, description, onUploadSuccess, escolaId, candidaturaId }: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validações básicas
    if (file.size > 5 * 1024 * 1024) {
      setError("Arquivo muito grande. Limite: 5MB");
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
      const fileExt = file.name.split('.').pop();
      const fileName = `${label.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.${fileExt}`;
      const filePath = `${escolaId}/${candidaturaId}/${fileName}`;

      const { data, error: uploadError } = await supabase.storage
        .from('candidaturas')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('candidaturas')
        .getPublicUrl(filePath);

      setFileUrl(publicUrl);
      onUploadSuccess(filePath); // Retornamos o path para salvar no banco
    } catch (err: any) {
      console.error("Upload error:", err);
      setError("Erro ao enviar arquivo. Tente novamente.");
    } finally {
      setUploading(false);
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
          onClick={() => fileUrl ? setFileUrl(null) : fileInputRef.current?.click()}
          disabled={uploading}
          className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${fileUrl ? 'bg-slate-100 text-slate-400 hover:text-red-500' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
        >
          {uploading ? <Loader2 size={18} className="animate-spin" /> : (fileUrl ? <X size={18} /> : <Upload size={18} />)}
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

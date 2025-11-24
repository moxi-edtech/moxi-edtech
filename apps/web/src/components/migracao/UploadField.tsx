"use client";

import { useRef, useState } from "react";

import Button from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";

interface UploadFieldProps {
  onFileSelected: (file: File) => void;
  maxSizeMb?: number;
}

export function UploadField({ onFileSelected, maxSizeMb = 12 }: UploadFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");

  const handleFile = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const limit = maxSizeMb * 1024 * 1024;
    if (file.size > limit) {
      setError(`Arquivo maior que ${maxSizeMb}MB`);
      return;
    }
    setError(null);
    setFileName(file.name);
    onFileSelected(file);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          type="file"
          accept=".csv, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => handleFile(event.target.files)}
          className="max-w-xs"
        />
        <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
          Selecionar arquivo
        </Button>
      </div>
      {fileName && <p className="text-sm text-muted-foreground">Selecionado: {fileName}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">Limite: até {maxSizeMb}MB</p>
    </div>
  );
}

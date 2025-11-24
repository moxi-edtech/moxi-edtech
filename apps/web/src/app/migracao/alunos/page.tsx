"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";

import Button from "~/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { ColumnMapper } from "~/components/migracao/ColumnMapper";
import { ErrorList } from "~/components/migracao/ErrorList";
import { PreviewTable } from "~/components/migracao/PreviewTable";
import { ProgressInfo } from "~/components/migracao/ProgressInfo";
import { UploadField } from "~/components/migracao/UploadField";
import type { AlunoStagingRecord, MappedColumns } from "~types/migracao";

export default function AlunoMigrationWizard() {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<MappedColumns>({});
  const [preview, setPreview] = useState<AlunoStagingRecord[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [apiErrors, setApiErrors] = useState<string[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [importId, setImportId] = useState<string | null>(null);

  const totalSteps = 4;
  const supabase = useMemo(() => createClient(), []);

  const userIdReal = session?.user?.id;
  const escolaIdReal = (session?.user?.app_metadata as { escola_id?: string } | undefined)?.escola_id;

  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session ?? null);
      })
      .catch(() => setSession(null));
    return () => {
      active = false;
    };
  }, [supabase]);

  const extractHeaders = async () => {
    if (!file) return;
    const text = await file.text();
    const [firstLine] = text.split(/\r?\n/);
    const delimiter = firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";
    setHeaders(firstLine.split(delimiter).map((h) => h.trim()));
  };

  const handleValidateLocal = async () => {
    setErrors([]);
    setApiErrors([]);
    if (!importId || !escolaIdReal) {
      setApiErrors(["Importação ainda não iniciada. Faça o upload primeiro."]);
      return;
    }
    const response = await fetch("/api/migracao/alunos/validar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        importId,
        escolaId: escolaIdReal,
        columnMap: mapping,
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      setApiErrors([payload.error]);
      return;
    }

    setPreview(payload.preview);
    setStep(3);
  };

  const handleUpload = async () => {
    setApiErrors([]);
    if (!file) {
      setApiErrors(["Selecione um arquivo para subir"]);
      return;
    }
    if (!userIdReal || !escolaIdReal) {
      setApiErrors(["Usuário sem contexto de escola. Faça login novamente."]);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("escolaId", escolaIdReal);
    formData.append("userId", userIdReal);

    const response = await fetch("/api/migracao/upload", { method: "POST", body: formData });
    const payload = await response.json();

    if (!response.ok) {
      setApiErrors([payload.error || "Erro ao enviar arquivo"]);
      return;
    }

    setImportId(payload.importId);
    setStep(2);
    await extractHeaders();
  };

  const handleImport = async () => {
    setApiErrors([]);
    if (!importId || !escolaIdReal) {
      setApiErrors(["Importação inválida. Realize o upload novamente."]);
      return;
    }
    const response = await fetch("/api/migracao/alunos/importar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        importId,
        escolaId: escolaIdReal,
      }),
    });
    if (!response.ok) {
      const payload = await response.json();
      setApiErrors([payload.error || "Falha ao importar"]);
      return;
    }
    setStep(4);
  };

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Migração de Alunos</h1>
          <p className="text-sm text-muted-foreground">Wizard passo a passo para upload, validação e importação.</p>
        </div>
        <ProgressInfo step={step} total={totalSteps} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>1) Upload</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <UploadField onFileSelected={setFile} />
            <Button onClick={handleUpload} disabled={!file}>
              Enviar arquivo
            </Button>
            {errors.map((err) => (
              <p key={err} className="text-sm text-destructive">{err}</p>
            ))}
            {apiErrors.map((err) => (
              <p key={err} className="text-sm text-destructive">{err}</p>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2) Mapeamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ColumnMapper headers={headers} mapping={mapping} onChange={setMapping} />
            <Button variant="secondary" onClick={handleValidateLocal} disabled={!file}>
              Pré-visualizar
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>3) Pré-visualização</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PreviewTable records={preview} />
          <Button variant="secondary" onClick={handleImport} disabled={!preview.length}>
            Importar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4) Finalização</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Acompanhe o status da importação. Erros aparecerão abaixo e podem ser baixados pelo time técnico.
          </p>
          <ErrorList
            errors={apiErrors.map((message, idx) => ({ message, row_number: idx + 1, column_name: "api" }))}
          />
        </CardContent>
      </Card>
    </main>
  );
}

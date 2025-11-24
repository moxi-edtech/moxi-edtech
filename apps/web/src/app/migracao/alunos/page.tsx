"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

import Button from "~/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { ColumnMapper } from "~/components/migracao/ColumnMapper";
import { ErrorList } from "~/components/migracao/ErrorList";
import { PreviewTable } from "~/components/migracao/PreviewTable";
import { ProgressInfo } from "~/components/migracao/ProgressInfo";
import { UploadField } from "~/components/migracao/UploadField";
import type { AlunoStagingRecord, ErroImportacao, ImportResult, MappedColumns } from "~types/migracao";

export default function AlunoMigrationWizard() {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<MappedColumns>({});
  const [preview, setPreview] = useState<AlunoStagingRecord[]>([]);
  const [apiErrors, setApiErrors] = useState<string[]>([]);
  const [importId, setImportId] = useState<string | null>(null);
  const [escolaId, setEscolaId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<ErroImportacao[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const totalSteps = 4;
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        const session = data.session ?? null;
        setUserId(session?.user?.id ?? null);
        const escola = (session?.user?.app_metadata as { escola_id?: string } | undefined)?.escola_id ?? null;
        setEscolaId(escola ?? null);
      })
      .catch(() => {
        if (!active) return;
        setUserId(null);
        setEscolaId(null);
      });

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

  const handleValidate = async () => {
    setApiErrors([]);
    if (!importId || !escolaId) {
      setApiErrors(["Importação ainda não iniciada. Faça o upload primeiro."]);
      return;
    }
    const response = await fetch("/api/migracao/alunos/validar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        importId,
        escolaId,
        columnMap: mapping,
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      setApiErrors([payload.error || "Erro ao validar dados"]);
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
    if (!escolaId) {
      setApiErrors(["Não foi possível identificar a escola. Faça login novamente."]);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("escolaId", escolaId);
    if (userId) formData.append("userId", userId);

    const response = await fetch("/api/migracao/upload", { method: "POST", body: formData });
    const payload = await response.json();

    if (!response.ok) {
      setApiErrors([payload.error || "Erro ao enviar arquivo"]);
      return;
    }

    setImportId(payload.importId);
    setImportErrors([]);
    setImportResult(null);
    setStep(2);
    await extractHeaders();
  };

  const handleImport = async () => {
    setApiErrors([]);
    if (!importId || !escolaId) {
      setApiErrors(["Importação inválida. Realize o upload novamente."]);
      return;
    }
    const response = await fetch("/api/migracao/alunos/importar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        importId,
        escolaId,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setApiErrors([payload.error || "Falha ao importar"]);
      return;
    }
    setImportResult(payload.result ?? null);
    setStep(4);

    const errorsResponse = await fetch(`/api/migracao/${importId}/erros`);
    const errorsPayload = await errorsResponse.json();
    if (errorsResponse.ok) {
      setImportErrors(errorsPayload.errors ?? []);
    }
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
            <Button variant="secondary" onClick={handleValidate} disabled={!file}>
              Validar e pré-visualizar
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
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>Acompanhe o status da importação. Erros aparecerão abaixo e podem ser baixados pelo time técnico.</p>
            {importResult && (
              <p className="text-foreground">
                Resumo: {importResult.imported} importados, {importResult.skipped} ignorados, {importResult.errors} erros.
              </p>
            )}
          </div>
          <ErrorList errors={[...importErrors, ...apiErrors.map((message) => ({ message }))]} />
        </CardContent>
      </Card>
    </main>
  );
}

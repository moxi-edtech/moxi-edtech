"use client";

import { useRef, useState } from "react";
import { Archive, FileSpreadsheet, Loader2, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { normaliseNotaSpreadsheetRow } from "@/lib/virada/notas-import";

type Row = Record<string, unknown>;

type PreviewResponse = {
  ok?: boolean;
  error?: string;
  can_import?: boolean;
  summary?: {
    total: number;
    validas: number;
    rejeitadas: number;
    duplicadas: number;
    sem_correspondencia: number;
  };
};

const emptyManual = {
  numero_processo: "",
  avaliacao_id: "",
  nota: "",
  resultado_final: "",
};

export function PreparationInputs({ anoLetivo = 2025 }: { anoLetivo?: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [manual, setManual] = useState(emptyManual);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [staging, setStaging] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [stagedId, setStagedId] = useState<string | null>(null);
  const [origem, setOrigem] = useState<"PLANILHA" | "MANUAL">("MANUAL");
  const idempotencyKey = useRef(crypto.randomUUID());

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0] || ""];
    if (!firstSheet) return;
    const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });
    setRows(parsed.map(normaliseNotaSpreadsheetRow));
    setOrigem("PLANILHA");
    setPreview(null);
    setStagedId(null);
    idempotencyKey.current = crypto.randomUUID();
  };

  const addManual = () => {
    setRows((current) => [...current, { ...manual }]);
    setOrigem("MANUAL");
    setManual(emptyManual);
    setPreview(null);
    setStagedId(null);
    idempotencyKey.current = crypto.randomUUID();
  };

  const stageRows = async () => {
    if (!preview?.can_import || rows.length === 0) return;
    setStaging(true);
    try {
      const response = await fetch("/api/secretaria/operacoes-academicas/virada/notas/stage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey.current,
        },
        body: JSON.stringify({ ano_letivo: anoLetivo, origem, rows }),
      });
      const json = await response.json();
      if (json.ok) setStagedId(json.importacao?.id ?? null);
      else setPreview((current) => ({ ...current, error: json.error || "Falha ao guardar lote." }));
    } finally {
      setStaging(false);
    }
  };

  const runPreview = async () => {
    if (rows.length === 0) return;
    setLoading(true);
    try {
      const response = await fetch("/api/secretaria/operacoes-academicas/virada/notas/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ano_letivo: anoLetivo, rows }),
      });
      setPreview(await response.json());
    } finally {
      setLoading(false);
    }
  };

  const approveAndApply = async () => {
    if (!stagedId) return;
    setApplying(true);
    setPreview((current) => current ? { ...current, error: undefined } : current);
    try {
      const approveResponse = await fetch(
        `/api/secretaria/operacoes-academicas/virada/notas/${stagedId}/approve`,
        { method: "POST" },
      );
      const approved = await approveResponse.json();
      if (!approved.ok) throw new Error(approved.error || "Falha ao aprovar o lote.");

      const applyResponse = await fetch(
        `/api/secretaria/operacoes-academicas/virada/notas/${stagedId}/apply`,
        { method: "POST" },
      );
      const appliedResult = await applyResponse.json();
      if (!appliedResult.ok) throw new Error(appliedResult.error || "Falha ao aplicar o lote.");
      setApplied(true);
    } catch (error) {
      setPreview((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "Falha ao aplicar o lote.",
      }));
    } finally {
      setApplying(false);
    }
  };

  return (
    <section className="w-full space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Resultados 2025/2026
          </h3>
          <p className="mt-1 text-xs text-slate-500">Carregue Excel/CSV ou adicione linhas manualmente. Esta etapa apenas valida.</p>
        </div>
        <label className="cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100">
          Carregar planilha
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
        </label>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        {(["numero_processo", "avaliacao_id", "nota"] as const).map((field) => (
          <input
            key={field}
            value={manual[field]}
            onChange={(event) => setManual((current) => ({ ...current, [field]: event.target.value }))}
            placeholder={field.replace(/_/g, " ")}
            className="h-10 rounded-lg border border-slate-200 px-3 text-xs outline-none focus:ring-2 focus:ring-klasse-gold/20"
          />
        ))}
        <select
          value={manual.resultado_final}
          onChange={(event) => setManual((current) => ({ ...current, resultado_final: event.target.value }))}
          className="h-10 rounded-lg border border-slate-200 px-3 text-xs outline-none"
        >
          <option value="">Resultado final</option>
          <option value="TRANSITADO">Transitado</option>
          <option value="RETIDO">Retido</option>
          <option value="CONCLUIDO">Concluído</option>
          <option value="PENDENTE">Pendente</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button tone="gray" size="sm" onClick={addManual} disabled={!manual.numero_processo}>
          <Plus className="h-4 w-4" /> Adicionar linha
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-500">{rows.length} linhas carregadas</span>
          <Button tone="gold" size="sm" onClick={runPreview} disabled={rows.length === 0 || loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Validar sem importar
          </Button>
        </div>
      </div>

      {preview?.summary && (
        <div className={`grid gap-2 rounded-xl border p-3 text-xs sm:grid-cols-5 ${preview.can_import ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
          <span>Total: <strong>{preview.summary.total}</strong></span>
          <span>Válidas: <strong>{preview.summary.validas}</strong></span>
          <span>Rejeitadas: <strong>{preview.summary.rejeitadas}</strong></span>
          <span>Duplicadas: <strong>{preview.summary.duplicadas}</strong></span>
          <span>Sem aluno: <strong>{preview.summary.sem_correspondencia}</strong></span>
        </div>
      )}
      {preview?.can_import && !stagedId && (
        <div className="flex justify-end">
          <Button tone="gold" size="sm" onClick={stageRows} disabled={staging}>
            {staging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
            Guardar lote validado
          </Button>
        </div>
      )}
      {stagedId && !applied && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs font-semibold text-emerald-700">Lote validado: {stagedId}</p>
          <Button tone="gold" size="sm" onClick={approveAndApply} disabled={applying}>
            {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Aprovar e aplicar
          </Button>
        </div>
      )}
      {applied && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
          Resultados aplicados com sucesso.
        </p>
      )}
      {preview?.error && <p className="text-xs font-semibold text-rose-600">{preview.error}</p>}
    </section>
  );
}

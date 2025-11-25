"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import {
  Loader2,
  Upload,
  Map,
  Eye,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Users,
  Download,
  RefreshCw,
  Info,
} from "lucide-react";

import { ColumnMapper } from "~/components/migracao/ColumnMapper";
import { ErrorList } from "~/components/migracao/ErrorList";
import { PreviewTable } from "~/components/migracao/PreviewTable";
import { UploadField } from "~/components/migracao/UploadField";
import type { AlunoStagingRecord, ErroImportacao, ImportResult, MappedColumns } from "~types/migracao";

const STEPS = [
  { id: 1, title: "Upload", icon: Upload, description: "Faça upload do arquivo CSV" },
  { id: 2, title: "Mapeamento", icon: Map, description: "Mapeie as colunas do arquivo" },
  { id: 3, title: "Pré-visualização", icon: Eye, description: "Revise os dados antes de importar" },
  { id: 4, title: "Finalização", icon: CheckCircle, description: "Resumo da importação" },
];

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
  const [loading, setLoading] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  // Carrega sessão e contexto de escola
  useEffect(() => {
    const loadSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setUserId(session?.user?.id ?? null);
        const appMeta = session?.user?.app_metadata as { escola_id?: string } | undefined;
        const escola = appMeta?.escola_id ?? null;
        setEscolaId(escola);
      } catch {
        setUserId(null);
        setEscolaId(null);
      }
    };

    loadSession();
  }, [supabase]);

  const extractHeaders = async () => {
    if (!file) return;

    try {
      const text = await file.text();
      const [firstLine] = text.split(/\r?\n/);
      if (!firstLine) return;
      const delimiter = firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";
      setHeaders(firstLine.split(delimiter).map((h) => h.trim()));
    } catch (error) {
      console.error("Erro ao extrair headers:", error);
      setApiErrors((prev) => [...prev, "Não foi possível ler o cabeçalho do arquivo."]);
    }
  };

  // Regras de mapeamento mínimo para importar alunos com segurança
  const mappingStatus = useMemo(() => {
    const missing: string[] = [];

    if (!mapping.nome) {
      missing.push("Nome");
    }
    if (!mapping.data_nascimento) {
      missing.push("Data de nascimento");
    }

    const hasAlgumIdentificador =
      Boolean(mapping.bi) || Boolean(mapping.email) || Boolean(mapping.telefone);

    if (!hasAlgumIdentificador) {
      missing.push("Pelo menos um de: BI, Email ou Telefone");
    }

    return {
      ok: missing.length === 0,
      missing,
      hasIdentificador: hasAlgumIdentificador,
    };
  }, [mapping]);

  const handleUpload = async () => {
    if (!file || !escolaId) {
      setApiErrors([
        !file ? "Selecione um arquivo" : "Escola não identificada. Faça login novamente ou contacte o administrador.",
      ]);
      return;
    }

    setLoading(true);
    setApiErrors([]);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("escolaId", escolaId);
      if (userId) formData.append("userId", userId);

      const response = await fetch("/api/migracao/upload", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Erro no upload");
      }

      setImportId(payload.importId);
      setImportErrors([]);
      setImportResult(null);
      setStep(2);
      await extractHeaders();
    } catch (error) {
      setApiErrors([error instanceof Error ? error.message : "Erro de conexão no upload"]);
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    if (!importId || !escolaId) {
      setApiErrors(["Complete o upload primeiro."]);
      return;
    }

    // 💡 regra de negócio nova: Nome + BI obrigatórios
    const missing: string[] = [];
    if (!mapping.nome) missing.push("Nome");
    if (!mapping.bi) missing.push("BI");

    if (missing.length) {
      setApiErrors([
        `Mapeie os campos obrigatórios antes de continuar: ${missing.join(", ")}.`
      ]);
      return;
    }

    setLoading(true);
    setApiErrors([]);

    try {
      const response = await fetch("/api/migracao/alunos/validar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importId, escolaId, columnMap: mapping }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Erro na validação");
      }

      setPreview(payload.preview);
      setStep(3);
    } catch (error) {
      setApiErrors([error instanceof Error ? error.message : "Erro de validação"]);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importId || !escolaId) {
      setApiErrors(["Importação inválida. Tente reiniciar o processo."]);
      return;
    }

    setLoading(true);
    setApiErrors([]);

    try {
      const response = await fetch("/api/migracao/alunos/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importId, escolaId }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Erro na importação");
      }

      setImportResult(payload.result ?? null);
      setStep(4);

      const errorsResponse = await fetch(`/api/migracao/${importId}/erros`);
      if (errorsResponse.ok) {
        const errorsPayload = await errorsResponse.json();
        setImportErrors(errorsPayload.errors ?? []);
      }
    } catch (error) {
      setApiErrors([error instanceof Error ? error.message : "Erro de conexão na importação"]);
    } finally {
      setLoading(false);
    }
  };

  const resetWizard = () => {
    setStep(1);
    setFile(null);
    setPreview([]);
    setImportResult(null);
    setImportErrors([]);
    setApiErrors([]);
    setMapping({});
    setHeaders([]);
    setImportId(null);
  };

  const StepProgress = () => (
    <div className="bg-white/80 backdrop-blur rounded-2xl border border-slate-200 mb-6 px-5 py-4 shadow-sm">
      <div className="flex items-center justify-between mb-4 gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Progresso da importação</h2>
          <p className="text-xs text-slate-500">
            Siga os passos na ordem para evitar erros nos dados dos alunos.
          </p>
        </div>
        <div className="text-right">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
            <span className="text-xs font-medium text-slate-500">Passo atual</span>
            <span className="text-sm font-semibold text-blue-600">
              {step}/{STEPS.length}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between relative">
        <div className="absolute left-4 right-4 top-1/2 h-px bg-slate-200 -z-10" />
        {STEPS.map(({ id, title, icon: Icon }) => {
          const isCompleted = id < step;
          const isActive = id === step;

          return (
            <div key={id} className="flex flex-col items-center flex-1">
              <div
                className={`
                  flex items-center justify-center rounded-full w-9 h-9 mb-1
                  border text-xs
                  ${
                    isCompleted
                      ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                      : isActive
                      ? "bg-blue-50 border-blue-200 text-blue-600"
                      : "bg-slate-50 border-slate-200 text-slate-400"
                  }
                `}
              >
                {isCompleted ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <span
                className={`
                  text-[11px] font-medium text-center leading-tight
                  ${
                    isActive
                      ? "text-blue-700"
                      : isCompleted
                      ? "text-emerald-700"
                      : "text-slate-400"
                  }
                `}
              >
                {title}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <div
          className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
        />
      </div>
    </div>
  );

  const StepCard = ({
    stepNumber,
    title,
    description,
    children,
  }: {
    stepNumber: number;
    title: string;
    description: string;
    children: React.ReactNode;
  }) => {
    const isDisabled = step < stepNumber;
    const isCurrent = step === stepNumber;
    const isDone = step > stepNumber;

    return (
      <section
        className={`
          rounded-2xl border bg-white/90 backdrop-blur shadow-sm mb-4 transition-all
          ${
            isDisabled
              ? "border-slate-100 opacity-40 pointer-events-none"
              : "border-slate-200"
          }
          ${isCurrent ? "ring-1 ring-blue-100" : ""}
        `}
      >
        <header className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div
              className={`
                flex items-center justify-center rounded-full w-7 h-7 text-xs font-semibold
                ${
                  isDone
                    ? "bg-emerald-50 text-emerald-600"
                    : isCurrent
                    ? "bg-blue-600 text-white"
                    : "bg-slate-200 text-slate-600"
                }
              `}
            >
              {isDone ? <CheckCircle className="w-4 h-4" /> : stepNumber}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
              <p className="text-xs text-slate-500">{description}</p>
            </div>
          </div>
          {!isDisabled && (
            <span className="text-[11px] font-medium text-slate-400">
              {isDone ? "Concluído" : isCurrent ? "Em andamento" : "Próximo"}
            </span>
          )}
        </header>

        <div className="px-5 py-4 space-y-4">{children}</div>
      </section>
    );
  };

  const ActionButton = ({
    onClick,
    disabled,
    loading: btnLoading,
    icon: Icon,
    children,
  }: {
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
    icon: React.ComponentType<{ className?: string }>;
    children: string;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled || btnLoading}
      className={`
        inline-flex items-center justify-center gap-2
        rounded-lg px-4 py-2.5 text-sm font-medium
        bg-blue-600 text-white
        hover:bg-blue-700
        disabled:opacity-50 disabled:cursor-not-allowed
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        transition-colors
        w-full sm:w-auto
      `}
    >
      {btnLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Icon className="h-4 w-4" />
      )}
      <span>{btnLoading ? "Processando..." : children}</span>
    </button>
  );

  const ErrorAlert = () =>
    apiErrors.length > 0 && (
      <div className="bg-red-50/80 border border-red-200 rounded-lg px-3 py-2.5 space-y-1">
        <div className="flex items-center gap-2 text-xs font-semibold text-red-800">
          <AlertTriangle className="h-4 w-4" />
          <span>Foram encontrados problemas nesta etapa:</span>
        </div>
        {apiErrors.map((error, index) => (
          <div key={index} className="flex items-start gap-2 text-xs text-red-700 pl-6">
            <span>• {error}</span>
          </div>
        ))}
      </div>
    );

  const ResultsSummary = () =>
    importResult && (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-3 text-center">
          <div className="text-lg font-semibold text-emerald-700">
            {importResult.imported}
          </div>
          <div className="text-xs text-emerald-800">Importados</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-3 text-center">
          <div className="text-lg font-semibold text-amber-700">
            {importResult.skipped}
          </div>
          <div className="text-xs text-amber-800">Ignorados</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-3 text-center">
          <div className="text-lg font-semibold text-red-700">
            {importResult.errors}
          </div>
          <div className="text-xs text-red-800">Erros</div>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50/80 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 text-xs sm:text-sm text-slate-500 hover:text-slate-800 mb-3 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>

          <div className="bg-white/90 backdrop-blur border border-slate-200 rounded-2xl px-5 py-4 shadow-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-full bg-blue-50 text-blue-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-semibold text-slate-900">
                  Migração de Alunos
                </h1>
                <p className="text-xs sm:text-sm text-slate-500">
                  Importe alunos em lote através de um arquivo CSV estruturado.
                </p>
              </div>
            </div>
            <div className="hidden sm:flex flex-col items-end gap-1">
              <span className="text-[11px] uppercase tracking-wide text-slate-400 font-medium">
                Escola atual
              </span>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                {escolaId ? escolaId : "Não identificada"}
              </span>
            </div>
          </div>

          {!escolaId && (
            <div className="mt-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-3 py-2 flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>
                Não foi possível identificar a escola do usuário. A importação precisa de um{" "}
                <span className="font-semibold">escola_id</span> válido para ser concluída. Verifique o login
                ou contacte o administrador.
              </p>
            </div>
          )}
        </div>

        <StepProgress />

        {/* ALERTA GLOBAL DE ERROS */}
        {apiErrors.length > 0 && (
          <div className="mb-4">
            <ErrorAlert />
          </div>
        )}

        {/* Passo 1: Upload */}
        <StepCard
          stepNumber={1}
          title="Upload do arquivo"
          description="Selecione o arquivo CSV com os dados dos alunos."
        >
          <div className="space-y-4">
            <UploadField onFileSelected={setFile} />
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <p className="text-[11px] text-slate-500">
                Formato recomendado: CSV separado por ponto e vírgula (;), com cabeçalho na primeira linha.
              </p>
              <ActionButton
                onClick={handleUpload}
                disabled={!file || !escolaId}
                loading={loading && step === 1}
                icon={Upload}
              >
                Enviar arquivo
              </ActionButton>
            </div>
          </div>
        </StepCard>

        {/* Passo 2: Mapeamento */}
        {step >= 2 && (
          <StepCard
            stepNumber={2}
            title="Mapeamento de colunas"
            description="Relacione as colunas do arquivo com os campos do sistema."
          >
            <div className="space-y-4">
              {/* Checklist de campos obrigatórios */}
              <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5 text-[11px] space-y-1.5">
                <div className="flex items-center gap-2 font-medium text-slate-700">
                  <Info className="h-3.5 w-3.5" />
                  <span>Campos mínimos para uma importação segura:</span>
                </div>
                <ul className="pl-5 space-y-0.5 text-slate-600 list-disc">
                  <li>Nome</li>
                  <li>Data de nascimento</li>
                  <li>Pelo menos um identificador: BI, Email ou Telefone</li>
                </ul>
                {!mappingStatus.ok && (
                  <p className="mt-1 text-[11px] text-red-600">
                    Falta mapear: {mappingStatus.missing.join(" · ")}
                  </p>
                )}
                {mappingStatus.ok && (
                  <p className="mt-1 text-[11px] text-emerald-700">
                    ✅ Mapeamento mínimo completo. Pode prosseguir para validação.
                  </p>
                )}
              </div>

              <ColumnMapper headers={headers} mapping={mapping} onChange={setMapping} />

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <p className="text-[11px] text-slate-500">
                  Campos obrigatórios devem estar mapeados corretamente antes de continuar.
                </p>
                <ActionButton
                  onClick={handleValidate}
                  loading={loading && step === 2}
                  disabled={!mappingStatus.ok}
                  icon={Eye}
                >
                  Validar dados
                </ActionButton>
              </div>
            </div>
          </StepCard>
        )}

        {/* Passo 3: Pré-visualização */}
        {step >= 3 && (
          <StepCard
            stepNumber={3}
            title="Pré-visualização"
            description="Revise uma amostra dos dados que serão importados."
          >
            <div className="space-y-4">
              <PreviewTable records={preview} />
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <p className="text-[11px] text-slate-500">
                  Confirme se os dados estão consistentes. A partir deste ponto, a importação criará/atualizará alunos reais.
                </p>
                <ActionButton
                  onClick={handleImport}
                  disabled={preview.length === 0}
                  loading={loading && step === 3}
                  icon={CheckCircle}
                >
                  Confirmar importação
                </ActionButton>
              </div>
            </div>
          </StepCard>
        )}

        {/* Passo 4: Finalização */}
        {step >= 4 && (
          <StepCard
            stepNumber={4}
            title="Importação concluída"
            description="Veja o resumo da importação e trate eventuais erros."
          >
            <div className="space-y-5">
              <ResultsSummary />

              {importErrors.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-900">
                      Registos com erro
                    </span>
                    <button
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                    >
                      <Download className="h-4 w-4" />
                      Baixar relatório
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Corrija estes registos no ficheiro de origem e faça uma nova importação apenas dos casos em erro,
                    se necessário.
                  </p>
                  <ErrorList errors={importErrors} />
                </div>
              )}

              <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5 text-[11px] text-slate-600 space-y-1.5">
                <div className="flex items-center gap-2 font-medium text-slate-700">
                  <Info className="h-3.5 w-3.5" />
                  <span>Próximos passos sugeridos</span>
                </div>
                <ul className="pl-5 list-disc space-y-0.5">
                  <li>Conferir os alunos importados em <strong>/secretaria/alunos</strong>.</li>
                  <li>Usar a funcionalidade de <strong>Matrículas em Massa</strong> (quando ativada) para colocar os alunos nas turmas.</li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100">
                <ActionButton onClick={resetWizard} icon={RefreshCw}>
                  Nova importação
                </ActionButton>

                <button
                  onClick={() => window.history.back()}
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Voltar ao painel
                </button>
              </div>
            </div>
          </StepCard>
        )}
      </div>
    </div>
  );
}
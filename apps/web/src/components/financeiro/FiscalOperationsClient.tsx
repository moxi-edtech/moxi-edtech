"use client";

import { useMemo, useState } from "react";
import { Loader2, ShieldCheck, Send, FileWarning, FileX2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

import { useToast } from "@/components/feedback/FeedbackSystem";

type ActionKind = "rectificar" | "anular" | "submeter";

type FiscalOperationsClientProps = {
  empresaId: string;
};

type ApiResult = {
  ok?: boolean;
  error?: {
    code?: string;
    message?: string;
  };
};

function toMonthStartDate(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function toMonthEndDate(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);
}

function actionLabel(action: ActionKind) {
  if (action === "rectificar") return "Rectificar";
  if (action === "anular") return "Anular";
  return "Submeter";
}

export function FiscalOperationsClient({ empresaId }: FiscalOperationsClientProps) {
  const { success, error } = useToast();
  const now = useMemo(() => new Date(), []);
  const [periodoInicio, setPeriodoInicio] = useState(toMonthStartDate(now));
  const [periodoFim, setPeriodoFim] = useState(toMonthEndDate(now));
  const [xsdVersion, setXsdVersion] = useState("AO_SAFT_1.01");
  const [docId, setDocId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [action, setAction] = useState<ActionKind>("submeter");
  const [loadingSaft, setLoadingSaft] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [loadingProbe, setLoadingProbe] = useState(false);
  const [probeFeedback, setProbeFeedback] = useState<{
    tone: "ok" | "warn" | "error";
    text: string;
  } | null>(null);

  const runSaftExport = async () => {
    setLoadingSaft(true);
    try {
      const res = await fetch("/api/fiscal/saft/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa_id: empresaId,
          periodo_inicio: periodoInicio,
          periodo_fim: periodoFim,
          xsd_version: xsdVersion,
          metadata: { canal: "painel_fiscal_compliance" },
        }),
      });
      const json = (await res.json().catch(() => ({}))) as ApiResult;
      if (!res.ok || !json.ok) {
        error(
          "Exportação SAF-T falhou",
          `${json.error?.code ?? "FISCAL_SAFT_FAILED"}: ${json.error?.message ?? "Falha ao exportar SAF-T."}`
        );
        return;
      }
      success("Exportação SAF-T iniciada/concluída com sucesso.");
    } catch (err: any) {
      error("Erro na exportação SAF-T", err.message || "Erro inesperado.");
    } finally {
      setLoadingSaft(false);
    }
  };

  const runDocAction = async () => {
    if (!docId.trim()) {
      error("Campo obrigatório", "Informe o ID do documento fiscal.");
      return;
    }
    if (motivo.trim().length < 3) {
      error("Campo obrigatório", "Informe um motivo com pelo menos 3 caracteres.");
      return;
    }

    setLoadingAction(true);
    try {
      const route =
        action === "submeter"
          ? `/api/fiscal/documentos/${docId.trim()}/submeter`
          : `/api/fiscal/documentos/${docId.trim()}/${action}`;

      const res = await fetch(route, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          motivo: motivo.trim(),
          metadata: { origem: "ui_fiscal_compliance" },
        }),
      });
      const json = (await res.json().catch(() => ({}))) as ApiResult;
      if (!res.ok || !json.ok) {
        error(
          `${actionLabel(action)} falhou`,
          `${json.error?.code ?? "FISCAL_ACTION_FAILED"}: ${json.error?.message ?? "Falha na operação fiscal."}`
        );
        return;
      }
      success(`${actionLabel(action)} executado com sucesso.`);
    } catch (err: any) {
      error(`Erro ao ${action}`, err.message || "Erro inesperado.");
    } finally {
      setLoadingAction(false);
    }
  };

  const runKmsProbe = async () => {
    setLoadingProbe(true);
    setProbeFeedback(null);
    try {
      const res = await fetch("/api/fiscal/compliance/status?probe=1", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as
        | {
            ok?: boolean;
            data?: {
              kms?: { probeStatus?: string; probeMessage?: string | null };
            };
            error?: { code?: string; message?: string };
          }
        | null;

      if (!res.ok || !json?.ok) {
        setProbeFeedback({
          tone: "error",
          text: `${json?.error?.code ?? "FISCAL_COMPLIANCE_STATUS_FAILED"}: ${json?.error?.message ?? "Falha ao testar KMS/IAM."}`,
        });
        return;
      }

      const status = json.data?.kms?.probeStatus ?? "error";
      const message = json.data?.kms?.probeMessage ?? "Sem mensagem de retorno do probe KMS.";
      if (status === "ok") {
        setProbeFeedback({ tone: "ok", text: message });
      } else if (status === "denied") {
        setProbeFeedback({ tone: "warn", text: message });
      } else {
        setProbeFeedback({ tone: "error", text: message });
      }
    } finally {
      setLoadingProbe(false);
    }
  };

  return (
    <section className="space-y-4 rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">Operações e Compliance</h2>
        <p className="text-xs text-slate-500">
          Execute exportação SAF-T, ciclo de vida documental e teste de permissão KMS/IAM.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-slate-200 p-4">
          <div className="text-sm font-semibold text-slate-800">Exportar SAF-T(AO)</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              label="Período início"
              type="date"
              value={periodoInicio}
              onChange={(e) => setPeriodoInicio(e.target.value)}
            />
            <Input
              label="Período fim"
              type="date"
              value={periodoFim}
              onChange={(e) => setPeriodoFim(e.target.value)}
            />
          </div>
          <Input
            label="Versão XSD"
            value={xsdVersion}
            onChange={(e) => setXsdVersion(e.target.value)}
            placeholder="AO_SAFT_1.01"
          />
          <Button onClick={runSaftExport} disabled={loadingSaft} tone="green" className="w-full">
            {loadingSaft ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Exportar SAF-T
          </Button>
        </div>

        <div className="space-y-3 rounded-lg border border-slate-200 p-4">
          <div className="text-sm font-semibold text-slate-800">Fluxo de documento</div>
          <Input
            label="Documento ID"
            value={docId}
            onChange={(e) => setDocId(e.target.value)}
            placeholder="UUID do documento fiscal"
          />
          <Input
            label="Motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo da operação"
          />
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant={action === "submeter" ? "default" : "outline"}
              tone={action === "submeter" ? "slate" : "gray"}
              onClick={() => setAction("submeter")}
              size="sm"
            >
              <Send className="h-3.5 w-3.5" /> Submeter
            </Button>
            <Button
              type="button"
              variant={action === "rectificar" ? "default" : "outline"}
              tone={action === "rectificar" ? "warn" : "gray"}
              onClick={() => setAction("rectificar")}
              size="sm"
            >
              <FileWarning className="h-3.5 w-3.5" /> Rectificar
            </Button>
            <Button
              type="button"
              variant={action === "anular" ? "default" : "outline"}
              tone={action === "anular" ? "red" : "gray"}
              onClick={() => setAction("anular")}
              size="sm"
            >
              <FileX2 className="h-3.5 w-3.5" /> Anular
            </Button>
          </div>
          <Button onClick={runDocAction} disabled={loadingAction} tone="slate" className="w-full">
            {loadingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Executar {actionLabel(action)}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-3">
        <Button onClick={runKmsProbe} disabled={loadingProbe} variant="outline" tone="blue" size="sm">
          {loadingProbe ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Testar IAM `kms:Sign`
        </Button>
        {probeFeedback ? (
          <span
            className={`text-xs ${
              probeFeedback.tone === "ok"
                ? "text-green-700"
                : probeFeedback.tone === "warn"
                  ? "text-amber-700"
                  : "text-red-700"
            }`}
          >
            {probeFeedback.text}
          </span>
        ) : (
          <span className="text-xs text-slate-500">
            Executa um probe real de assinatura no KMS para validar IAM.
          </span>
        )}
      </div>
    </section>
  );
}

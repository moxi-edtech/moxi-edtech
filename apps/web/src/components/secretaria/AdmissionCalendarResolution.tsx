"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarCheck2, Check, RefreshCw } from "lucide-react";

import { useConfirm } from "@/components/feedback/FeedbackSystem";
import { createClient } from "@/lib/supabase/client";

export type AdmissionCalendarIssue =
  | "ACADEMIC_CALENDAR_NOT_CONFIGURED"
  | "ACADEMIC_CALENDAR_YEAR_MISMATCH";

type OfficialTemplate = {
  id: string;
  nome: string;
  ano_base: number;
  subsistema?: string | null;
  fonte_referencia?: string | null;
};

type Props = {
  escolaId: string;
  anoLetivo: number | null;
  issue: AdmissionCalendarIssue;
  message?: string | null;
  onReviewTurma?: () => void;
  onResume: () => void;
};

/**
 * Resolução contextual: nunca altera o ano activo nem o vínculo global de uma
 * turma. Só aplica modelos oficiais do mesmo ano pela API já autorizada.
 * O operador permanece no Balcão, com a candidatura em edição.
 */
export function AdmissionCalendarResolution({
  escolaId,
  anoLetivo,
  issue,
  message,
  onReviewTurma,
  onResume,
}: Props) {
  const confirm = useConfirm();
  const supabase = useMemo(() => createClient(), []);
  const [templates, setTemplates] = useState<OfficialTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSelectOfficialTemplate =
    issue === "ACADEMIC_CALENDAR_NOT_CONFIGURED" &&
    Number.isInteger(anoLetivo) && Number(anoLetivo) > 0;

  useEffect(() => {
    setApplied(false);
    setTemplateId("");
    setError(null);
    setTemplates([]);
    if (!canSelectOfficialTemplate) return;

    let active = true;
    setLoading(true);
    const load = async () => {
      try {
        const { data, error: queryError } = await supabase
          .from("calendario_templates")
          .select("id,nome,ano_base,subsistema,fonte_referencia")
          .eq("is_oficial", true)
          .eq("ano_base", anoLetivo!)
          .order("nome", { ascending: true });
        if (queryError) throw queryError;
        if (active) setTemplates((data ?? []) as OfficialTemplate[]);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Não foi possível consultar os calendários oficiais.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [anoLetivo, canSelectOfficialTemplate, supabase]);

  const selected = templates.find((item) => item.id === templateId) ?? null;

  const applyTemplate = async () => {
    if (!selected || selected.ano_base !== anoLetivo || applying) return;
    const accepted = await confirm({
      title: "Aplicar calendário oficial",
      message: `Aplicar «${selected.nome}» ao ano letivo ${anoLetivo}? Os períodos oficiais desse ano serão actualizados para a escola.`,
      confirmLabel: "Aplicar calendário",
    });
    if (!accepted) return;

    setApplying(true);
    setError(null);
    try {
      const response = await fetch(`/api/escola/${encodeURIComponent(escolaId)}/admin/calendario/aplicar-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: selected.id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok !== true) {
        throw new Error(response.status === 403
          ? "Esta alteração exige autorização da direção ou secretaria responsável."
          : payload?.error || "Não foi possível aplicar o calendário oficial.");
      }
      setApplied(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível aplicar o calendário.");
    } finally {
      setApplying(false);
    }
  };

  return (
    <section role="alert" aria-label="Resolver calendário da candidatura"
      className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-foreground dark:border-amber-500/40 dark:bg-amber-500/10">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {issue === "ACADEMIC_CALENDAR_YEAR_MISMATCH"
                ? "Rever o ano letivo da turma"
                : "Calendário académico necessário"}
            </h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {message || "A matrícula está preservada. Resolva a situação e retome a operação aqui."}
            </p>
          </div>

          {issue === "ACADEMIC_CALENDAR_YEAR_MISMATCH" ? (
            <p className="text-xs text-muted-foreground">
              A turma não corresponde ao ano letivo da candidatura. Reveja a turma neste atendimento.
              O Balcão não altera automaticamente o ano de uma turma que pode ter outros alunos.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {anoLetivo
                  ? `Modelos oficiais disponíveis para o ano ${anoLetivo}. Não será activado outro ano letivo.`
                  : "Não foi possível identificar o ano letivo da candidatura. Reveja a turma antes de continuar."}
              </p>
              {loading ? (
                <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" /> A consultar calendários...
                </p>
              ) : templates.length > 0 && !applied ? (
                <div className="space-y-2">
                  <label htmlFor="admission-official-calendar" className="block text-xs font-semibold text-foreground">
                    Calendário oficial
                  </label>
                  <select id="admission-official-calendar" value={templateId}
                    onChange={(event) => setTemplateId(event.target.value)}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-amber focus:outline-none focus:ring-2 focus:ring-amber/20">
                    <option value="">Escolher modelo...</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.nome}{template.subsistema ? ` · ${template.subsistema}` : ""}
                      </option>
                    ))}
                  </select>
                  {selected?.fonte_referencia ? (
                    <p className="text-xs text-muted-foreground">{selected.fonte_referencia}</p>
                  ) : null}
                  <button type="button" disabled={!templateId || applying} onClick={() => void applyTemplate()}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-amber px-3 py-2 text-xs font-bold text-amber-950 hover:brightness-95 disabled:opacity-50">
                    {applying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CalendarCheck2 className="h-4 w-4" />}
                    Aplicar calendário
                  </button>
                </div>
              ) : !applied && !error ? (
                <p className="text-xs text-muted-foreground">
                  Não há modelo oficial disponível para este ano nesta escola.
                  Reveja a turma ou solicite à direção a configuração do calendário.
                </p>
              ) : null}
            </>
          )}

          {applied ? (
            <p role="status" className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <Check className="h-4 w-4" />
              Calendário aplicado. Retome a matrícula para validar novamente a turma.
            </p>
          ) : null}
          {error ? <p role="alert" className="text-xs font-semibold text-red-700 dark:text-red-300">{error}</p> : null}

          <div className="flex flex-wrap gap-2">
            {onReviewTurma ? (
              <button type="button" onClick={onReviewTurma}
                className="min-h-10 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted">
                Rever turma
              </button>
            ) : null}
            <button type="button" onClick={onResume}
              className="min-h-10 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted">
              {applied ? "Retomar matrícula" : "Voltar à matrícula"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

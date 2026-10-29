"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarCheck2, Check, RefreshCw } from "lucide-react";

import { useConfirm } from "@/components/feedback/FeedbackSystem";
import { createClient } from "@/lib/supabase/client";
import { fetchPeriodosLetivos } from "@/lib/periodosLetivosClient";

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

type AcademicYear = {
  id: string;
  ano: number;
  data_inicio: string;
  data_fim: string;
};

type PeriodDraft = {
  id?: string;
  ano_letivo_id: string;
  tipo: "TRIMESTRE" | "SEMESTRE" | "BIMESTRE";
  numero: number;
  data_inicio: string;
  data_fim: string;
  trava_notas_em?: string | null;
  peso: number | null;
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
 * turma. Aplica modelos do mesmo ano ou permite ajustes manuais auditados
 * pela API existente, sem contornar as permissões da escola.
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
  const [year, setYear] = useState<AcademicYear | null>(null);
  const [periodos, setPeriodos] = useState<PeriodDraft[]>([]);
  const [manualMotivo, setManualMotivo] = useState("");
  const [savingManual, setSavingManual] = useState(false);

  const canSelectOfficialTemplate =
    issue === "ACADEMIC_CALENDAR_NOT_CONFIGURED" &&
    Number.isInteger(anoLetivo) && Number(anoLetivo) > 0;

  useEffect(() => {
    setApplied(false);
    setTemplateId("");
    setError(null);
    setTemplates([]);
    setYear(null);
    setPeriodos([]);
    setManualMotivo("");
    if (!canSelectOfficialTemplate) return;

    let active = true;
    setLoading(true);
    const load = async () => {
      try {
        const [templatesResult, yearResult] = await Promise.all([
          (supabase as any).from("calendario_templates")
            .select("id,nome,ano_base,subsistema,fonte_referencia")
            .eq("is_oficial", true)
            .eq("ano_base", anoLetivo!)
            .order("nome", { ascending: true }),
          supabase.from("anos_letivos")
            .select("id,ano,data_inicio,data_fim")
            .eq("escola_id", escolaId)
            .eq("ano", anoLetivo!)
            .maybeSingle(),
        ]);
        if (templatesResult.error) throw templatesResult.error;
        if (yearResult.error) throw yearResult.error;
        if (!active) return;
        setTemplates((templatesResult.data ?? []) as OfficialTemplate[]);
        const loadedYear = yearResult.data as AcademicYear | null;
        setYear(loadedYear);
        if (loadedYear) {
          const response = await fetchPeriodosLetivos(escolaId, loadedYear.id);
          if (response.error) throw new Error(response.error);
          if (!active) return;
          setPeriodos((response.periodos ?? []) as PeriodDraft[]);
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Não foi possível consultar o calendário.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [anoLetivo, canSelectOfficialTemplate, escolaId, supabase]);

  const selected = templates.find((item) => item.id === templateId) ?? null;

  const changePeriod = (index: number, patch: Partial<PeriodDraft>) => {
    setPeriodos((current) => current.map((periodo, i) => i === index ? { ...periodo, ...patch } : periodo));
  };

  const saveManualCalendar = async () => {
    if (!year || savingManual || periodos.length === 0) return;
    const validRange = (inicio: string, fim: string) => /^\d{4}-\d{2}-\d{2}$/.test(inicio) && /^\d{4}-\d{2}-\d{2}$/.test(fim) && inicio <= fim;
    if (!validRange(year.data_inicio, year.data_fim) ||
        periodos.some((periodo) => !validRange(periodo.data_inicio, periodo.data_fim) ||
          periodo.data_inicio < year.data_inicio || periodo.data_fim > year.data_fim)) {
      setError("Confirme as datas dos períodos e do ano letivo.");
      return;
    }
    const total = periodos.reduce((sum, periodo) => sum + Number(periodo.peso ?? 0), 0);
    if (total !== 100 || manualMotivo.trim().length < 5) {
      setError("A soma dos pesos deve ser 100% e a justificação deve ter pelo menos 5 caracteres.");
      return;
    }
    const ordered = [...periodos].sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));
    if (ordered.some((periodo, index) => index > 0 && periodo.data_inicio <= ordered[index - 1].data_fim)) {
      setError("Os períodos letivos não podem sobrepor-se.");
      return;
    }
    const accepted = await confirm({
      title: "Guardar ajuste do calendário",
      message: `Confirma os períodos do ano ${anoLetivo}? Esta alteração afecta o calendário da escola e será auditada.`,
      confirmLabel: "Guardar ajuste",
    });
    if (!accepted) return;

    setSavingManual(true);
    setError(null);
    try {
      const response = await fetch(`/api/escola/${encodeURIComponent(escolaId)}/admin/calendario/ajustes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ano_letivo_id: year.id,
          data_inicio: year.data_inicio,
          data_fim: year.data_fim,
          motivo: manualMotivo.trim(),
          periodos: periodos.map((periodo) => ({ ...periodo, ano_letivo_id: year.id })),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok !== true) {
        throw new Error(response.status === 403
          ? "Esta alteração exige autorização da direção ou secretaria responsável."
          : payload?.error || "Não foi possível guardar os períodos.");
      }
      setApplied(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível guardar o calendário.");
    } finally {
      setSavingManual(false);
    }
  };

  const addPeriod = () => {
    if (!year || periodos.length >= 20) return;
    setPeriodos((current) => [
      ...current,
      {
        ano_letivo_id: year.id,
        tipo: "TRIMESTRE",
        numero: Math.min(4, current.length + 1),
        data_inicio: "",
        data_fim: "",
        peso: null,
      },
    ]);
  };

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
              {!applied && year && (
                <details className="rounded-lg border border-border bg-card p-3">
                  <summary className="cursor-pointer text-xs font-semibold text-foreground">
                    Ajustar períodos manualmente
                  </summary>
                  <div className="mt-3 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Use apenas para uma excepção autorizada. O ajuste é registado no histórico da escola.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {(["data_inicio", "data_fim"] as const).map((field) => (
                        <label key={field} className="space-y-1 text-xs text-foreground">
                          <span>{field === "data_inicio" ? "Início do ano" : "Fim do ano"}</span>
                          <input type="date" value={year[field] || ""}
                            onChange={(event) => setYear((current) => current ? { ...current, [field]: event.target.value } : current)}
                            className="w-full rounded-lg border border-border bg-background p-2 text-xs text-foreground" />
                        </label>
                      ))}
                    </div>
                    {periodos.map((periodo, index) => (
                      <div key={periodo.id ?? index} className="space-y-2 rounded-lg border border-border bg-muted/50 p-2">
                        <div className="flex items-center gap-2">
                          <select aria-label="Tipo de período" value={periodo.tipo}
                            onChange={(event) => changePeriod(index, { tipo: event.target.value as PeriodDraft["tipo"] })}
                            className="min-w-0 flex-1 rounded border border-border bg-card p-2 text-xs text-foreground">
                            <option value="TRIMESTRE">Trimestre</option>
                            <option value="SEMESTRE">Semestre</option>
                            <option value="BIMESTRE">Bimestre</option>
                          </select>
                          <select aria-label="Número do período" value={periodo.numero}
                            onChange={(event) => changePeriod(index, { numero: Number(event.target.value) })}
                            className="rounded border border-border bg-card p-2 text-xs text-foreground">
                            {[1, 2, 3, 4].map((numero) => <option key={numero} value={numero}>{numero}º</option>)}
                          </select>
                          {!periodo.id ? (
                            <button type="button" onClick={() => setPeriodos((current) => current.filter((_, i) => i !== index))}
                              className="rounded border border-border px-2 py-1 text-xs text-foreground">Remover</button>
                          ) : null}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {(["data_inicio", "data_fim"] as const).map((field) => (
                            <label key={field} className="space-y-1 text-xs text-foreground">
                              <span>{field === "data_inicio" ? "Início" : "Fim"}</span>
                              <input type="date" value={periodo[field] || ""}
                                onChange={(event) => changePeriod(index, field === "data_inicio"
                                  ? { data_inicio: event.target.value }
                                  : { data_fim: event.target.value })}
                                className="w-full rounded border border-border bg-background p-2 text-xs text-foreground" />
                            </label>
                          ))}
                        </div>
                        <label className="flex items-center gap-2 text-xs text-foreground">
                          Peso (%)
                          <input type="number" min={0} max={100} value={periodo.peso ?? ""}
                            onChange={(event) => changePeriod(index, { peso: event.target.value ? Number(event.target.value) : null })}
                            className="w-20 rounded border border-border bg-background p-2 text-xs text-foreground" />
                        </label>
                      </div>
                    ))}
                    <button type="button" onClick={addPeriod} disabled={periodos.length >= 20}
                      className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50">
                      Adicionar período
                    </button>
                    <label className="block space-y-1 text-xs text-foreground">
                      <span>Justificação do ajuste</span>
                      <textarea value={manualMotivo} onChange={(event) => setManualMotivo(event.target.value)}
                        rows={2} placeholder="Motivo do ajuste autorizado"
                        className="w-full resize-none rounded-lg border border-border bg-background p-2 text-xs text-foreground" />
                    </label>
                    <button type="button" onClick={() => void saveManualCalendar()}
                      disabled={savingManual || periodos.length === 0 || manualMotivo.trim().length < 5}
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-amber px-3 py-2 text-xs font-bold text-amber-950 hover:brightness-95 disabled:opacity-50">
                      {savingManual && <RefreshCw className="h-4 w-4 animate-spin" />}
                      Guardar períodos
                    </button>
                  </div>
                </details>
              )}
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

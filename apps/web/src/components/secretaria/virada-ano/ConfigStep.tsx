"use client";

import { useCallback, useEffect, useState } from "react";
import { 
  Copy, 
  Loader2, 
  AlertCircle,
  Percent,
  Calendar,
  Layers,
  Database
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/feedback/FeedbackSystem";
import { PreparationInputs } from "./PreparationInputs";

type Session = {
  id: string;
  ano: number;
  has_data: boolean;
};

type OfficialCalendar = {
  ano_base: number;
  data_inicio: string;
  data_fim: string;
  versao_documento: string;
  estado: string;
};

type OfficialTemplate = {
  id: string;
  nome: string;
  ano_base: number;
  data_inicio: string;
  data_fim: string;
  subsistema: string | null;
  calendario_canonico_ano?: number | null;
  versao_documento: string | null;
};

type EducationOffering = {
  id: string;
  course_id: string | null;
  course_name: string | null;
  education_subsystem: string;
  education_level: string;
  cycle: string | null;
  grades: string[] | null;
  calendar_profile_id: string | null;
  status: string;
};

const OFFERING_SUBSYSTEM_LABELS: Record<string, string> = {
  PRE_ESCOLAR: "Pré-escolar",
  REGULAR_ADULTOS: "Regular e Adultos",
  TECNICO_PROFISSIONAL: "Técnico-profissional",
  SECUNDARIO_PEDAGOGICO: "Secundário pedagógico",
};

const OFFERING_LEVEL_LABELS: Record<string, string> = {
  PRE_SCHOOL: "Pré-escolar",
  PRIMARY: "Ensino Primário",
  SECONDARY: "Ensino Secundário",
};

type CloneSummary = {
  turmas?: number;
  precos?: number;
  periodos?: number;
  disciplinas?: number;
  totals?: {
    turmas: number;
    precos: number;
    periodos: number;
    disciplinas: number;
  };
  created?: { turmas: number; precos: number; periodos: number; disciplinas: number };
  reused?: { turmas: number; precos: number; periodos: number; disciplinas: number };
  divergent?: { turmas: number; precos: number; periodos: number; disciplinas: number };
  idempotent?: boolean;
};

type SessionsTargetResponse = {
  ok?: boolean;
  current_session?: Session | null;
  target_sessions?: Session[];
  official_calendars?: OfficialCalendar[];
  official_templates?: OfficialTemplate[];
  education_offerings?: EducationOffering[];
};

type CreateTargetResponse = {
  ok?: boolean;
  error?: string;
  target_session?: Session;
};

type CloneResponse = {
  ok?: boolean;
  error?: string;
  result?: {
    summary?: CloneSummary;
  };
};

type PricingPreviewResponse = {
  ok?: boolean;
  error?: string;
  summary?: { tabelas: number; overrides: number };
};

export function ConfigStep({
  onComplete,
  saveProgress,
}: {
  onComplete: () => void;
  saveProgress: (step: number, payload?: Record<string, unknown>) => Promise<void>;
}) {
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [targets, setTargets] = useState<Session[]>([]);
  const [templates, setTemplates] = useState<OfficialTemplate[]>([]);
  const [officialCalendars, setOfficialCalendars] = useState<OfficialCalendar[]>([]);
  const [selectedCalendarYear, setSelectedCalendarYear] = useState("");
  const [offerings, setOfferings] = useState<EducationOffering[]>([]);
  const [offeringTemplates, setOfferingTemplates] = useState<Record<string, string>>({});
  const [selectedTarget, setSelectedTarget] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [reajuste, setReajuste] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [cloning, setCloning] = useState(false);
  const [result, setResult] = useState<CloneSummary | null>(null);
  const [pricingPreview, setPricingPreview] = useState<PricingPreviewResponse | null>(null);
  const [previewingPricing, setPreviewingPricing] = useState(false);
  const [creatingTarget, setCreatingTarget] = useState(false);

  const { success, error } = useToast();

  const loadSessions = useCallback(async () => {
    return fetch("/api/secretaria/operacoes-academicas/virada/sessions-target", { cache: "no-store" })
      .then(r => r.json())
      .then((json: SessionsTargetResponse) => {
        if (json.ok) {
          setCurrentSession(json.current_session ?? null);
          setTargets(json.target_sessions ?? []);
          setTemplates(json.official_templates ?? []);
          setOfficialCalendars(json.official_calendars ?? []);
          setSelectedCalendarYear((current) => current || String(json.official_calendars?.[0]?.ano_base ?? ""));
          const loadedOfferings = json.education_offerings ?? [];
          setOfferings(loadedOfferings);
          setOfferingTemplates(Object.fromEntries(
            loadedOfferings.map((offering) => [offering.id, offering.calendar_profile_id ?? ""])
          ));
          if ((json.target_sessions ?? []).length > 0) {
            setSelectedTarget(json.target_sessions?.[0]?.id ?? "");
          }
          if ((json.official_templates ?? []).length === 1) {
            setSelectedTemplate(json.official_templates?.[0]?.id ?? "");
          } else {
            setSelectedTemplate("");
          }
        }
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const profilesForCalendar = templates.filter((profile) =>
    profile.calendario_canonico_ano === Number(selectedCalendarYear));
  const resolveProfile = (offering: EducationOffering) => {
    const eligible = profilesForCalendar.filter((profile) =>
      profile.subsistema === offering.education_subsystem);
    const current = eligible.find((profile) => profile.id === offeringTemplates[offering.id]);
    return current?.id ?? (eligible.length === 1 ? eligible[0].id : "");
  };

  const handleCreateTarget = async () => {
    const canonicalYear = Number(selectedCalendarYear);
    const usingCanonical = canonicalYear >= 2026 &&
      officialCalendars.some((calendar) => calendar.ano_base === canonicalYear);
    const mappings = offerings.length > 0
      ? offerings.map((offering) => ({
          offering_id: offering.id,
          template_id: usingCanonical
            ? resolveProfile(offering)
            : offeringTemplates[offering.id],
        }))
      : [];
    if (offerings.length > 0 && mappings.some((mapping) => !mapping.template_id)) {
      error("Confirme o perfil de calendário de cada curso.");
      return;
    }
    if (usingCanonical && offerings.length === 0) {
      error("Configure as ofertas educativas dos cursos antes de preparar o ano.");
      return;
    }
    if (!usingCanonical && !selectedTemplate) return;

    setCreatingTarget(true);
    try {
      const body = usingCanonical
        ? { ano_base: canonicalYear, offerings: mappings }
        : offerings.length > 0 ? { offerings: mappings } : { template_id: selectedTemplate };
      const response = await fetch("/api/secretaria/operacoes-academicas/virada/sessions-target", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await response.json()) as CreateTargetResponse;
      if (!response.ok || !json.ok || !json.target_session) {
        error(json.error || "Não foi possível preparar o ano seguinte.");
        return;
      }
      await loadSessions();
      setSelectedTarget(json.target_session.id);
      success("Ano preparado com os perfis MED dos cursos. O calendário atual permanece inalterado até à virada.");
    } catch {
      error("Não foi possível preparar o ano letivo.");
    } finally {
      setCreatingTarget(false);
    }
  };

  const handleClone = async () => {
    if (!selectedTarget || !pricingPreview?.ok) return;
    setCloning(true);
    try {
      const res = await fetch("/api/secretaria/operacoes-academicas/virada/clone-structure", {
        method: "POST",
        body: JSON.stringify({
          from_session_id: currentSession?.id,
          to_session_id: selectedTarget,
          readjust_percent: reajuste
        }),
      });
      const json = (await res.json()) as CloneResponse;
      if (json.ok) {
        success("Próximo ano preparado com sucesso!");
        setResult(json.result?.summary ?? {});
        await saveProgress(0, {
          source_session_id: currentSession?.id,
          target_session_id: selectedTarget,
        });
        onComplete();
      } else {
        error(json.error || "Falha na clonagem.");
      }
    } finally {
      setCloning(false);
    }
  };

  useEffect(() => {
    if (!currentSession || !selectedTarget) return;

    const target = targets.find((session) => session.id === selectedTarget);
    if (!target) return;

    const controller = new AbortController();
    setPricingPreview(null);
    setPreviewingPricing(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch("/api/secretaria/operacoes-academicas/virada/precos/preview", {
            method: "POST",
            signal: controller.signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ano_origem: currentSession.ano,
              ano_destino: target.ano,
              ajuste: { percentual: reajuste, arredondar_para: 100, overrides: {} },
            }),
          });
          if (!controller.signal.aborted) setPricingPreview(await response.json());
        } catch (previewError) {
          if (previewError instanceof DOMException && previewError.name === "AbortError") return;
          setPricingPreview({ ok: false, error: "Não foi possível validar os preços." });
        } finally {
          if (!controller.signal.aborted) setPreviewingPricing(false);
        }
      })();
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [currentSession, selectedTarget, reajuste, targets]);

  if (loading) return <div className="py-10 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-muted-foreground" /></div>;

  if (result) {
    const createdAnything = result.created
      ? Object.values(result.created).some((count) => count > 0)
      : Boolean(result.turmas || result.precos || result.periodos || result.disciplinas);
    return (
      <div className="space-y-6 animate-in zoom-in-95">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-emerald-900">Próximo ano preparado</h3>
            <p className="text-sm text-emerald-700 mt-1">
              {createdAnything
                ? "A estrutura académica e financeira recebeu novos registos."
                : "A estrutura já estava preparada; esta repetição não criou registos duplicados."}
            </p>
            
            <div className="mt-8 grid grid-cols-2 gap-3 max-w-sm mx-auto">
                <div className="bg-background p-3 rounded-xl border border-emerald-100 shadow-sm">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Turmas no destino</p>
                    <p className="text-xl font-black text-foreground">{result.totals?.turmas ?? result.turmas}</p>
                    <p className="text-[10px] text-muted-foreground">+{result.turmas ?? 0} nesta execução</p>
                </div>
                <div className="bg-background p-3 rounded-xl border border-emerald-100 shadow-sm">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Preços no destino</p>
                    <p className="text-xl font-black text-foreground">{result.totals?.precos ?? result.precos}</p>
                    <p className="text-[10px] text-muted-foreground">+{result.precos ?? 0} nesta execução</p>
                </div>
                <div className="bg-background p-3 rounded-xl border border-emerald-100 shadow-sm">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Períodos no destino</p>
                    <p className="text-xl font-black text-foreground">{result.totals?.periodos ?? result.periodos}</p>
                    <p className="text-[10px] text-muted-foreground">+{result.periodos ?? 0} nesta execução</p>
                </div>
                <div className="bg-background p-3 rounded-xl border border-emerald-100 shadow-sm">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Disciplinas no destino</p>
                    <p className="text-xl font-black text-foreground">{result.totals?.disciplinas ?? result.disciplinas}</p>
                    <p className="text-[10px] text-muted-foreground">+{result.disciplinas ?? 0} nesta execução</p>
                </div>
            </div>
            {result.created && result.reused && (
              <div className="mx-auto mt-5 max-w-md rounded-xl border border-emerald-100 bg-background p-4 text-left">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Resultado desta execução</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <span className="font-semibold text-emerald-700">Novos registos: {Object.values(result.created).reduce((total, count) => total + count, 0)}</span>
                  <span className="font-semibold text-muted-foreground">Já existentes: {Object.values(result.reused).reduce((total, count) => total + count, 0)}</span>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {result.idempotent ? "A execução foi idempotente: nada novo foi criado." : "Os itens novos foram criados e os itens existentes foram reutilizados."}
                </p>
              </div>
            )}
            {result.divergent && Object.values(result.divergent).some((count) => count > 0) && (
              <div className="mx-auto mt-3 max-w-md rounded-xl border border-rose-100 bg-rose-50 p-4 text-left">
                <p className="text-[10px] font-bold uppercase tracking-widest text-rose-600">Divergências a revisar</p>
                <p className="mt-1 text-xs leading-relaxed text-rose-800">
                  Faltam {Object.values(result.divergent).reduce((total, count) => total + count, 0)} registos em relação à estrutura da origem. Reveja o destino antes de ativar o ano.
                </p>
              </div>
            )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <PreparationInputs anoLetivo={currentSession?.ano ?? 2025} />
      <div className="grid gap-6 md:grid-cols-2">
        {/* Lado Esquerdo: Configuração */}
        <section className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Sessão de Destino</label>
            <select 
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
              className="w-full h-12 rounded-xl border border-border bg-background px-4 text-sm font-semibold outline-none focus:ring-4 focus:ring-amber/10 transition-all"
            >
              {targets.map(s => (
                <option key={s.id} value={s.id}>
                  Ano Lectivo {s.ano} {s.has_data ? '(Já possui dados)' : ''}
                </option>
              ))}
              {targets.length === 0 && <option disabled>Nenhum ano futuro cadastrado</option>}
            </select>
            {(targets.length === 0 || officialCalendars.length > 0 || (currentSession?.ano ?? 0) >= 2026) && (
              <div className="mt-3 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-semibold text-amber-900">
                  O calendário do ano seguinte é configurado uma única vez. Os perfis MED são herdados por curso sem alterar o ano ativo.
                </p>
                {officialCalendars.length > 0 ? (
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold text-foreground">
                      Calendário oficial do ano
                      <select value={selectedCalendarYear}
                        onChange={(event) => setSelectedCalendarYear(event.target.value)}
                        className="mt-1 h-11 w-full rounded-lg border border-amber-200 bg-background px-3 text-sm font-semibold"
                        aria-label="Calendário oficial do ano letivo">
                        {officialCalendars.map((calendar) => (
                          <option key={calendar.ano_base} value={String(calendar.ano_base)}>
                            {calendar.ano_base}/{calendar.ano_base + 1} · MED · {calendar.versao_documento}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="text-xs text-muted-foreground">
                      {offerings.length} oferta(s) educativa(s) herdam este ano; os perfis abaixo
                      aplicam apenas as particularidades do respetivo curso.
                    </p>
                    {offerings.map((offering) => {
                      const eligible = profilesForCalendar.filter((profile) =>
                        profile.subsistema === offering.education_subsystem);
                      return (
                        <div key={offering.id} className="grid gap-2 sm:grid-cols-[1fr_1.4fr] sm:items-center">
                          <span className="text-xs font-semibold text-foreground">
                            <span className="block">{offering.course_name || "Oferta educativa"}</span>
                            <span className="text-[10px] font-normal text-muted-foreground">
                              {OFFERING_SUBSYSTEM_LABELS[offering.education_subsystem] || "Perfil educativo"}
                              {" · "}
                              {OFFERING_LEVEL_LABELS[offering.education_level] || "Nível de ensino"}
                            </span>
                          </span>
                          {eligible.length === 1 ? (
                            <span className="rounded-lg border border-amber-200 bg-background px-3 py-2 text-xs font-medium text-foreground">
                              {eligible[0].nome}
                            </span>
                          ) : (
                            <select value={resolveProfile(offering)}
                              onChange={(event) => setOfferingTemplates((current) => ({
                                ...current, [offering.id]: event.target.value,
                              }))}
                              className="h-11 rounded-lg border border-amber-200 bg-background px-3 text-xs"
                              aria-label={`Perfil académico de ${offering.course_name || offering.id}`}>
                              <option value="">Selecionar perfil do curso</option>
                              {eligible.map((profile) => (
                                <option key={profile.id} value={profile.id}>{profile.nome}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      );
                    })}
                    <Button tone="gold" size="sm" onClick={handleCreateTarget}
                      loading={creatingTarget}
                      disabled={!selectedCalendarYear || offerings.length === 0 ||
                        offerings.some((offering) => !resolveProfile(offering))}>
                      Preparar ano com calendário oficial
                    </Button>
                  </div>
                ) : templates.length > 0 ? (
                  <div className="space-y-3">
                    <select value={selectedTemplate} onChange={(event) => setSelectedTemplate(event.target.value)}
                      className="h-11 w-full rounded-lg border border-amber-200 bg-background px-3 text-xs"
                      aria-label="Calendário histórico">
                      <option value="">Selecione um calendário histórico</option>
                      {templates.filter((template) => template.ano_base < 2026).map((template) => (
                        <option key={template.id} value={template.id}>{template.nome}</option>
                      ))}
                    </select>
                    <Button tone="gold" size="sm" onClick={handleCreateTarget}
                      loading={creatingTarget} disabled={!selectedTemplate}>
                      Criar ano histórico
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs font-semibold text-rose-700">
                    O MED ainda não publicou um calendário para o próximo ano letivo. O ano atual continua disponível; a virada só será liberada após a publicação.
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Reajuste de Mensalidades (%)</label>
            <div className="relative">
              <Percent className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input 
                type="number"
                value={reajuste}
                onChange={(e) => setReajuste(Number(e.target.value))}
                className="w-full h-12 rounded-xl border border-border bg-background pl-12 pr-4 text-sm font-semibold outline-none focus:ring-4 focus:ring-amber/10 transition-all"
                placeholder="Ex: 10"
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">O valor será aplicado sobre a tabela de preços do ano atual.</p>
            <div className="mt-3 flex items-center gap-3" aria-live="polite">
              {previewingPricing && (
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> A validar preços…
                </span>
              )}
              {pricingPreview?.summary && (
                <span className="text-xs font-semibold text-emerald-700">
                  {pricingPreview.summary.tabelas} tabelas validadas automaticamente
                </span>
              )}
              {pricingPreview?.error && <span className="text-xs font-semibold text-rose-600">{pricingPreview.error}</span>}
            </div>
          </div>
        </section>

        {/* Lado Direito: Resumo do Espelhamento */}
        <section className="rounded-2xl border border-border bg-muted/50 p-5 space-y-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Copy className="h-4 w-4 text-amber" /> O que será transportado:
          </h3>
          <ul className="space-y-3">
            <li className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="p-1.5 rounded-lg bg-background shadow-sm border border-border text-purple-500"><Calendar className="h-3.5 w-3.5" /></div>
                <span>Estrutura de <strong>Períodos Letivos</strong> (Trimestres/Datas)</span>
            </li>
            <li className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="p-1.5 rounded-lg bg-background shadow-sm border border-border text-blue-500"><Layers className="h-3.5 w-3.5" /></div>
                <span><strong>Currículos, matrizes e disciplinas</strong> preparados para o novo ano</span>
            </li>
            <li className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="p-1.5 rounded-lg bg-background shadow-sm border border-border text-blue-500"><Layers className="h-3.5 w-3.5" /></div>
                <span>Catálogo de <strong>Turmas sem alunos</strong>, com capacidade, turnos e estrutura académica</span>
            </li>
            <li className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="p-1.5 rounded-lg bg-background shadow-sm border border-border text-emerald-500"><Database className="h-3.5 w-3.5" /></div>
                <span>Tabela de <strong>Preços</strong> com o reajuste configurado</span>
            </li>
          </ul>
        </section>
      </div>

      <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">
              <strong>Atenção:</strong> A clonagem é uma operação de "Setup Rápido". 
              Ela não move os alunos, apenas prepara o terreno operacional para que a simulação de rematrícula (Próximo Passo) possa ocorrer.
          </p>
      </div>

      <div className="pt-4 flex justify-center">
          <Button 
            tone="gold" 
            className="h-12 px-10 gap-2 font-bold shadow-md hover:shadow-lg transition-all" 
            onClick={handleClone}
            loading={cloning}
            disabled={!selectedTarget || !pricingPreview?.ok}
          >
            <Wand2 className="h-4 w-4" /> Preparar próximo ano
          </Button>
      </div>
    </div>
  );
}

function CheckCircle2({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
    );
}

function Wand2({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.21 1.21 0 0 0 1.72 0L21.64 5.36a1.21 1.21 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/><path d="M5 6v1"/><path d="M11 2v2"/><path d="M2 11h2"/><path d="M20 11h2"/><path d="M11 20v2"/><path d="M17 17l1 1"/><path d="M7 7l1 1"/>
        </svg>
    );
}

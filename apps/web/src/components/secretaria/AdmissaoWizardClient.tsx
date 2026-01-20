// apps/web/src/components/secretaria/AdmissaoWizardClient.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Check, Loader2, Save } from "lucide-react";

/**
 * KLASSE Standard:
 * - No nulls in payload for draft (Zod optional != null)
 * - Do not send empty strings for uuid fields
 * - Dedupe + debounce autosave (avoid spam + 400 loops)
 * - Strict UUID guards
 * - UI tokens: rounded-xl, focus ring gold, buttons styles
 */

type UUID = string;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(v: unknown): v is UUID {
  return typeof v === "string" && UUID_RE.test(v);
}

function pickDefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  // remove undefined/null/"" (empty strings) -> prevents Zod issues + UUID placeholders
  const entries = Object.entries(obj).filter(([, v]) => {
    if (v === undefined || v === null) return false;
    if (typeof v === "string" && v.trim() === "") return false;
    return true;
  });
  return Object.fromEntries(entries) as Partial<T>;
}

function safeUuid(v: unknown): UUID | undefined {
  return isUuid(v) ? v : undefined;
}

// Debounce hook (stable)
function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

async function postJson<TResp>(
  url: string,
  payload: unknown,
  extraHeaders?: Record<string, string>
): Promise<{ ok: true; data: TResp } | { ok: false; status: number; error: string; raw?: any }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(extraHeaders ?? {}) },
    body: JSON.stringify(payload),
  });

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // ignore
  }

  if (!res.ok) {
    // Route returns { error: zod.format() } or { error: string }
    const fallbackError =
      typeof json?.error === "string"
        ? json.error
        : json?.error
        ? JSON.stringify(json.error)
        : "Falha na requisição.";
    const detail = typeof json?.details === "string" ? json.details : null;
    const code = typeof json?.code === "string" ? json.code : null;
    const msg = detail
      ? [fallbackError, detail, code ? `(${code})` : null].filter(Boolean).join(" ")
      : fallbackError;
    return { ok: false, status: res.status, error: msg, raw: json };
  }

  return { ok: true, data: json as TResp };
}

/** =========================
 * Step 1: Identificação
 * ========================= */

type DraftIdentificacao = {
  nome_candidato?: string;
  telefone?: string;
  bi_numero?: string;
  email?: string;
};

function Step1Identificacao(props: {
  onNext: () => void;
  escolaId: string;
  candidaturaId: string | null;
  setCandidaturaId: (id: string | null) => void;
  initialData: any;
  hydrated: boolean;
  canEditDraft: boolean;
}) {
  const { onNext, escolaId, candidaturaId, setCandidaturaId, initialData, hydrated, canEditDraft } = props;

  const [form, setForm] = useState<DraftIdentificacao>({
    nome_candidato: "",
    telefone: "",
    bi_numero: "",
    email: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  // hydrate initial
  useEffect(() => {
    if (!initialData) return;
    setForm({
      nome_candidato: initialData.nome_candidato ?? "",
      telefone: initialData.dados_candidato?.telefone ?? "",
      bi_numero: initialData.dados_candidato?.bi_numero ?? "",
      email: initialData.dados_candidato?.email ?? "",
    });
  }, [initialData]);

  const debouncedForm = useDebouncedValue(form, 650);

  // dedupe autosave: avoid same payload re-sending
  const lastHashRef = useRef<string>("");

  const payload = useMemo(() => {
    // IMPORTANT: no nulls; no empty strings
    const clean = pickDefined({
      escolaId: safeUuid(escolaId), // must be uuid
      candidaturaId: safeUuid(candidaturaId),
      source: "walkin",
      ...pickDefined(form),
    });

    return clean;
  }, [escolaId, candidaturaId, form]);

  const canAutosave = useMemo(() => {
    if (!hydrated) return false;
    if (!isUuid(escolaId)) return false;
    if (!canEditDraft) return false;
    // only autosave if any field has content
    const anyValue = Object.values(form).some((v) => (v ?? "").trim() !== "");
    return anyValue;
  }, [hydrated, escolaId, form, canEditDraft]);

  const saveDraft = useCallback(
    async (mode: "auto" | "manual") => {
      if (!isUuid(escolaId)) {
        setError("Contexto inválido: escolaId não é UUID.");
        return { ok: false as const };
      }

      if (!canEditDraft) {
        return { ok: true as const, skipped: true as const };
      }

      // If it's auto and nothing meaningful, skip
      if (mode === "auto" && !canAutosave) return { ok: true as const, skipped: true as const };

      const hash = JSON.stringify(payload);
      if (mode === "auto" && hash === lastHashRef.current) {
        return { ok: true as const, skipped: true as const };
      }
      lastHashRef.current = hash;

      setSaving(true);
      setError(null);

      const resp = await postJson<{ ok: boolean; candidatura_id?: string }>(
        "/api/secretaria/admissoes/draft",
        payload
      );

      setSaving(false);

      if (!resp.ok) {
        // Keep candidaturaId (don’t nuke it) — nuking causes loops and UX pain
        setError(resp.error);
        return { ok: false as const };
      }

      if (resp.data?.candidatura_id && isUuid(resp.data.candidatura_id)) {
        setCandidaturaId(resp.data.candidatura_id);
      }

      setLastSavedAt(Date.now());
      return { ok: true as const };
    },
    [escolaId, canAutosave, payload, setCandidaturaId]
  );

  // autosave on debounced form change
  useEffect(() => {
    if (!hydrated) return;
    void saveDraft("auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedForm, hydrated]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleNext = async () => {
    if (!canEditDraft) {
      onNext();
      return;
    }

    const r = await saveDraft("manual");
    if (r.ok) onNext();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-klasse-green">Identificação</h2>
          <p className="text-sm text-slate-500">
            Preencha o básico. O sistema salva automaticamente como rascunho.
          </p>
          {!canEditDraft && (
            <p className="mt-1 text-xs text-amber-700">
              Esta candidatura já foi submetida e não pode ser editada.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm">
          {saving ? (
            <span className="inline-flex items-center gap-2 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Salvando…
            </span>
          ) : lastSavedAt ? (
            <span className="inline-flex items-center gap-2 text-slate-500">
              <Check className="h-4 w-4" />
              Salvo
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 text-slate-400">
              <Save className="h-4 w-4" />
              Rascunho
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-red-700">Não foi possível salvar.</p>
              <p className="mt-1 break-words text-sm text-red-700/90">{error}</p>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => void saveDraft("manual")}
                  className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:brightness-95"
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3">
        <input
          type="text"
          name="nome_candidato"
          value={form.nome_candidato ?? ""}
          onChange={onChange}
          placeholder="Nome completo"
          disabled={!canEditDraft}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold disabled:opacity-60"
        />
        <input
          type="text"
          name="bi_numero"
          value={form.bi_numero ?? ""}
          onChange={onChange}
          placeholder="Nº do BI"
          disabled={!canEditDraft}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold disabled:opacity-60"
        />
        <input
          type="text"
          name="telefone"
          value={form.telefone ?? ""}
          onChange={onChange}
          placeholder="Telefone"
          disabled={!canEditDraft}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold disabled:opacity-60"
        />
        <input
          type="email"
          name="email"
          value={form.email ?? ""}
          onChange={onChange}
          placeholder="Email"
          disabled={!canEditDraft}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold disabled:opacity-60"
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          {candidaturaId ? (
            <span className="font-mono">ID: {candidaturaId}</span>
          ) : (
            <span>Salve o rascunho para gerar o ID.</span>
          )}
        </div>

        <button
          type="button"
          onClick={handleNext}
          disabled={!isUuid(escolaId) || saving}
          className="rounded-xl bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-60"
        >
          Avançar
        </button>
      </div>
    </div>
  );
}

/** =========================
 * Step 2: Fit Acadêmico
 * ========================= */

type RefItem = { id: string; nome: string };
type TurmaVaga = { id: string; nome: string; turno?: string | null; vagas_disponiveis?: number | null };

function Step2FitAcademico(props: {
  onBack: () => void;
  onNext: () => void;
  escolaId: string;
  candidaturaId: string | null;
  setTurmaId: (id: string) => void;
  setCursoId: (id: string | null) => void;
  setClasseId: (id: string | null) => void;
  initialData: any;
  canEditDraft: boolean;
}) {
  const { onBack, onNext, escolaId, candidaturaId, setTurmaId, setCursoId, setClasseId, initialData, canEditDraft } = props;

  const [cursos, setCursos] = useState<RefItem[]>([]);
  const [classes, setClasses] = useState<RefItem[]>([]);
  const [turmas, setTurmas] = useState<TurmaVaga[]>([]);

  const [sel, setSel] = useState({
    cursoId: "",
    classeId: "",
    turmaId: "",
  });

  const [loadingCfg, setLoadingCfg] = useState(false);
  const [loadingVagas, setLoadingVagas] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // hydrate initial
  useEffect(() => {
    if (!initialData) return;
    setSel({
      cursoId: initialData.curso_id ?? "",
      classeId: initialData.classe_id ?? "",
      turmaId: initialData.turma_preferencial_id ?? "",
    });
    setCursoId(initialData.curso_id ?? null);
    setClasseId(initialData.classe_id ?? null);
    if (initialData.turma_preferencial_id) {
      setTurmaId(initialData.turma_preferencial_id);
    }
  }, [initialData]);

  // load cursos/classes
  useEffect(() => {
    if (!isUuid(escolaId)) {
      setError("Contexto inválido: escolaId não é UUID.");
      return;
    }

    (async () => {
      setLoadingCfg(true);
      setError(null);
      const res = await fetch(`/api/secretaria/admissoes/config?escolaId=${encodeURIComponent(escolaId)}`);
      const json = await res.json().catch(() => ({}));
      setLoadingCfg(false);

      if (!res.ok) {
        setError(json?.error ?? "Falha ao carregar cursos e classes.");
        return;
      }

      setCursos(Array.isArray(json?.cursos) ? json.cursos : []);
      setClasses(Array.isArray(json?.classes) ? json.classes : []);
    })();
  }, [escolaId]);

  // load turmas/vagas
  useEffect(() => {
    if (!isUuid(escolaId)) return;
    const cursoId = safeUuid(sel.cursoId);
    const classeId = safeUuid(sel.classeId);

    if (!cursoId || !classeId) {
      setTurmas([]);
      return;
    }

    (async () => {
      setLoadingVagas(true);
      setError(null);
      const url = `/api/secretaria/admissoes/vagas?escolaId=${encodeURIComponent(
        escolaId
      )}&cursoId=${encodeURIComponent(cursoId)}&classeId=${encodeURIComponent(classeId)}`;
      const res = await fetch(url);
      const json = await res.json().catch(() => ({}));
      setLoadingVagas(false);

      if (!res.ok) {
        setError(json?.error ?? "Falha ao carregar vagas.");
        return;
      }

      setTurmas(Array.isArray(json) ? json : []);
    })();
  }, [sel.cursoId, sel.classeId, escolaId]);

  const updateDraft = useCallback(
    async (patch: { curso_id?: string; classe_id?: string; turma_preferencial_id?: string }) => {
      if (!isUuid(escolaId)) {
        setError("Contexto inválido: escolaId não é UUID.");
        return;
      }
      if (!canEditDraft) {
        setError("Candidatura submetida: alterações não permitidas.");
        return;
      }
      if (!safeUuid(candidaturaId)) {
        setError("Salve o rascunho no Passo 1 para gerar a candidatura antes de escolher o fit acadêmico.");
        return;
      }

      const payload = pickDefined({
        escolaId,
        candidaturaId,
        source: "walkin",
        curso_id: safeUuid(patch.curso_id),
        classe_id: safeUuid(patch.classe_id),
        turma_preferencial_id: safeUuid(patch.turma_preferencial_id),
      });

      setSaving(true);
      setError(null);
      const resp = await postJson<{ ok: boolean; candidatura_id?: string }>(
        "/api/secretaria/admissoes/draft",
        payload
      );
      setSaving(false);

      if (!resp.ok) {
        setError(resp.error);
      }
    },
    [escolaId, candidaturaId, canEditDraft]
  );

  const onSelectCurso = async (cursoId: string) => {
    setSel((p) => ({ ...p, cursoId, turmaId: "" }));
    setCursoId(cursoId || null);
    await updateDraft({ curso_id: cursoId, classe_id: sel.classeId, turma_preferencial_id: "" });
  };

  const onSelectClasse = async (classeId: string) => {
    setSel((p) => ({ ...p, classeId, turmaId: "" }));
    setClasseId(classeId || null);
    await updateDraft({ curso_id: sel.cursoId, classe_id: classeId, turma_preferencial_id: "" });
  };

  const onSelectTurma = async (turmaId: string) => {
    setSel((p) => ({ ...p, turmaId }));
    setTurmaId(turmaId);
    await updateDraft({ curso_id: sel.cursoId, classe_id: sel.classeId, turma_preferencial_id: turmaId });
  };

  const canAdvance = safeUuid(sel.turmaId) && safeUuid(candidaturaId);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-klasse-green">Fit Acadêmico</h2>
          <p className="text-sm text-slate-500">Curso, classe e turma preferencial.</p>
        </div>

        <div className="flex items-center gap-2 text-sm">
          {saving ? (
            <span className="inline-flex items-center gap-2 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Salvando…
            </span>
          ) : null}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-red-700">Ocorreu um erro.</p>
              <p className="mt-1 break-words text-sm text-red-700/90">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <select
          value={sel.cursoId}
          onChange={(e) => void onSelectCurso(e.target.value)}
          disabled={loadingCfg || !safeUuid(candidaturaId) || !canEditDraft}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold disabled:opacity-60"
        >
          <option value="">Selecione o curso</option>
          {cursos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>

        <select
          value={sel.classeId}
          onChange={(e) => void onSelectClasse(e.target.value)}
          disabled={loadingCfg || !sel.cursoId || !safeUuid(candidaturaId) || !canEditDraft}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold disabled:opacity-60"
        >
          <option value="">Selecione a classe</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Turmas disponíveis</h3>
          {loadingVagas ? (
            <span className="inline-flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Carregando…
            </span>
          ) : null}
        </div>

        <div className="space-y-2">
          {turmas.map((t) => {
            const active = sel.turmaId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => void onSelectTurma(t.id)}
                disabled={!canEditDraft}
                className={[
                  "w-full rounded-xl border p-3 text-left text-sm transition",
                  active
                    ? "border-klasse-gold/60 bg-klasse-gold/10 ring-1 ring-klasse-gold/25"
                    : "border-slate-200 hover:border-klasse-gold/40",
                  !canEditDraft ? "cursor-not-allowed opacity-60" : "",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{t.nome}</p>
                    <p className="text-xs text-slate-500">{t.turno ? `Turno: ${t.turno}` : "Turno: —"}</p>
                  </div>
                  <div className="shrink-0 text-xs text-slate-600">
                    Vagas: {t.vagas_disponiveis ?? "—"}
                  </div>
                </div>
              </button>
            );
          })}
          {!loadingVagas && turmas.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma turma disponível para esta seleção.</p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
        >
          Voltar
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={!canAdvance}
          className="rounded-xl bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-60"
        >
          Avançar
        </button>
      </div>
    </div>
  );
}

/** =========================
 * Step 3: Pagamento / Conversão
 * ========================= */

function Step3Pagamento(props: {
  onBack: () => void;
  candidaturaId: string | null;
  turmaId: string | null;
  escolaId: string;
  cursoId: string | null;
  classeId: string | null;
  anoLetivo?: number | null;
  candidaturaStatus?: string | null;
}) {
  const {
    onBack,
    candidaturaId,
    turmaId,
    escolaId,
    cursoId,
    classeId,
    anoLetivo,
    candidaturaStatus,
  } = props;

  const [payment, setPayment] = useState({
    metodo_pagamento: "CASH",
    comprovativo_url: "",
    amount: "",
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [priceHint, setPriceHint] = useState<string | null>(null);

  useEffect(() => {
    if (!isUuid(escolaId) || !isUuid(cursoId) || !isUuid(classeId)) return;

    const controller = new AbortController();

    (async () => {
      try {
        const params = new URLSearchParams({
          escola_id: escolaId,
          curso_id: cursoId,
          classe_id: classeId,
        });

        if (anoLetivo) {
          params.set("ano", String(anoLetivo));
        }

        const res = await fetch(`/api/financeiro/orcamento/matricula?${params.toString()}`, {
          signal: controller.signal,
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) {
          setPriceHint(null);
          return;
        }

        const valorMatricula = Number(json?.data?.valor_matricula ?? 0);
        if (valorMatricula > 0) {
          setPriceHint(String(valorMatricula));
          if (!payment.amount) {
            setPayment((p) => ({ ...p, amount: String(valorMatricula) }));
          }
        } else {
          setPriceHint(null);
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setPriceHint(null);
      }
    })();

    return () => controller.abort();
  }, [escolaId, cursoId, classeId, anoLetivo, payment.amount]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPayment((p) => ({ ...p, [name]: value }));
  };

  const statusNormalized = String(candidaturaStatus ?? '').toLowerCase();

  const canSendToFinance = useMemo(() => {
    if (!isUuid(candidaturaId) || !isUuid(turmaId)) return false;
    if (['aprovada', 'aguardando_pagamento', 'matriculado'].includes(statusNormalized)) return false;
    return true;
  }, [candidaturaId, turmaId, statusNormalized]);

  const handleSendToFinance = async () => {
    if (!canSendToFinance) {
      setResult({ ok: false, error: "Candidatura ou turma inválida." });
      return;
    }

    setLoading(true);
    const payload = pickDefined({
      candidatura_id: candidaturaId,
      metodo_pagamento: payment.metodo_pagamento,
      comprovativo_url: payment.comprovativo_url,
      amount: payment.amount ? Number(payment.amount) : undefined,
    });

    const resp = await postJson<any>(
      "/api/secretaria/admissoes/approve",
      payload
    );

    setLoading(false);
    if (!resp.ok) return setResult({ ok: false, error: resp.error });
    setResult({ ok: true, message: "Enviado para validação do financeiro." });
  };

  const handleSaveForLater = async () => {
    if (!isUuid(candidaturaId)) {
      setResult({ ok: false, error: "Candidatura inválida." });
      return;
    }

    setLoading(true);
    const resp = await postJson<any>("/api/secretaria/admissoes/save_for_later", {
      candidatura_id: candidaturaId,
    });
    setLoading(false);

    if (!resp.ok) return setResult({ ok: false, error: resp.error });
    setResult(resp.data);
  };

  if (result) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-klasse-green">Resultado</h2>
        {result.ok ? (
          <p className="text-sm font-semibold text-klasse-green">
            {result.message || "Operação concluída com sucesso."}
          </p>
        ) : (
          <p className="text-sm font-semibold text-red-600">Erro: {result.error}</p>
        )}
        <pre className="rounded-xl bg-slate-100 p-4 text-xs">{JSON.stringify(result, null, 2)}</pre>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-klasse-green">Pagamento</h2>
        <p className="text-sm text-slate-500">Enviar para validação do financeiro.</p>
      </div>

      <div className="grid gap-3">
        <select
          name="metodo_pagamento"
          value={payment.metodo_pagamento}
          onChange={onChange}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
        >
          <option value="CASH">Dinheiro</option>
          <option value="TPA">TPA</option>
          <option value="TRANSFERENCIA">Transferência</option>
        </select>

        <input
          type="number"
          name="amount"
          value={payment.amount}
          onChange={onChange}
          placeholder="Valor"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
        />

        {priceHint ? (
          <p className="text-xs text-slate-500">
            Valor da matrícula configurado: <span className="font-semibold">{priceHint}</span>
          </p>
        ) : null}

        <input
          type="text"
          name="comprovativo_url"
          value={payment.comprovativo_url}
          onChange={onChange}
          placeholder="URL do comprovativo"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
        />
      </div>

      {statusNormalized === 'aguardando_pagamento' ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Pagamento aguardando compensação pelo financeiro. A matrícula será gerada após validação.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60"
        >
          Voltar
        </button>

        <button
          type="button"
          onClick={() => void handleSendToFinance()}
          disabled={loading || !canSendToFinance}
          className="rounded-xl bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-60"
        >
          {loading ? "Processando…" : "Enviar para Financeiro"}
        </button>

        <button
          type="button"
          onClick={() => void handleSaveForLater()}
          disabled={loading || !isUuid(candidaturaId)}
          className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? "Processando…" : "Salvar pré-inscrição"}
        </button>
      </div>
    </div>
  );
}

/** =========================
 * Wizard shell
 * ========================= */

export default function AdmissaoWizardClient({ escolaId }: { escolaId: string }) {
  const [step, setStep] = useState(1);
  const [candidaturaId, setCandidaturaId] = useState<string | null>(null);
  const [turmaId, setTurmaId] = useState<string | null>(null);
  const [cursoId, setCursoId] = useState<string | null>(null);
  const [classeId, setClasseId] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<any>(null);
  const [hydrated, setHydrated] = useState(false);
  const [canEditDraft, setCanEditDraft] = useState(true);

  const searchParams = useSearchParams();

  useEffect(() => {
    const candId = searchParams.get("candidaturaId");
    if (candId && isUuid(candId)) {
      setCandidaturaId(candId);

      (async () => {
        const res = await fetch(`/api/secretaria/admissoes/lead?id=${encodeURIComponent(candId)}`);
        const json = await res.json().catch(() => ({}));
        if (res.ok && json?.ok) {
          setInitialData(json.item ?? null);
          setCursoId(json.item?.curso_id ?? null);
          setClasseId(json.item?.classe_id ?? null);
          setTurmaId(json.item?.turma_preferencial_id ?? null);
          const status = String(json.item?.status ?? '').toLowerCase();
          setCanEditDraft(status === 'rascunho' || status === '');
        }
        setHydrated(true);
      })();
    } else {
      setCanEditDraft(true);
      setHydrated(true);
    }
  }, [searchParams]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-klasse-green">Nova Admissão</h1>
        <p className="text-sm text-slate-500">
          Fluxo rascunho → submetida → aprovada → aguardando_pagamento → matriculado.
        </p>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        {step === 1 ? (
          <Step1Identificacao
            onNext={() => setStep(2)}
            escolaId={escolaId}
            candidaturaId={candidaturaId}
            setCandidaturaId={setCandidaturaId}
            initialData={initialData}
            hydrated={hydrated}
            canEditDraft={canEditDraft}
          />
        ) : step === 2 ? (
          <Step2FitAcademico
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
            escolaId={escolaId}
            candidaturaId={candidaturaId}
            setTurmaId={setTurmaId}
            setCursoId={setCursoId}
            setClasseId={setClasseId}
            initialData={initialData}
            canEditDraft={canEditDraft}
          />
        ) : (
          <Step3Pagamento
            onBack={() => setStep(2)}
            candidaturaId={candidaturaId}
            turmaId={turmaId}
            escolaId={escolaId}
            cursoId={cursoId}
            classeId={classeId}
            anoLetivo={initialData?.ano_letivo ?? null}
            candidaturaStatus={initialData?.status ?? null}
          />
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, GraduationCap, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { EnrollmentPostAction } from "./EnrollmentPostActions";

type GradePeriodOption = {
  numero: number;
  data_inicio: string | null;
  data_fim: string | null;
  estado: "current" | "future" | "past" | "locked" | "unconfigured";
  calendar_verified: boolean;
  disciplina_ativa: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: EnrollmentPostAction | null;
  escolaId: string;
  alunoId: string;
  alunoNome: string;
  turmaId?: string | null;
  originAnoLetivoId?: string | null;
  onPayment: () => void;
  onAcademicSaved?: () => void;
};

export function EnrollmentPostActionModal({
  open, onOpenChange, action, escolaId, alunoId, alunoNome, turmaId, originAnoLetivoId, onPayment, onAcademicSaved,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ login?: string | null; senha?: string | null; error?: string } | null>(null);
  const [disciplinas, setDisciplinas] = useState<Array<{ id: string; disciplina?: { id?: string; nome?: string } | null }>>([]);
  const [disciplinaId, setDisciplinaId] = useState("");
  const [academicYearId, setAcademicYearId] = useState<string | null>(null);
  const [academicYearError, setAcademicYearError] = useState<string | null>(null);
  const [notaMaxima, setNotaMaxima] = useState<number | null>(null);
  const [notaContextError, setNotaContextError] = useState<string | null>(null);
  const [turmaDisciplinaId, setTurmaDisciplinaId] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [periodos, setPeriodos] = useState<GradePeriodOption[]>([]);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [periodError, setPeriodError] = useState<string | null>(null);
  const [periodReadOnly, setPeriodReadOnly] = useState(false);
  const [nota, setNota] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setResult(null);
      setShowPassword(false);
      setCopied(false);
    }
  }, [open, action]);

  // A ficha do aluno pode permanecer montada entre atendimentos. Nunca herdar
  // disciplina, nota ou trimestre de outra matrícula no mesmo modal.
  useEffect(() => {
    setPeriodo("");
    setPeriodos([]);
    setPeriodError(null);
    setPeriodReadOnly(false);
    setNota("");
    setDisciplinaId("");
    setTurmaDisciplinaId("");
    setNotaMaxima(null);
    setNotaContextError(null);
    setResult(null);
  }, [action, alunoId, escolaId, turmaId, originAnoLetivoId, open]);

  const title = action === "portal" ? "Liberar portal" : action === "notas" ? "Lançar nota" : "Pagar mensalidade";
  const Icon = action === "portal" ? KeyRound : action === "notas" ? GraduationCap : Wallet;

  useEffect(() => {
    let active = true;
    setAcademicYearId(null);
    setAcademicYearError(null);
    if (!open || action !== "notas") return () => { active = false; };
    // RAA edits belong to the enrolment of origin, not the currently selected
    // destination academic year. The WRITE endpoint still checks formal locks.
    if (originAnoLetivoId) {
      setAcademicYearId(originAnoLetivoId);
      return () => { active = false; };
    }

    void fetch("/api/academic-context", { cache: "no-store" })
      .then((response) => response.json().then((payload) => ({ response, payload })))
      .then(({ response, payload }) => {
        if (!active) return;
        if (
          !response.ok || !payload.ok
          || payload.context?.mode !== "CURRENT"
          || typeof payload.context?.anoLetivoId !== "string"
          || payload.context?.escolaId !== escolaId
        ) {
          setAcademicYearError(payload.error || "O ano letivo desta escola não permite lançamento de notas.");
          return;
        }
        setAcademicYearId(payload.context.anoLetivoId);
      })
      .catch(() => {
        if (active) setAcademicYearError("Não foi possível identificar o ano letivo ativo.");
      });
    return () => { active = false; };
  }, [action, escolaId, open, originAnoLetivoId]);

  useEffect(() => {
    let active = true;
    setPeriodo("");
    setPeriodos([]);
    setPeriodError(null);
    setPeriodReadOnly(false);
    setPeriodLoading(false);
    if (!open || action !== "notas" || !academicYearId || !turmaId) {
      return () => { active = false; };
    }
    setPeriodLoading(true);
    const query = new URLSearchParams({ ano_letivo_id: academicYearId, turma_id: turmaId });
    if (turmaDisciplinaId) query.set("turma_disciplina_id", turmaDisciplinaId);
    void fetch("/api/secretaria/notas/periodos?" + query.toString(), { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.ok || !Array.isArray(payload.items)) {
          throw new Error(payload.error || "Não foi possível identificar os trimestres deste ano.");
        }
        return payload;
      })
      .then((payload) => {
        if (!active) return;
        const items = payload.items as GradePeriodOption[];
        setPeriodos(items);
        setPeriodReadOnly(payload.read_only === true);
        const current = items.find((item) =>
          item.numero === payload.current_trimestre && item.estado === "current" && item.disciplina_ativa);
        setPeriodo(current ? String(current.numero) : "");
      })
      .catch((cause) => {
        if (active) setPeriodError(cause instanceof Error ? cause.message : "Não foi possível confirmar o período.");
      })
      .finally(() => { if (active) setPeriodLoading(false); });
    return () => { active = false; };
  }, [action, alunoId, academicYearId, open, turmaId, turmaDisciplinaId]);

  useEffect(() => {
    if (!open || action !== "notas" || !turmaId) return;
    setDisciplinas([]);
    setDisciplinaId("");
    fetch(`/api/secretaria/turmas/${encodeURIComponent(turmaId)}/disciplinas`, { cache: "no-store" })
      .then((response) => response.json())
      .then((json) => setDisciplinas(Array.isArray(json?.items) ? json.items : []))
      .catch(() => setDisciplinas([]));
  }, [open, action, turmaId]);

  useEffect(() => {
    let active = true;
    setNotaMaxima(null);
    setNotaContextError(null);
    if (!open || action !== "notas" || !academicYearId || !turmaId || !disciplinaId || !turmaDisciplinaId || !periodo) {
      return () => { active = false; };
    }

    const params = new URLSearchParams({
      disciplinaId,
      turmaDisciplinaId,
      trimestre: periodo,
      anoLetivoId: academicYearId,
      alunoId,
    });
    void fetch("/api/secretaria/turmas/" + encodeURIComponent(turmaId) + "/pauta-grid?" + params.toString(), {
      cache: "no-store",
    })
      .then((response) => response.json().then((payload) => ({ response, payload })))
      .then(({ response, payload }) => {
        if (!active) return;
        if (!response.ok || !payload.ok || !Array.isArray(payload.items)) {
          throw new Error(payload.error || "Não foi possível confirmar a pauta deste aluno.");
        }
        if (!payload.items.some((row: { aluno_id?: string }) => row.aluno_id === alunoId)) {
          throw new Error("Este aluno não pertence à pauta da turma selecionada.");
        }
        const max = payload.meta?.nota_maxima;
        if (typeof max !== "number" || !Number.isFinite(max) || max <= 0) {
          throw new Error("Esta turma não possui escala quantitativa para lançamento.");
        }
        setNotaMaxima(max);
      })
      .catch((error) => {
        if (active) setNotaContextError(error instanceof Error ? error.message : "Não foi possível confirmar a pauta.");
      });
    return () => { active = false; };
  }, [action, academicYearId, alunoId, disciplinaId, open, periodo, turmaDisciplinaId, turmaId]);

  const lancarNota = async () => {
    const selected = disciplinas.find((item) => item.disciplina?.id === disciplinaId);
    const selectedPeriod = periodos.find((item) => String(item.numero) === periodo);
    if (!turmaId || !selected?.disciplina?.id || !selected.id || !nota || !academicYearId || notaMaxima === null ||
      !selectedPeriod || !selectedPeriod.disciplina_ativa || periodReadOnly || ["future", "unconfigured"].includes(selectedPeriod.estado)) {
      setResult({ error: "Selecione um trimestre válido para esta matrícula." });
      return;
    }
    const valor = Number(nota);
    if (!Number.isFinite(valor) || valor < 0 || valor > notaMaxima) {
      setResult({ error: "A nota deve estar dentro da escala da turma." });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/secretaria/notas", {
        method: "POST",
        headers: { "Content-Type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({
          turma_id: turmaId,
          ano_letivo_id: academicYearId,
          disciplina_id: selected.disciplina.id,
          turma_disciplina_id: selected.id,
          trimestre: Number(periodo),
          notas: [{ aluno_id: alunoId, valor }],
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Não foi possível lançar a nota.");
      setResult({ login: "Nota lançada", senha: null });
      onAcademicSaved?.();
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : "Não foi possível lançar a nota." });
    } finally {
      setLoading(false);
    }
  };

  const selectedPeriod = periodos.find((item) => String(item.numero) === periodo);
  const periodUnavailable = periodLoading || Boolean(periodError) || periodReadOnly ||
    !selectedPeriod || !selectedPeriod.disciplina_ativa || ["future", "unconfigured"].includes(selectedPeriod.estado);

  const liberarPortal = async () => {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/secretaria/alunos/liberar-acesso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escolaId, alunoIds: [alunoId], canal: "whatsapp", gerarCredenciais: true }),
      });
      const json = await response.json().catch(() => ({}));
      const detail = Array.isArray(json?.detalhes) ? json.detalhes[0] : null;
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Não foi possível liberar o portal.");
      setResult({ login: detail?.login ?? null, senha: detail?.senha ?? null });
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : "Não foi possível liberar o portal." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!loading) onOpenChange(next); }}>
      <DialogContent className="max-w-xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900"><Icon className="h-5 w-5 text-[#1F6B3B]" />{title}</DialogTitle>
          <DialogDescription>{alunoNome} · atendimento continua nesta ficha.</DialogDescription>
        </DialogHeader>

        {action === "portal" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Gere as credenciais agora e entregue-as ao encarregado.</p>
            {result?.error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{result.error}</p>}
            {result?.login ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-800"><CheckCircle2 className="h-4 w-4" /> Portal liberado</div>
                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div><span className="block text-xs text-emerald-700/70">Login</span><strong>{result.login}</strong></div>
                  <div><span className="block text-xs text-emerald-700/70">Senha temporária</span><strong>{result.senha ? (showPassword ? result.senha : "••••••••") : "Enviada por canal configurado"}</strong></div>
                </div>
                {result.senha && <div className="mt-3 flex gap-2"><button type="button" onClick={() => setShowPassword((value) => !value)} className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-800">{showPassword ? "Ocultar senha" : "Mostrar senha"}</button><button type="button" onClick={() => { void navigator.clipboard.writeText(`Login: ${result.login}\nSenha: ${result.senha}`); setCopied(true); setTimeout(() => setCopied(false), 1800); }} className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-800">{copied ? "Copiado" : "Copiar credenciais"}</button></div>}
              </div>
            ) : (
              <button type="button" onClick={() => void liberarPortal()} disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1F6B3B] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} {loading ? "A gerar credenciais…" : "Liberar portal agora"}
              </button>
            )}
          </div>
        )}

        {action === "notas" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Lançar nota na turma e no ano letivo da matrícula de origem de {alunoNome}.</p>
            {!turmaId && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700">A turma desta matrícula não foi identificada.</p>}
            {academicYearError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{academicYearError}</p>}
            {notaContextError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{notaContextError}</p>}
            {!academicYearId && !academicYearError && <p className="text-xs text-slate-500">A confirmar o ano letivo ativo...</p>}
            <select value={disciplinaId} onChange={(event) => { setDisciplinaId(event.target.value); setTurmaDisciplinaId(disciplinas.find((item) => item.disciplina?.id === event.target.value)?.id ?? ""); setNota(""); setResult(null); }} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" disabled={!turmaId || loading}>
              <option value="">Selecionar disciplina</option>
              {disciplinas.map((item) => <option key={item.id} value={item.disciplina?.id ?? ""}>{item.disciplina?.nome ?? "Disciplina"}</option>)}
            </select>
            {periodLoading && <p role="status" className="text-xs text-muted-foreground">A confirmar o trimestre da matrícula...</p>}
            {periodError && <p role="alert" className="text-sm text-red-700">{periodError}</p>}
            {periodReadOnly && <p role="status" className="text-xs text-muted-foreground">Este ano letivo está encerrado. Consulte a direção para reabertura.</p>}
            <div className="grid grid-cols-2 gap-3">
              <select aria-label="Trimestre da matrícula de origem" value={periodo}
                onChange={(event) => { setPeriodo(event.target.value); setNota(""); setResult(null); }}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
                disabled={loading || periodLoading || Boolean(periodError) || periodReadOnly}>
                <option value="">Selecionar trimestre</option>
                {periodos.map((item) => <option key={item.numero} value={String(item.numero)}
                  disabled={!item.disciplina_ativa || item.estado === "future" || item.estado === "unconfigured"}>
                  {item.numero}.º período{!item.disciplina_ativa ? " · não lecionada" :
                    item.estado === "current" ? " · atual" :
                    item.estado === "future" ? " · ainda não iniciado" :
                    item.estado === "locked" ? " · encerrado" : ""}
                </option>)}
              </select>
              <input type="number" min="0" max={notaMaxima ?? 20} step="0.1" value={nota} onChange={(event) => setNota(event.target.value)} placeholder="Nota" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" disabled={loading} />
            </div>
            {selectedPeriod && ["past", "locked"].includes(selectedPeriod.estado) &&
              <p role="status" className="text-xs text-muted-foreground">Este período exige autorização de reabertura para correções.</p>}
            {result?.error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{result.error}</p>}
            {result?.login === "Nota lançada" ? <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800"><CheckCircle2 className="h-4 w-4" /> Nota lançada com sucesso.</p> : <button type="button" onClick={() => void lancarNota()} disabled={loading || periodUnavailable || !turmaId || !academicYearId || Boolean(academicYearError) || Boolean(notaContextError) || notaMaxima === null || !disciplinaId || !turmaDisciplinaId || !nota} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1F6B3B] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{loading && <Loader2 className="h-4 w-4 animate-spin" />} Lançar nota</button>}
          </div>
        )}

        {action === "mensalidade" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">O pagamento será aberto mantendo o aluno e o atendimento em contexto.</p>
            <button type="button" onClick={onPayment} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E3B23C] px-4 py-3 text-sm font-bold text-slate-950">Adicionar ao pagamento do balcão</button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

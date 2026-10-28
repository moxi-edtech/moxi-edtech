"use client";

import { useCallback, useState } from "react";
import { CalendarClock, CheckCircle2, Loader2, RefreshCw, X } from "lucide-react";

type Janela = {
  id: string;
  ano_letivo: number;
  data_inicio: string;
  data_fim: string;
  ativa: boolean;
  observacao: string | null;
  updated_at: string;
};

type Props = {
  anoLetivo: { id: string; ano: number; label: string };
  onRecheck: () => Promise<unknown>;
};

// Angola does not observe daylight saving time: local times use UTC+01:00.
function luandaInput(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Luanda",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
}

function toUtcFromLuanda(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("Data final inválida.");
  const date = new Date(`${value}:00+01:00`);
  if (!Number.isFinite(date.getTime())) throw new Error("Data final inválida.");
  return date.toISOString();
}

function formatLuanda(value: string) {
  return new Intl.DateTimeFormat("pt-AO", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Luanda",
  }).format(new Date(value));
}

/**
 * Small, in-place, permission-gated operational recovery. Does not touch the
 * selected student, the cart, the rematricula modal, notes, or any payment.
 */
export function RematriculaWindowRecovery({ anoLetivo, onRecheck }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [canReopen, setCanReopen] = useState(false);
  const [janela, setJanela] = useState<Janela | null>(null);
  const [dataFim, setDataFim] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/secretaria/rematricula/janelas", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Não foi possível consultar a janela.");
      const rows = (Array.isArray(data.items) ? data.items : []) as Janela[];
      const sameYear = rows.filter((row) => row.ano_letivo === anoLetivo.ano);
      // A janela ativa do ano tem prioridade; caso contrário, recupera a mais recente.
      const target = sameYear.find((row) => row.ativa) ?? sameYear[0] ?? null;
      setJanela(target);
      setCanReopen(data.can_reopen === true);
      const defaultEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      setDataFim(luandaInput(defaultEnd));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao consultar a janela.");
    } finally {
      setLoading(false);
    }
  }, [anoLetivo.ano]);

  const save = async () => {
    if (!canReopen || saving || motivo.trim().length < 10) return;
    setError(null);
    try {
      const endIso = toUtcFromLuanda(dataFim);
      if (new Date(endIso).getTime() <= Date.now()) throw new Error("A nova data final deve estar no futuro.");
      if (!window.confirm(
        `Abrir a rematrícula ${anoLetivo.label} para toda a escola até ${formatLuanda(endIso)}? Esta decisão também afeta o portal do aluno.`,
      )) return;

      setSaving(true);
      const now = new Date().toISOString();
      const firstStart = janela ? new Date(janela.data_inicio).getTime() : null;
      const startIso = firstStart !== null && firstStart <= Date.now() ? janela!.data_inicio : now;
      const observation = `Reabertura pelo Balcão: ${motivo.trim()}`.slice(0, 500);
      const payload = janela ? {
        id: janela.id,
        ano_letivo_id: anoLetivo.id,
        expected_updated_at: new Date(janela.updated_at).toISOString(),
        balcao_reopen: true,
        data_inicio: startIso,
        data_fim: endIso,
        ativa: true,
        observacao: observation,
      } : {
        ano_letivo: anoLetivo.ano,
        ano_letivo_id: anoLetivo.id,
        balcao_reopen: true,
        data_inicio: startIso,
        data_fim: endIso,
        ativa: true,
        observacao: observation,
      };
      const response = await fetch("/api/secretaria/rematricula/janelas", {
        method: janela ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Não foi possível reabrir a janela.");
      setDone(true);
      setJanela(data.item ?? null);
      await onRecheck();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao reabrir a janela.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 space-y-3">
      {!open ? (
        <button
          type="button"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-3 py-2.5 text-xs font-bold text-background transition-opacity hover:opacity-85"
          onClick={() => { setOpen(true); setDone(false); void load(); }}
        >
          <CalendarClock className="h-4 w-4" />
          Resolver período de rematrícula
        </button>
      ) : (
        <section className="rounded-xl border border-border bg-card p-4 text-foreground" aria-label="Resolver janela de rematrícula">
          <div className="flex items-start justify-between gap-3">
            <div>
              <strong className="text-sm">Janela de rematrícula · {anoLetivo.label}</strong>
              <p className="mt-1 text-xs text-muted-foreground">Sem sair do atendimento e sem modificar o aluno selecionado.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fechar resolução da janela" className="rounded-lg border border-border p-1.5"><X className="h-4 w-4" /></button>
          </div>
          {loading ? <p className="mt-3 flex items-center gap-2 text-xs"><Loader2 className="h-4 w-4 animate-spin" /> A verificar permissões e datas…</p> : done ? (
            <div className="mt-3 space-y-2 text-sm">
              <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" /> Janela reaberta. O estado da rematrícula foi atualizado.</p>
              <button type="button" onClick={() => {setOpen(false); void onRecheck();}} className="rounded-lg border border-border px-3 py-2 text-xs font-bold">Continuar atendimento</button>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-muted-foreground">
                {janela ? `Último período: ${formatLuanda(janela.data_inicio)} até ${formatLuanda(janela.data_fim)} · ${janela.ativa ? "Ativa, fora do prazo" : "Desativada"}.` : "Nenhuma janela configurada para este ano."}
              </p>
              {!canReopen ? (
                <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
                  A reabertura afeta a escola inteira. Solicite à direção ou à administração que autorize a mudança neste mesmo atendimento.
                </p>
              ) : (
                <>
                  <div>
                    <label htmlFor="balcao-window-end" className="mb-1 block text-xs font-semibold">Aberta até (hora de Luanda)</label>
                    <input id="balcao-window-end" type="datetime-local" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                  </div>
                  <div>
                    <label htmlFor="balcao-window-reason" className="mb-1 block text-xs font-semibold">Motivo da reabertura</label>
                    <textarea id="balcao-window-reason" rows={2} maxLength={450} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: Período excepcional autorizado pela direção" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">A reabertura vale para toda a escola e para o portal do aluno. A elegibilidade académica e financeira continua obrigatória.</p>
                  <button type="button" onClick={() => void save()} disabled={saving || motivo.trim().length < 10 || !dataFim} className="inline-flex w-full justify-center gap-2 rounded-lg bg-foreground px-3 py-2.5 text-xs font-bold text-background disabled:opacity-50">
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {janela ? "Confirmar reabertura" : "Confirmar abertura"}
                  </button>
                </>
              )}
              <button type="button" onClick={() => void load()} disabled={loading || saving} className="inline-flex items-center gap-2 text-xs font-semibold underline underline-offset-4"><RefreshCw className="h-3 w-3" /> Atualizar situação</button>
            </div>
          )}
          {error && <p role="alert" className="mt-3 rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900">{error}</p>}
        </section>
      )}
    </div>
  );
}

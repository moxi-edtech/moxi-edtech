"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, FileSpreadsheet, Loader2, RefreshCw } from "lucide-react";

type Preview = {
  ok: true;
  ano: number;
  total: number;
  elegiveis: number;
  sincronizadas: number;
  historico_aberto: number;
  documento_ano_divergente: number;
  inconsistencias: number;
};
type Chunk = { ok: true; criadas: number; restantes: number };
const API = "/api/secretaria/operacoes-academicas/sincronizar-notas-finais";
const MAX_LOTES = 80; // 80 x 80 > 3.830 source grades, with headroom.
async function request(url: string, body?: object) {
  const response = await fetch(url, body ? {
    method: "POST", cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  } : { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok !== true) throw new Error(data.error || "Não foi possível consultar a sincronização.");
  return data;
}

/** One-click safe mirror of the real historical final (never MAC/NPP/NPT). */
export function CurtumeSincronizarNotasFinais({ onComplete }: { onComplete?: () => void } = {}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const mounted = useRef(true);
  const running = useRef(false);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const output = await request(API) as Preview;
      if (mounted.current) { setPreview(output); setForbidden(false); }
    } catch (cause) {
      if (mounted.current) {
        const message = cause instanceof Error ? cause.message : "Falha na consulta.";
        if (/permissão|apenas para|sessão inválida/i.test(message)) setForbidden(true);
        else setError(message);
      }
    } finally { if (mounted.current) setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function synchronize() {
    if (running.current || loading || !preview?.elegiveis) return;
    running.current = true; setSaving(true); setError(""); setNotice(""); setCreated(0);
    let sum = 0;
    try {
      let finished = false;
      for (let i = 0; i < MAX_LOTES; i++) {
        const chunk = await request(API, {
          acao: "sincronizar_finais_2025", limite: 80,
        }) as Chunk;
        if (!Number.isInteger(chunk.criadas) || !Number.isInteger(chunk.restantes)
            || chunk.criadas < 0 || chunk.criadas > 80 || chunk.restantes < 0)
          throw new Error("Contagem inconsistente. Recarregue o relatório para continuar.");
        sum += chunk.criadas;
        if (mounted.current) setCreated(sum);
        if (chunk.restantes === 0) { finished = true; break; }
        if (chunk.criadas === 0)
          throw new Error("Nenhum registo avançou. Confira os conflitos apresentados antes de tentar novamente.");
      }
      if (!finished) throw new Error("O limite de lotes foi atingido. Reabra esta operação para continuar.");
      if (mounted.current) setNotice(`${sum} notas finais sincronizadas. Nenhuma avaliação trimestral foi inventada.`);
      onComplete?.();
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "O processamento não foi concluído.");
    } finally {
      running.current = false;
      if (mounted.current) {
        setSaving(false);
        // A leitura canónica é a verdade após qualquer falha de rede.
        void refresh();
      }
    }
  }
  if (forbidden) return null;
  return <section aria-label="Sincronizar notas finais do Curtume"
    className="space-y-3 rounded-xl border border-border bg-card p-4 text-sm shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-start gap-3">
        <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-emerald" aria-hidden="true" />
        <div className="space-y-1">
          <h2 className="font-sora font-semibold text-emerald">Notas finais · 2025/2026</h2>
          <p className="text-xs text-muted-foreground">
            Copiar a nota final de cada disciplina do histórico oficial para as notas operacionais.
            Não cria avaliações trimestrais e não altera o resultado ratificado.
          </p>
        </div>
      </div>
      <button type="button" onClick={() => void refresh()} disabled={saving || loading}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50">
        <RefreshCw size={16} /> Atualizar
      </button>
    </div>
    {loading && !preview && <p role="status" className="flex items-center gap-2 text-muted-foreground"><Loader2 size={16} className="animate-spin" />A verificar pautas…</p>}
    {preview && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div><strong className="block font-sora text-lg tabular-nums">{preview.elegiveis}</strong><span className="text-xs text-muted-foreground">Por sincronizar</span></div>
      <div><strong className="block font-sora text-lg tabular-nums">{preview.sincronizadas}</strong><span className="text-xs text-muted-foreground">Sincronizadas</span></div>
      <div><strong className="block font-sora text-lg tabular-nums">{preview.documento_ano_divergente}</strong><span className="text-xs text-muted-foreground">Conferir ano da pauta</span></div>
      <div><strong className="block font-sora text-lg tabular-nums">{preview.historico_aberto + preview.inconsistencias}</strong><span className="text-xs text-muted-foreground">Requerem regularização</span></div>
    </div>}
    {preview && (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-xs text-muted-foreground">
          Pautas com referência a 2023/2024 e históricos ainda abertos não são alterados. Use a reconciliação existente para esses casos.
        </p>
        <button type="button" disabled={saving || loading || preview.elegiveis===0}
          onClick={() => void synchronize()}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber px-4 py-2 font-semibold text-white hover:brightness-95 disabled:opacity-50">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          {saving ? `A sincronizar · ${created} notas` : preview.elegiveis ? "Sincronizar notas finais" : "Tudo sincronizado"}
        </button>
      </div>
    )}
    {error && <p role="alert" className="text-xs font-medium text-red-600">{error}</p>}
    {notice && <p role="status" className="text-xs font-medium text-emerald">{notice}</p>}
  </section>;
}

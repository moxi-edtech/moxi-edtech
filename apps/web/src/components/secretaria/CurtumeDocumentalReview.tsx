"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, FileCheck2, FileWarning, Loader2, RefreshCw } from "lucide-react";

type Line = {
  nome: string; numero_processo: string | null;
  turma: string | null; disciplina: string | null;
  nota: number; linha: string | null; conferida: boolean;
};
type Document = {
  arquivo: string; linhas: number; alunos: number; conferidas: number;
  digest: string; detalhes: Line[];
};
type Preview = { ok: true; ano: 2025; documentos: Document[] };
type Chunk = { ok: true; criadas: number; restantes: number };
const ENDPOINT = "/api/secretaria/operacoes-academicas/notas-finais-2025/documentos";
const MAX_CHUNKS = 12; // 12 x 80 covers current 464 lines; fail closed on no progress.

async function request(url: string, body?: Record<string, unknown>, signal?: AbortSignal) {
  const response = await fetch(url, body ? {
    method: "POST", cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), signal,
  } : { cache: "no-store", signal });
  const value: unknown = await response.json().catch(() => null);
  if (!response.ok || !value || typeof value !== "object" ||
      !("ok" in value) || value.ok !== true) {
    const error = value && typeof value === "object" && "error" in value
      ? String(value.error) : "Não foi possível concluir a operação.";
    throw new Error(error);
  }
  return value;
}

export function CurtumeDocumentalReview({
  escola, onComplete,
}: { escola: string; onComplete?: () => void }) {
  const [data, setData] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [progress, setProgress] = useState(0);
  const [unavailable, setUnavailable] = useState(false);
  const running = useRef(false);
  const requestSeq = useRef(0);

  const refresh = useCallback(async (controller?: AbortController) => {
    const sequence = ++requestSeq.current;
    setLoading(true);
    setUnavailable(false);
    try {
      // A new release can reach the frontend before its versioned DB migration.
      // Keep the editor hidden until its canonical, privileged RPC is installed.
      const probe = await fetch(`${ENDPOINT}?escola=${encodeURIComponent(escola)}`, {
        cache: "no-store", signal: controller?.signal,
      });
      if (probe.status === 424) {
        if (sequence === requestSeq.current) setUnavailable(true);
        return;
      }
      const json: unknown = await probe.json().catch(() => null);
      if (!probe.ok || !json || typeof json !== "object" || !("ok" in json) || json.ok !== true) {
        const error = json && typeof json === "object" && "error" in json
          ? String(json.error) : "Não foi possível consultar as pautas.";
        throw new Error(error);
      }
      const value = json as Preview;
      if (sequence !== requestSeq.current) return;
      setData(value);
      setError("");
      setSelected((current) => current && !value.documentos.some((doc) => doc.arquivo === current) ? null : current);
    } catch (cause) {
      if (controller?.signal.aborted || sequence !== requestSeq.current) return;
      setError(cause instanceof Error ? cause.message : "Falha na consulta.");
    } finally {
      if (sequence === requestSeq.current && !controller?.signal.aborted) setLoading(false);
    }
  }, [escola]);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller);
    return () => { controller.abort(); requestSeq.current += 1; };
  }, [refresh]);

  function openDocument(arquivo: string) {
    if (busy) return;
    setSelected((current) => current === arquivo ? null : arquivo);
    setReference(""); setReason(""); setConfirmed(false); setError(""); setNotice("");
  }

  async function confirmDocument(doc: Document) {
    if (running.current || busy || !confirmed ||
        reference.trim().length < 8 || reason.trim().length < 12) return;
    running.current = true;
    setBusy(true); setError(""); setNotice(""); setProgress(0);
    try {
      await request(ENDPOINT, {
        acao: "conferir_pauta", escola,
        arquivo: doc.arquivo, digest: doc.digest,
        referencia: reference.trim(), motivo: reason.trim(),
        confirmacao: "CONFIRMO_PAUTA_2025_2026",
      });
      let total = 0;
      let finished = false;
      // The existing HIST_FINAL RPC is idempotent. Do not create a competing writer.
      for (let i = 0; i < MAX_CHUNKS; i++) {
        const part = await request(ENDPOINT, {
          acao: "sincronizar_notas", escola, limite: 80,
        }) as Chunk;
        if (!Number.isInteger(part.criadas) || !Number.isInteger(part.restantes) ||
            part.criadas < 0 || part.criadas > 80 || part.restantes < 0) {
          throw new Error("O lote não devolveu contagens válidas. Atualize o estado.");
        }
        total += part.criadas;
        setProgress(total);
        if (part.restantes === 0) { finished = true; break; }
        if (part.criadas === 0) {
          throw new Error("Há notas que exigem conferência adicional. Consulte as pendências.");
        }
      }
      if (!finished) {
        throw new Error("O limite de processamento foi atingido. Atualize para continuar.");
      }
      setNotice(`Pauta conferida e ${total} notas finais sincronizadas com registo de auditoria.`);
      setSelected(null); setConfirmed(false); setReference(""); setReason("");
      onComplete?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "A operação não foi concluída.");
    } finally {
      running.current = false;
      setBusy(false);
      // Network failure may follow a successful DB commit; re-read the source of truth.
      await refresh();
    }
  }

  if (unavailable) return null;

  if (!data && loading) {
    return <section aria-label="Pautas documentais por conferir"
      className="rounded-xl border border-border bg-card p-4 text-sm">
      <p role="status" className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        A consultar as pautas originais…
      </p>
    </section>;
  }

  return (
    <section aria-label="Resolver divergências documentais"
      className="space-y-4 rounded-xl border border-border bg-card p-4 text-sm shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-sora font-semibold text-emerald">Conferência das pautas · 2025/2026</h2>
          <p className="max-w-2xl text-xs text-muted-foreground">
            Corrija a divergência do ano com uma confirmação por documento.
            Verifique a pauta original, os alunos e as classificações.
            Nenhum resultado é inventado ou alterado.
          </p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading || busy}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold disabled:opacity-50">
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Atualizar
        </button>
      </div>
      {data?.documentos.length === 0 && (
        <p className="flex items-center gap-2 text-xs text-emerald" role="status">
          <Check className="h-4 w-4" aria-hidden="true" />
          Não há pautas com divergência documental elegíveis para este procedimento.
        </p>
      )}
      {data?.documentos.map((doc) => {
        const expanded = selected === doc.arquivo;
        return (
          <div key={doc.arquivo} className="rounded-xl border border-border bg-background">
            <button type="button" disabled={busy}
              onClick={() => openDocument(doc.arquivo)} aria-expanded={expanded}
              className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left disabled:opacity-60">
              <span className="flex min-w-0 items-start gap-2">
                {doc.conferidas === doc.linhas
                  ? <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald" aria-hidden="true" />
                  : <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber" aria-hidden="true" />}
                <span className="min-w-0 space-y-1">
                  <span className="block break-words font-semibold text-foreground">{doc.arquivo}</span>
                  <span className="block text-xs text-muted-foreground">
                    {doc.alunos} alunos · {doc.linhas} notas finais · {doc.conferidas} linhas já conferidas
                  </span>
                </span>
              </span>
              {expanded ? <ChevronUp className="h-4 w-4 shrink-0" aria-hidden="true" />
                : <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />}
            </button>
            {expanded && (
              <div className="space-y-4 border-t border-border px-4 py-4">
                <p className="text-xs text-muted-foreground">
                  Compare estas linhas com a pauta oficial. O título menciona 2023/2024,
                  mas o histórico importado está associado a 2025/2026.
                  A escola deve confirmar qual é o ano verdadeiro, não apenas aceitar a sugestão.
                </p>
                <div className="max-h-80 overflow-auto rounded-xl border border-border">
                  <table className="w-full min-w-[620px] text-left text-xs">
                    <thead className="sticky top-0 bg-card text-muted-foreground">
                      <tr>
                        <th scope="col" className="p-3 font-semibold">Aluno / processo</th>
                        <th scope="col" className="p-3 font-semibold">Disciplina</th>
                        <th scope="col" className="p-3 font-semibold">Linha da pauta</th>
                        <th scope="col" className="p-3 text-right font-semibold">Nota final</th>
                      </tr>
                    </thead>
                    <tbody>
                      {doc.detalhes.map((item, index) => (
                        <tr key={`${item.numero_processo ?? item.nome}-${item.disciplina}-${index}`}
                          className="border-t border-border">
                          <td className="p-3">
                            <span className="block font-medium">{item.nome}</span>
                            <span className="text-muted-foreground">{item.numero_processo ?? item.turma ?? "—"}</span>
                          </td>
                          <td className="p-3">{item.disciplina ?? "Disciplina da pauta"}</td>
                          <td className="p-3">{item.linha ?? "—"}</td>
                          <td className="p-3 text-right font-semibold tabular-nums">{item.nota}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 text-xs font-semibold">
                    Referência do documento original
                    <input type="text" maxLength={180} value={reference}
                      disabled={busy} onChange={(event) => setReference(event.target.value)}
                      placeholder="Ex.: Pauta assinada pela Direção, folha 3"
                      className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm font-normal"/>
                  </label>
                  <label className="space-y-1 text-xs font-semibold">
                    Motivo da conferência
                    <textarea maxLength={500} rows={2} value={reason}
                      disabled={busy} onChange={(event) => setReason(event.target.value)}
                      placeholder="Confirme por que esta pauta corresponde a 2025/2026"
                      className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm font-normal"/>
                  </label>
                </div>
                <label className="flex items-start gap-2 text-xs text-foreground">
                  <input type="checkbox" checked={confirmed} disabled={busy}
                    onChange={(event) => setConfirmed(event.target.checked)}
                    className="mt-0.5 accent-amber"/>
                  <span>Conferi o documento físico e as linhas acima. Confirmo que a pauta corresponde
                    a 2025/2026, com esta referência, assumindo a responsabilidade institucional.
                  </span>
                </label>
                <button type="button" onClick={() => void confirmDocument(doc)}
                  disabled={busy || !confirmed || reference.trim().length < 8 || reason.trim().length < 12}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber px-4 py-2 font-semibold text-white hover:brightness-95 disabled:opacity-50">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    : <FileCheck2 className="h-4 w-4" aria-hidden="true" />}
                  {busy ? `A sincronizar · ${progress} notas` : "Conferir pauta e sincronizar notas"}
                </button>
              </div>
            )}
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">
        Históricos ainda abertos continuam em <a href="#curtume-historicos-por-fechar"
          className="font-semibold text-emerald underline-offset-2 hover:underline">Históricos por fechar</a>.
        Pautas não comprovadas permanecem pendentes; não há aprovação automática.
      </p>
      {notice && <p role="status" className="text-xs font-medium text-emerald">{notice}</p>}
      {error && <p role="alert" className="text-xs font-medium text-red-600">{error}</p>}
    </section>
  );
}

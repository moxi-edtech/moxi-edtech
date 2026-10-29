"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import type { RematriculaCardState } from "@/hooks/useRematriculaBalcao";
import { raaBalcaoPlan } from "@/lib/rematricula/raa-balcao-resolution";

type PeticaoFalta = { id: string; data_falta: string; motivo: string; status: string };
type PedidoReapreciacao = {
  id: string; protocolo_publico: string; estado: string; disciplina_id: string;
  motivo: string; prazo_em: string; decisao_motivo?: string | null;
};
type EventoDisciplinar = {
  id: string; categoria: string; descricao: string; gravidade: string;
  estado: string; impacta_resultado: boolean;
};
type Academic = { reason?: string; disciplina_ids_pendentes?: string[] } | null;

type Props = {
  status: RematriculaCardState | "CHECKING" | null;
  matriculaId: string;
  alunoId: string;
  academic: Academic;
  onLancarNota: () => void;
  onDocumentos: () => void;
  onRecheck: () => Promise<unknown>;
};

async function readJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { cache: "no-store", ...init });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok !== true) throw new Error(json.error || "Não foi possível concluir a operação.");
  return json;
}

/**
 * Resolves the blocker inside the existing student workspace. All mutations
 * are delegated to authoritative endpoints with independent role/tenant checks.
 * A saved request/decision never becomes an implicit authorization to enroll.
 */
export function RaaBalcaoResolutionPanel({
  status, matriculaId, alunoId, academic, onLancarNota, onDocumentos, onRecheck,
}: Props) {
  const plan = raaBalcaoPlan(status);
  const action = plan?.acao;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [faltas, setFaltas] = useState<PeticaoFalta[]>([]);
  const [pedidos, setPedidos] = useState<PedidoReapreciacao[]>([]);
  const [eventos, setEventos] = useState<EventoDisciplinar[]>([]);
  const [selected, setSelected] = useState("");
  const [decision, setDecision] = useState("");
  const [motivo, setMotivo] = useState("");
  const [disciplinaId, setDisciplinaId] = useState("");

  const load = useCallback(async () => {
    if (!action || !matriculaId || !open) return;
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ matricula_id: matriculaId }).toString();
      if (action === "justificacao") {
        const response = await readJson("/api/secretaria/faltas/justificacoes?" + query);
        setFaltas(Array.isArray(response.items) ? response.items : []);
      } else if (action === "reapreciacao") {
        const response = await readJson("/api/academico/raa/reapreciacao?" + query);
        setPedidos(Array.isArray(response.items) ? response.items : []);
      } else if (action === "disciplina") {
        const response = await readJson("/api/academico/raa/indisciplina?" + query);
        setEventos(Array.isArray(response.items) ? response.items : []);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível consultar a análise.");
    } finally {
      setLoading(false);
    }
  }, [action, matriculaId, open]);

  useEffect(() => { void load(); }, [load]);

  if (!plan || !matriculaId) return null;

  const submit = async () => {
    if (saving || !selected || motivo.trim().length < 5) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      if (action === "justificacao") {
        if (!["approved", "rejected"].includes(decision)) {
          throw new Error("Selecione aprovar ou rejeitar a justificação.");
        }
        if (decision === "rejected" && motivo.trim().length < 8) {
          throw new Error("Explique a rejeição com pelo menos 8 caracteres.");
        }
        const json = await readJson("/api/secretaria/faltas/justificacoes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: selected, decision, motivo: motivo.trim() }),
        });
        setNotice(json.message || "Decisão registada. Reavalie a frequência e o RAA.");
      } else if (action === "reapreciacao") {
        if (!["em_analise", "deferido", "indeferido"].includes(decision)) {
          throw new Error("Selecione uma decisão válida.");
        }
        const json = await readJson("/api/academico/raa/reapreciacao/decisao", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: selected, estado: decision, decisao_motivo: motivo.trim() }),
        });
        setNotice("Pedido " + (json.item?.protocolo_publico || "RAA") +
          " atualizado. A nota e a progressão oficial devem ser recalculadas antes da matrícula.");
      } else if (action === "disciplina") {
        if (!["em_analise", "resolvido", "cancelado"].includes(decision)) {
          throw new Error("Selecione o estado da revisão disciplinar.");
        }
        if (motivo.trim().length < 15) {
          throw new Error("Fundamente a decisão com pelo menos 15 caracteres.");
        }
        await readJson("/api/academico/raa/indisciplina", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: selected, estado: decision, motivo: motivo.trim(),
            confirmar_decisao: decision !== "em_analise",
          }),
        });
        setNotice("Revisão disciplinar registada. Revalide o resultado oficial antes de continuar.");
      }
      setSelected("");
      setDecision("");
      setMotivo("");
      await load();
      await onRecheck();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "A decisão não foi confirmada.");
    } finally {
      setSaving(false);
    }
  };

  const submitPedido = async () => {
    if (!disciplinaId || motivo.trim().length < 10 || saving) {
      setError("Selecione a disciplina e descreva a reapreciação com pelo menos 10 caracteres.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const json = await readJson("/api/academico/raa/reapreciacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matricula_id: matriculaId,
          disciplina_id: disciplinaId,
          motivo: motivo.trim(),
          idempotency_key: crypto.randomUUID(),
        }),
      });
      setNotice(json.duplicate
        ? "Já existe um pedido. Consulte o estado abaixo."
        : "Solicitação realizada. Aguardando análise da autoridade competente.");
      setDisciplinaId("");
      setMotivo("");
      await load();
      await onRecheck();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar o pedido.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section key={alunoId + ":" + matriculaId} className="mb-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4" aria-label="Resolução RAA no Balcão">
      <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800">RAA · Análise contextual</p>
      <h3 className="mt-1 text-sm font-black text-foreground">{plan.titulo}</h3>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{academic?.reason || plan.detalhe}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {action === "documentos" ? (
          <button type="button" onClick={onDocumentos} className="rounded-xl bg-emerald px-3 py-2 text-xs font-bold text-white">
            Emitir documento neste Balcão
          </button>
        ) : (
          <button type="button" onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="rounded-xl bg-emerald px-3 py-2 text-xs font-bold text-white">
            {open ? "Fechar análise" : "Resolver no Balcão"}
          </button>
        )}
        <button type="button" disabled={saving || loading} onClick={() => void onRecheck()}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-foreground disabled:opacity-60">
          <RefreshCw className="h-4 w-4" /> Verificar RAA
        </button>
      </div>
      {open && action !== "documentos" && (
        <div className="mt-4 space-y-3 border-t border-amber-200 pt-4">
          <p className="text-xs text-muted-foreground">{plan.detalhe}</p>
          {loading && <p role="status" className="text-xs text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />A consultar o processo...</p>}
          {action === "nota" && (
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-foreground">
                {academic?.disciplina_ids_pendentes?.length
                  ? String(academic.disciplina_ids_pendentes.length) + " disciplinas com elementos pendentes."
                  : "Conclua notas, fórmula e frequência no período académico autorizado."}
              </p>
              <button type="button" onClick={onLancarNota}
                className="mt-2 rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground">
                Lançar nota nesta ficha
              </button>
              <p className="mt-2 text-xs text-muted-foreground">O formulário só admite escritas autorizadas no ano letivo e período válidos.</p>
            </div>
          )}
          {action === "rever_resultado" && (
            <p className="rounded-lg border border-border bg-card p-3 text-xs text-foreground">
              Resultado oficial não autoriza progressão. Peça a revisão de evidências pela autoridade académica;
              não há botão para substituir a decisão. Consulte novamente após a publicação ou retificação formal.
            </p>
          )}
          {action === "justificacao" && (
            <div className="space-y-2">
              {!loading && faltas.length === 0 && <p className="text-xs text-muted-foreground">Não há pedidos de justificação pendentes para esta matrícula. Uma falta não é alterada por este painel.</p>}
              {faltas.map((item) => (
                <button key={item.id} type="button" onClick={() => { setSelected(item.id); setDecision("approved"); setMotivo(""); }}
                  className="block w-full rounded-lg border border-border bg-card p-3 text-left text-xs text-foreground">
                  <strong>Falta de {item.data_falta}</strong><span className="mt-1 block">{item.motivo}</span>
                </button>
              ))}
            </div>
          )}
          {action === "reapreciacao" && (
            <div className="space-y-2">
              {!loading && pedidos.length === 0 && <p className="text-xs text-muted-foreground">Não existem pedidos nesta matrícula. O exame de recurso continua sujeito à publicação oficial.</p>}
              {pedidos.map((item) => (
                <button key={item.id} type="button" onClick={() => {
                  setSelected(item.id); setDecision(item.estado === "pendente" ? "em_analise" : "deferido"); setMotivo("");
                }} disabled={!["pendente", "em_analise"].includes(item.estado)}
                  className="block w-full rounded-lg border border-border bg-card p-3 text-left text-xs text-foreground disabled:opacity-60">
                  <strong>{item.protocolo_publico || item.id.slice(0, 8)}</strong>
                  <span className="ml-2">{item.estado}</span><span className="mt-1 block">{item.motivo}</span>
                </button>
              ))}
              {(!selected && (academic?.disciplina_ids_pendentes?.length || 0) > 0) && (
                <div className="rounded-lg border border-border bg-card p-3">
                  <label className="block text-xs font-bold text-foreground" htmlFor="raa-balcao-disciplina">Disciplina para reapreciação</label>
                  <select id="raa-balcao-disciplina" className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm"
                    value={disciplinaId} onChange={(event) => setDisciplinaId(event.target.value)}>
                    <option value="">Selecionar disciplina</option>
                    {(academic?.disciplina_ids_pendentes || []).map((id) => <option key={id} value={id}>{id}</option>)}
                  </select>
                  <label className="mt-2 block text-xs font-bold text-foreground" htmlFor="raa-balcao-pedido-motivo">Fundamento do pedido</label>
                  <textarea id="raa-balcao-pedido-motivo" rows={2} className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm"
                    value={motivo} onChange={(event) => setMotivo(event.target.value)} />
                  <button type="button" disabled={saving} onClick={() => void submitPedido()} className="mt-2 rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground">
                    Solicitar reapreciação
                  </button>
                </div>
              )}
            </div>
          )}
          {action === "disciplina" && (
            <div className="space-y-2">
              {!loading && eventos.length === 0 && <p className="text-xs text-muted-foreground">Nenhum evento disciplinar localizado nesta matrícula. Solicite revisão à direção; não é possível levantar o bloqueio por declaração do Balcão.</p>}
              {eventos.map((item) => (
                <button key={item.id} type="button" disabled={!["registado", "em_analise"].includes(item.estado)}
                  onClick={() => { setSelected(item.id); setDecision("em_analise"); setMotivo(""); }}
                  className="block w-full rounded-lg border border-border bg-card p-3 text-left text-xs text-foreground disabled:opacity-60">
                  <strong>{item.categoria}</strong><span className="ml-2">{item.estado}</span>
                  <span className="mt-1 block">{item.descricao}</span>
                </button>
              ))}
            </div>
          )}
          {!!selected && (action === "justificacao" || action === "reapreciacao" || action === "disciplina") && (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-card p-3">
              <label htmlFor="raa-balcao-decisao" className="block text-xs font-bold text-foreground">Decisão autorizada</label>
              <select id="raa-balcao-decisao" value={decision} onChange={(event) => setDecision(event.target.value)}
                className="w-full rounded-lg border border-border bg-background p-2 text-sm">
                {action === "justificacao" ? (
                  <><option value="approved">Aprovar justificação</option><option value="rejected">Rejeitar</option></>
                ) : action === "reapreciacao" ? (
                  <><option value="em_analise">Em análise</option><option value="deferido">Deferir pedido</option><option value="indeferido">Indeferir pedido</option></>
                ) : (
                  <><option value="em_analise">Colocar em análise</option><option value="resolvido">Concluir revisão</option><option value="cancelado">Cancelar ocorrência incorreta</option></>
                )}
              </select>
              <label htmlFor="raa-balcao-fundamento" className="block text-xs font-bold text-foreground">Fundamentação da decisão</label>
              <textarea id="raa-balcao-fundamento" rows={3} value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
                className="w-full rounded-lg border border-border bg-background p-2 text-sm" />
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={saving || motivo.trim().length < (action === "disciplina" ? 15 : action === "reapreciacao" ? 5 : 0)}
                  onClick={() => void submit()}
                  className="rounded-lg bg-emerald px-3 py-2 text-xs font-bold text-white disabled:opacity-60">
                  {saving ? "A guardar..." : "Guardar decisão"}
                </button>
                <button type="button" onClick={() => { setSelected(""); setDecision(""); setMotivo(""); }} className="rounded-lg border border-border px-3 py-2 text-xs font-bold">Cancelar</button>
              </div>
            </div>
          )}
          {notice && <p role="status" className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800"><CheckCircle2 className="h-4 w-4" />{notice}</p>}
          {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800">{error}</p>}
          <p className="text-xs text-muted-foreground">
            Aluno selecionado preservado. Nenhuma decisão deste painel dispensa a elegibilidade oficial do RAA para rematrícula.
          </p>
        </div>
      )}
    </section>
  );
}

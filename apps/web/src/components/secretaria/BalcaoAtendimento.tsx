"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
AlertCircle, Banknote, CheckCircle, ChevronRight,
CreditCard, Loader2, Plus, Printer,
Search, ShoppingCart, Smartphone, User, Wallet, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";
import { BalcaoServicoModal, type BalcaoDecision } from "@/components/secretaria/BalcaoServicoModal";
import { MotivoBloqueioModal } from "@/components/secretaria/MotivoBloqueioModal";
import { useToast } from "@/components/feedback/FeedbackSystem";

// ─── Formatters ───────────────────────────────────────────────────────────────

const kwanza = new Intl.NumberFormat("pt-AO", {
style: "currency", currency: "AOA", maximumFractionDigits: 0,
});

// ─── Tipos ────────────────────────────────────────────────────────────────────

type MetodoPagamento = "cash" | "tpa" | "transfer" | "mcx" | "kiwk";
type DocumentoTipo   = "declaracao_frequencia" | "declaracao_notas" | "cartao_estudante" | "ficha_inscricao";

interface AlunoBusca {
id: string; nome: string; numero_processo: string;
bi_numero: string | null; turma: string;
foto_url: string | null; matricula_id: string | null;
}

interface AlunoDossier extends AlunoBusca {
status_financeiro: "em_dia" | "inadimplente";
divida_total:  number;
turma_codigo?: string | null;
classe?:       string | null;
curso?:        string | null;
curso_codigo?: string | null;
}

interface Mensalidade {
id: string; nome: string; preco: number; tipo: "mensalidade";
atrasada: boolean; mes_referencia: number; ano_referencia: number;
}

interface Servico {
id: string; codigo: string; nome: string; preco: number; tipo: "servico";
descricao?: string | null; documento_tipo?: DocumentoTipo | null;
pedido_id?: string | null; pagamento_intent_id?: string | null;
}

interface AuditEntry {
created_at: string; portal: string | null; action: string | null;
entity: string | null; entity_id: string | null;
details: Record<string, unknown> | null;
}

interface MetodoDetalhes { referencia: string; evidencia_url: string; gateway_ref: string; }

type ItemCarrinho = Mensalidade | Servico;

export interface BalcaoAtendimentoProps {
escolaId:         string;
selectedAlunoId?: string | null;
showSearch?:      boolean;
embedded?:        boolean;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const DETALHES_VAZIOS: MetodoDetalhes = { referencia: "", evidencia_url: "", gateway_ref: "" };

const METODOS_UI = [
{ id: "cash"     as const, icon: Banknote,   label: "Cash"  },
{ id: "tpa"      as const, icon: CreditCard, label: "TPA"   },
{ id: "transfer" as const, icon: Wallet,     label: "Transf"},
{ id: "mcx"      as const, icon: Smartphone, label: "MCX"   },
{ id: "kiwk"     as const, icon: Smartphone, label: "KIWK"  },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function idKey(): string {
return (crypto as any).randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatMesAno(mes?: number, ano?: number): string {
if (!mes || mes < 1 || mes > 12 || !ano) return "Mensalidade";
const label = new Date(0, mes - 1).toLocaleString("pt-PT", { month: "short" });
return `Mensalidade ${label}/${ano}`;
}

function isDocServico(s: Servico): boolean {
const h = `${s.codigo} ${s.nome} ${s.descricao ?? ""}`.toLowerCase();
return ["doc","declaracao","declaração","documento","certificado","cartao","cartão","ficha"]
.some(t => h.includes(t));
}

function getDocTipo(s: Servico): DocumentoTipo | null {
const h = `${s.codigo} ${s.nome} ${s.descricao ?? ""}`.toLowerCase();
if (h.includes("nota"))                              return "declaracao_notas";
if (h.includes("frequencia") || h.includes("freq")) return "declaracao_frequencia";
if (h.includes("cartao") || h.includes("cartão"))   return "cartao_estudante";
if (h.includes("ficha") || h.includes("inscricao")) return "ficha_inscricao";
return null;
}

function getDocDestino(docId: string, tipo: DocumentoTipo): string {
const seg: Record<DocumentoTipo, string> = {
declaracao_frequencia: "frequencia",
declaracao_notas:      "notas",
cartao_estudante:      "cartao",
ficha_inscricao:       "ficha",
};
return `/secretaria/documentos/${docId}/${seg[tipo]}/print`;
}

// ─── Hook: serviços ───────────────────────────────────────────────────────────

function useServicos(escolaId: string) {
const supabase = createClient();
const { error } = useToast();
const [servicos, setServicos] = useState<Servico[]>([]);

useEffect(() => {
let alive = true;
supabase
.from("servicos_escola")
.select("id, codigo, nome, descricao, valor_base")
.eq("escola_id", escolaId)
.eq("ativo", true)
.then(({ data, error: e }) => {
if (!alive) return;
if (e) { error("Erro ao carregar serviços."); return; }
setServicos((data ?? []).map((r: any) => ({
id: r.id, codigo: r.codigo, nome: r.nome, descricao: r.descricao,
preco: Number(r.valor_base ?? 0), tipo: "servico" as const,
})));
});
return () => { alive = false; };
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [escolaId]);

return servicos;
}

// ─── Hook: busca de alunos ────────────────────────────────────────────────────

function useAlunoSearch() {
const [searchTerm,        setSearchTerm]        = useState("");
const [alunosEncontrados, setAlunosEncontrados] = useState<AlunoBusca[]>([]);
const [isSearching,       setIsSearching]       = useState(false);
const debouncedTerm = useDebounce(searchTerm, 400);
const abortRef      = useRef<AbortController | null>(null);

useEffect(() => {
const q = debouncedTerm.trim();
if (!q) {
setAlunosEncontrados([]);
setIsSearching(false);
abortRef.current?.abort();
return;
}
setIsSearching(true);
abortRef.current?.abort();
abortRef.current = new AbortController();

fetch(`/api/secretaria/balcao/alunos/search?query=${encodeURIComponent(q)}`,
  { signal: abortRef.current.signal })
  .then(r => r.json().catch(() => ({})))
  .then(json => {
    setAlunosEncontrados(json?.ok && Array.isArray(json.alunos) ? json.alunos : []);
  })
  .catch((e: any) => { if (e?.name !== "AbortError") setAlunosEncontrados([]); })
  .finally(() => setIsSearching(false));

}, [debouncedTerm]);

const clear = useCallback(() => {
setSearchTerm("");
setAlunosEncontrados([]);
abortRef.current?.abort();
}, []);

return { searchTerm, setSearchTerm, alunosEncontrados, isSearching, clear };
}

// ─── Hook: dossier do aluno ───────────────────────────────────────────────────

function useAlunoDossier(escolaId: string) {
const supabase = createClient();
const { error } = useToast();
const [aluno,        setAluno]        = useState<AlunoDossier | null>(null);
const [mensalidades, setMensalidades] = useState<Mensalidade[]>([]);
const [loading,      setLoading]      = useState(false);

const load = useCallback(async (alunoId: string) => {
setLoading(true);
try {
const { data, error: e } = await supabase.rpc("get_aluno_dossier", {
p_escola_id: escolaId, p_aluno_id: alunoId,
});
if (e || !data) throw new Error(e?.message || "Erro ao carregar dossier.");

  const raw        = data as any;
  const financeiro = raw.financeiro || {};
  const perfil     = raw.perfil     || {};
  const historico  = Array.isArray(raw.historico) ? raw.historico : [];
  const matriculaAtiva = raw.matricula_ativa ?? null;
  const atual      = matriculaAtiva
    ?? historico.find((h: any) =>
      ["ativo","ativa","active"].includes(String(h?.status ?? "").toLowerCase())
    ) ?? historico[0] ?? null;

  const divida = Number(financeiro.total_em_atraso ?? 0);

  setAluno({
    id:              alunoId,
    nome:            perfil.nome_completo || perfil.nome || "Aluno",
    numero_processo: perfil.numero_processo || "—",
    bi_numero:       perfil.bi_numero || null,
    turma:           atual?.turma || "—",
    turma_codigo:    atual?.turma_codigo ?? atual?.turma_code ?? null,
    classe:          atual?.classe ?? null,
    curso:           atual?.curso ?? atual?.curso_nome ?? null,
    curso_codigo:    atual?.curso_codigo ?? atual?.curso_code ?? null,
    status_financeiro: divida > 0 ? "inadimplente" : "em_dia",
    divida_total:    divida,
    foto_url:        perfil.foto_url || null,
    matricula_id:    atual?.matricula_id || null,
  });

  setMensalidades(
    (financeiro.mensalidades || [])
      .filter((m: any) => ["pendente","pago_parcial"].includes(String(m.status)))
      .map((m: any) => {
        const mes   = Number(m.mes ?? m.mes_referencia);
        const ano   = Number(m.ano ?? m.ano_referencia);
        const valor = Number(m.valor ?? 0);
        const pago  = Number(m.pago ?? m.valor_pago_total ?? 0);
        const saldo = Math.max(0, valor - pago);
        const venc  = m.vencimento || m.data_vencimento || null;
        return {
          id: String(m.id), nome: formatMesAno(mes, ano), preco: saldo,
          tipo: "mensalidade" as const,
          atrasada: venc ? new Date(venc) < new Date() : false,
          mes_referencia: mes, ano_referencia: ano,
        };
      })
      .filter((m: Mensalidade) => m.preco > 0)
  );
} catch (err: any) {
  error(err.message || "Erro ao carregar dossier.");
  setAluno(null);
  setMensalidades([]);
} finally {
  setLoading(false);
}

}, [escolaId, supabase, error]);

const clear = useCallback(() => {
setAluno(null);
setMensalidades([]);
}, []);

return { aluno, mensalidades, loading, load, clear };
}

// ─── Hook: carrinho ───────────────────────────────────────────────────────────

function useCarrinho() {
const { toast: rawToast } = useToast();
const [itens,         setItens]         = useState<ItemCarrinho[]>([]);
const [metodo,        setMetodo]        = useState<MetodoPagamento>("cash");
const [detalhes,      setDetalhesState] = useState<MetodoDetalhes>(DETALHES_VAZIOS);
const [valorRecebido, setValorRecebido] = useState("");

// Reset campos de método ao trocar
useEffect(() => { setDetalhesState(DETALHES_VAZIOS); }, [metodo]);

const total    = useMemo(() => itens.reduce((s, i) => s + Number(i.preco || 0), 0), [itens]);
const valorNum = useMemo(() => { const n = Number(valorRecebido); return isFinite(n) ? n : 0; }, [valorRecebido]);
const troco    = useMemo(() => Math.max(0, valorNum - total), [valorNum, total]);

const prontoParaPagar = itens.length > 0 &&
(total === 0 || metodo !== "cash" || (valorNum >= total && valorNum > 0));

const adicionar = useCallback((item: ItemCarrinho) => {
const dup = item.tipo === "mensalidade"
? itens.some(i =>
i.tipo === "mensalidade" &&
(i as Mensalidade).mes_referencia === (item as Mensalidade).mes_referencia &&
(i as Mensalidade).ano_referencia === (item as Mensalidade).ano_referencia)
: itens.some(i => i.tipo === "servico" && i.id === item.id);

if (dup) { rawToast({ variant: "info", title: "Item já está no carrinho." }); return; }
setItens(prev => [...prev, item]);

}, [itens, rawToast]);

const remover = useCallback((id: string, tipo: ItemCarrinho["tipo"]) => {
setItens(prev => prev.filter(i => !(i.id === id && i.tipo === tipo)));
}, []);

const limpar = useCallback(() => {
setItens([]);
setValorRecebido("");
setDetalhesState(DETALHES_VAZIOS);
}, []);

const setDetalhes = useCallback((d: Partial<MetodoDetalhes>) => {
setDetalhesState(prev => ({ ...prev, ...d }));
}, []);

return {
itens, total, metodo, setMetodo, detalhes, setDetalhes,
valorRecebido, setValorRecebido, valorNum, troco,
prontoParaPagar, adicionar, remover, limpar,
};
}

// ─── Hook: audit trail ────────────────────────────────────────────────────────

function useAuditTrail() {
const [entries,  setEntries]  = useState<AuditEntry[]>([]);
const [loading,  setLoading]  = useState(false);
const [open,     setOpen]     = useState(false);
const [scope,    setScope]    = useState<"aluno" | "todos">("aluno");

const fetch_ = useCallback(async (alunoId?: string | null, matriculaId?: string | null) => {
setLoading(true);
const params = new URLSearchParams({ limit: "20" });
if (scope === "aluno") {
if (alunoId)     params.set("alunoId", alunoId);
if (matriculaId) params.set("matriculaId", matriculaId);
}
try {
const res  = await fetch(`/api/secretaria/balcao/audit?${params}`, { cache: "no-store" });
const json = await res.json().catch(() => ({}));
setEntries(res.ok && json?.ok && Array.isArray(json.logs) ? json.logs : []);
} finally {
setLoading(false);
}
}, [scope]);

return { entries, loading, open, setOpen, scope, setScope, fetch: fetch_ };
}

// ─── Hook: checkout ───────────────────────────────────────────────────────────

function useCheckout({
escolaId, aluno, carrinho, onSuccess,
}: {
escolaId:  string;
aluno:     AlunoDossier | null;
carrinho:  ReturnType<typeof useCarrinho>;
onSuccess: () => void;
}) {
const { success, error } = useToast();
const [isSubmitting,  setIsSubmitting]  = useState(false);
const [printQueue,    setPrintQueue]    = useState<Array<{ label: string; url: string }>>([]);
const [feedback,      setFeedback]      = useState<{ type: "success" | "error"; message: string } | null>(null);
const [emittingDocId, setEmittingDocId] = useState<string | null>(null);

const emitirDocumento = useCallback(async (servico: Servico): Promise<string | null> => {
if (!aluno?.id) { error("Aluno não seleccionado."); return null; }
const tipo = getDocTipo(servico);
if (!tipo)     { error("Tipo de documento não identificado."); return null; }

const popup = window.open("", "_blank", "noopener,noreferrer");
setEmittingDocId(servico.id);
try {
  const res  = await fetch("/api/secretaria/documentos/emitir", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ alunoId: aluno.id, tipoDocumento: tipo, escolaId }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok || !json?.docId) throw new Error(json?.error || "Falha ao emitir documento.");
  const destino = getDocDestino(json.docId, tipo);
  if (popup) popup.location.href = destino; else window.location.href = destino;
  return destino;
} catch (err: any) {
  popup?.close();
  error(err.message || "Erro ao emitir documento.");
  return null;
} finally {
  setEmittingDocId(null);
}

}, [aluno, escolaId, error]);

const checkout = useCallback(async () => {
if (!aluno?.id)                 return error("Nenhum aluno seleccionado.");
if (carrinho.itens.length === 0) return error("Carrinho vazio.");

const { metodo, detalhes, itens, total, troco } = carrinho;

if (total > 0) {
  if (metodo === "cash"     && carrinho.valorNum < total) return error("Valor recebido insuficiente.");
  if (metodo === "tpa"      && !detalhes.referencia.trim()) return error("Referência obrigatória para TPA.");
  if (metodo === "transfer" && !detalhes.evidencia_url.trim()) return error("Comprovativo obrigatório para Transferência.");
}

const mensalidadesCarrinho = itens.filter((i): i is Mensalidade => i.tipo === "mensalidade");
const servicosCarrinho     = itens.filter((i): i is Servico     => i.tipo === "servico");

setIsSubmitting(true);
try {
  // 1. Pagar mensalidades
  for (const m of mensalidadesCarrinho) {
    const res  = await fetch("/api/secretaria/balcao/pagamentos", {
      method: "POST", cache: "no-store",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idKey() },
      body: JSON.stringify({
        aluno_id: aluno.id, mensalidade_id: m.id, valor: m.preco, metodo,
        reference:    detalhes.referencia    || null,
        evidence_url: detalhes.evidencia_url || null,
        gateway_ref:  detalhes.gateway_ref   || null,
        meta: { observacao: "Pagamento via balcão" },
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao registar pagamento.");
  }

  // 2. Pagar serviços com valor
  for (const s of servicosCarrinho.filter(s => (s.preco ?? 0) > 0)) {
    const res  = await fetch("/api/secretaria/balcao/pagamentos", {
      method: "POST", cache: "no-store",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idKey() },
      body: JSON.stringify({
        aluno_id: aluno.id, mensalidade_id: null, valor: s.preco, metodo,
        reference:    detalhes.referencia    || null,
        evidence_url: detalhes.evidencia_url || null,
        gateway_ref:  detalhes.gateway_ref   || null,
        meta: {
          observacao: "Pagamento via balcão",
          pedido_id:           s.pedido_id           ?? null,
          pagamento_intent_id: s.pagamento_intent_id ?? null,
          servico_codigo:      s.codigo,
          documento_tipo:      s.documento_tipo       ?? null,
        },
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao registar pagamento.");
  }

  // 3. Emitir documentos
  const docs      = servicosCarrinho.filter(s => s.documento_tipo);
  const novosLinks: Array<{ label: string; url: string }> = [];
  for (const s of docs) {
    const url = await emitirDocumento(s);
    if (url) novosLinks.push({ label: s.nome, url });
  }
  if (novosLinks.length > 0) setPrintQueue(prev => [...novosLinks, ...prev]);

  const msg = total === 0
    ? "Documento emitido."
    : metodo === "cash"
      ? `Pagamento registado. Troco: ${kwanza.format(troco)}`
      : "Pagamento registado.";

  success(msg);
  setFeedback({ type: "success", message: msg });
  carrinho.limpar();
  onSuccess();
} catch (err: any) {
  const msg = err.message || "Erro ao finalizar pagamento.";
  error(msg);
  setFeedback({ type: "error", message: msg });
} finally {
  setIsSubmitting(false);
}

}, [aluno, carrinho, emitirDocumento, success, error, onSuccess]);

return { isSubmitting, printQueue, setPrintQueue, feedback, setFeedback, emittingDocId, checkout, emitirDocumento };
}

// ═════════════════════════════════════════════════════════════════════════════
// Componentes UI
// ═════════════════════════════════════════════════════════════════════════════

// ─── Atoms ────────────────────────────────────────────────────────────────────

function Avatar({ url, nome, size = "md" }: { url?: string | null; nome?: string | null; size?: "sm" | "md" | "lg" }) {
const dim = size === "lg" ? "h-16 w-16" : size === "sm" ? "h-9 w-9" : "h-10 w-10";
const txt = size === "lg" ? "text-xl"   : "text-sm";
return (
<div className={`${dim} rounded-2xl bg-[#1F6B3B]/10 border border-[#1F6B3B]/20 flex items-center justify-center overflow-hidden flex-shrink-0`}>
{url
? <img src={url} alt="" className="h-full w-full object-cover" />
: <span className={`font-black text-[#1F6B3B] ${txt}`}>{(nome ?? "?").charAt(0).toUpperCase()}</span>
}
</div>
);
}

function StatusPill({ status }: { status: "em_dia" | "inadimplente" }) {
return status === "inadimplente"
? <span className="inline-flex items-center rounded-full border border-rose-200
bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-700 uppercase tracking-wide">
Inadimplente
</span>
: <span className="inline-flex items-center rounded-full border border-[#1F6B3B]/20
bg-[#1F6B3B]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#1F6B3B] uppercase tracking-wide">
Em dia
</span>;
}

function Tag({ children }: { children: React.ReactNode }) {
return (
<span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
{children}
</span>
);
}

function SecaoLabel({ children }: { children: React.ReactNode }) {
return (
<p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 pl-1">
{children}
</p>
);
}

function SkeletonLine() {
return <div className="h-3 w-full animate-pulse rounded bg-slate-100" />;
}

// ─── SearchCard ───────────────────────────────────────────────────────────────

function SearchCard({
searchTerm, setSearchTerm, alunosEncontrados, isSearching, clear, onSelect,
}: {
searchTerm:        string;
setSearchTerm:     (v: string) => void;
alunosEncontrados: AlunoBusca[];
isSearching:       boolean;
clear:             () => void;
onSelect:          (id: string) => void;
}) {
return (
<div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
<div className="px-5 py-4 flex items-center gap-3">
<div className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-200
flex items-center justify-center flex-shrink-0">
<Search className="h-4 w-4 text-slate-400" />
</div>
<div className="flex-1 min-w-0">
<p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
Buscar Aluno
</p>
<input
value={searchTerm}
onChange={e => setSearchTerm(e.target.value)}
placeholder="Nome, BI, Nº Processo..."
className="w-full text-sm font-medium text-slate-900 placeholder:text-slate-300
outline-none bg-transparent"
/>
</div>
{isSearching && <Loader2 className="h-4 w-4 animate-spin text-[#E3B23C] flex-shrink-0" />}
{searchTerm && (
<button type="button" onClick={clear}
className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0">
<X className="h-4 w-4 text-slate-400" />
</button>
)}
</div>

  {searchTerm.trim() && (
    <div className="border-t border-slate-100 max-h-72 overflow-y-auto">
      {alunosEncontrados.length === 0 && !isSearching ? (
        <p className="p-6 text-center text-sm text-slate-400">Nenhum aluno encontrado.</p>
      ) : (
        alunosEncontrados.map(a => (
          <button key={a.id} type="button"
            onClick={() => { clear(); onSelect(a.id); }}
            className="w-full px-5 py-3 flex items-center gap-3 text-left
              hover:bg-slate-50 transition-colors
              border-b border-slate-50 last:border-b-0 group">
            <div className="h-9 w-9 rounded-full bg-slate-100 border border-slate-200
              flex items-center justify-center overflow-hidden flex-shrink-0">
              {a.foto_url
                ? <img src={a.foto_url} alt="" className="h-full w-full object-cover" />
                : <User className="h-4 w-4 text-slate-400" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-700 group-hover:text-slate-900 truncate">
                {a.nome}
              </p>
              <p className="text-xs text-slate-400">{a.turma} · Proc: {a.numero_processo}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-[#E3B23C] flex-shrink-0" />
          </button>
        ))
      )}
    </div>
  )}
</div>

);
}

// ─── AlunoCard ────────────────────────────────────────────────────────────────

function AlunoCard({ aluno }: { aluno: AlunoDossier }) {
const inadimplente = aluno.status_financeiro === "inadimplente";
return (
<div className="xl:col-span-5 rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
<div className="flex items-start gap-4">
<Avatar url={aluno.foto_url} nome={aluno.nome} size="lg" />
<div className="flex-1 min-w-0 space-y-2">
<h2 className="text-base font-black text-slate-900 leading-tight">{aluno.nome}</h2>
<div className="flex flex-wrap gap-1.5">
{aluno.turma_codigo && <Tag>Turma {aluno.turma_codigo}</Tag>}
{aluno.curso_codigo && <Tag>Curso {aluno.curso_codigo}</Tag>}
{aluno.classe       && <Tag>Classe {aluno.classe}</Tag>}
<Tag>Proc {aluno.numero_processo}</Tag>
<StatusPill status={aluno.status_financeiro} />
</div>
</div>
</div>

  {inadimplente ? (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
      <div className="flex items-center gap-2 mb-1">
        <AlertCircle className="h-4 w-4 text-rose-600" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-rose-600">
          Dívida acumulada
        </p>
      </div>
      <p className="text-2xl font-black text-rose-700">{kwanza.format(aluno.divida_total)}</p>
    </div>
  ) : (
    <div className="rounded-xl border border-[#1F6B3B]/20 bg-[#1F6B3B]/5 p-4 flex items-center gap-3">
      <div className="p-2 rounded-full bg-[#1F6B3B]/10">
        <CheckCircle className="h-4 w-4 text-[#1F6B3B]" />
      </div>
      <div>
        <p className="text-xs font-bold text-[#1F6B3B]">Situação regular</p>
        <p className="text-[11px] text-[#1F6B3B]/70">Nenhuma pendência.</p>
      </div>
    </div>
  )}
</div>

);
}

// ─── Catalogo ─────────────────────────────────────────────────────────────────

function Catalogo({
mensalidades, servicos,
onAdicionarMensalidade, onAdicionarServico,
emittingDocId, addingServicoId, onServicoAvulso,
}: {
mensalidades:           Mensalidade[];
servicos:               Servico[];
onAdicionarMensalidade: (m: Mensalidade) => void;
onAdicionarServico:     (s: Servico) => Promise<void>;
emittingDocId:          string | null;
addingServicoId:        string | null;
onServicoAvulso:        () => void;
}) {
const atrasadas  = useMemo(() => mensalidades.filter(m => m.atrasada),    [mensalidades]);
const correntes  = useMemo(() => mensalidades.filter(m => !m.atrasada),   [mensalidades]);
const documentos = useMemo(() => servicos.filter(isDocServico),            [servicos]);
const extras     = useMemo(() => servicos.filter(s => !isDocServico(s)),   [servicos]);

const servicoBtnCls = (busy: boolean) =>
`p-3 rounded-xl border border-slate-200 bg-slate-50 text-left transition-all hover:bg-white hover:border-[#E3B23C] ${busy ? "opacity-50 cursor-not-allowed" : ""}`;

return (
<div className="xl:col-span-7 rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
<div className="flex items-center justify-between mb-5">
<div className="flex items-center gap-2">
<Plus className="h-4 w-4 text-[#E3B23C]" />
<p className="text-xs font-bold uppercase tracking-wider text-slate-500">Adicionar item</p>
</div>
<button onClick={onServicoAvulso}
className="text-[10px] font-bold text-[#E3B23C] hover:underline">
+ Serviço avulso
</button>
</div>

  <div className="space-y-5 max-h-[480px] overflow-y-auto pr-1">

    {atrasadas.length > 0 && (
      <div>
        <SecaoLabel>Em atraso</SecaoLabel>
        <div className="grid gap-2">
          {atrasadas.map(m => (
            <button key={m.id} onClick={() => onAdicionarMensalidade(m)}
              className="flex items-center justify-between p-3 rounded-xl border
                border-rose-200 bg-rose-50 hover:border-rose-300 transition-all text-left group">
              <div>
                <p className="text-sm font-bold text-rose-900">{m.nome}</p>
                <p className="text-[10px] text-rose-500">Vencida</p>
              </div>
              <span className="text-sm font-black text-rose-800">{kwanza.format(m.preco)}</span>
            </button>
          ))}
        </div>
      </div>
    )}

    {correntes.length > 0 && (
      <div>
        <SecaoLabel>Mensalidades</SecaoLabel>
        <div className="grid gap-2">
          {correntes.map(m => (
            <button key={m.id} onClick={() => onAdicionarMensalidade(m)}
              className="flex items-center justify-between p-3 rounded-xl border
                border-slate-200 bg-white hover:border-[#E3B23C] transition-all text-left group">
              <div>
                <p className="text-sm font-bold text-slate-700 group-hover:text-slate-900">{m.nome}</p>
                <p className="text-[10px] text-slate-400">Corrente</p>
              </div>
              <span className="text-sm font-bold text-slate-900">{kwanza.format(m.preco)}</span>
            </button>
          ))}
        </div>
      </div>
    )}

    {documentos.length > 0 && (
      <div>
        <SecaoLabel>Documentos</SecaoLabel>
        <div className="grid grid-cols-2 gap-2">
          {documentos.map(s => {
            const busy = addingServicoId === s.id || emittingDocId === s.id;
            return (
              <button key={s.id} disabled={busy}
                onClick={() => void onAdicionarServico(s)}
                className={servicoBtnCls(busy)}>
                <p className="text-xs font-bold text-slate-700 truncate">{s.nome}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-slate-400">{kwanza.format(s.preco)}</span>
                  <span className={`text-[10px] font-bold ${
                    s.preco > 0 ? "text-[#9a7010]" : "text-[#1F6B3B]"
                  }`}>
                    {busy ? "..." : s.preco > 0 ? "Cobrar" : "Adicionar"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    )}

    {extras.length > 0 && (
      <div>
        <SecaoLabel>Serviços extras</SecaoLabel>
        <div className="grid grid-cols-2 gap-2">
          {extras.map(s => {
            const busy = addingServicoId === s.id;
            return (
              <button key={s.id} disabled={busy}
                onClick={() => void onAdicionarServico(s)}
                className={servicoBtnCls(busy)}>
                <p className="text-xs font-bold text-slate-700 truncate">{s.nome}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-slate-400">{kwanza.format(s.preco)}</span>
                  <span className={`text-[10px] font-bold ${
                    s.preco > 0 ? "text-[#9a7010]" : "text-[#1F6B3B]"
                  }`}>
                    {busy ? "..." : s.preco > 0 ? "Pago" : "Grátis"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    )}

    {mensalidades.length === 0 && servicos.length === 0 && (
      <p className="text-sm text-slate-400 text-center py-8">
        Nenhum item disponível para este aluno.
      </p>
    )}
  </div>
</div>

);
}

// ─── AuditTrail (inline no carrinho) ─────────────────────────────────────────

function AuditTrail({
audit, aluno, onRefresh,
}: {
audit:     ReturnType<typeof useAuditTrail>;
aluno:     AlunoDossier | null;
onRefresh: () => void;
}) {
if (!audit.open) return null;
return (
<div className="border-b border-slate-100">
<div className="flex items-center justify-between px-6 py-3">
<p className="text-[10px] uppercase tracking-widest text-slate-400">
{audit.scope === "aluno" ? "Só este aluno" : "Todos"}
</p>
<div className="flex items-center gap-3">
<button
onClick={() => audit.setScope(audit.scope === "aluno" ? "todos" : "aluno")}
className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-700">
{audit.scope === "aluno" ? "Ver todos" : "Ver aluno"}
</button>
<button onClick={onRefresh}
className="text-[10px] font-bold uppercase tracking-widest text-[#E3B23C] hover:underline">
Actualizar
</button>
</div>
</div>
<div className="max-h-52 overflow-y-auto px-6 pb-4 space-y-2">
{!aluno ? (
<p className="text-xs text-slate-400">Seleccione um aluno para ver o histórico.</p>
) : audit.loading ? (
<div className="space-y-2"><SkeletonLine /><SkeletonLine /></div>
) : audit.entries.length === 0 ? (
<p className="text-xs text-slate-400">Sem registos recentes.</p>
) : (
audit.entries.map((e, i) => (
<div key={`${e.created_at}-${i}`}
className="rounded-lg border border-slate-100 bg-slate-50 p-3">
<div className="flex items-center justify-between gap-2">
<p className="text-xs font-bold text-slate-800">{e.action || "Evento"}</p>
<p className="text-[10px] text-slate-400 flex-shrink-0">
{e.created_at
? new Date(e.created_at).toLocaleString("pt-PT", {
day: "2-digit", month: "short",
hour: "2-digit", minute: "2-digit",
})
: "—"}
</p>
</div>
{(e.entity || e.portal) && (
<p className="text-[10px] text-slate-500 mt-0.5">
{[e.entity, e.portal].filter(Boolean).join(" · ")}
</p>
)}
</div>
))
)}
</div>
</div>
);
}

// ─── CarrinhoPanel ────────────────────────────────────────────────────────────

function CarrinhoPanel({
carrinho, checkout, audit, aluno,
}: {
carrinho:  ReturnType<typeof useCarrinho>;
checkout:  ReturnType<typeof useCheckout>;
audit:     ReturnType<typeof useAuditTrail>;
aluno:     AlunoDossier | null;
}) {
const { itens, total, metodo, setMetodo, detalhes, setDetalhes,
valorRecebido, setValorRecebido, valorNum, troco,
prontoParaPagar, remover, limpar } = carrinho;

const inputCls = `w-full bg-white border border-slate-200 rounded-xl py-2.5 px-3 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-[#E3B23C] focus:ring-2 focus:ring-[#E3B23C]/20`;

return (
<div className="rounded-2xl border border-slate-200 bg-white shadow-lg overflow-hidden
flex flex-col h-[calc(100vh-140px)] sticky top-6">

  {/* Header */}
  <div className="bg-slate-900 px-6 py-4 flex items-center justify-between flex-shrink-0">
    <div className="flex items-center gap-2">
      <ShoppingCart className="h-5 w-5 text-[#E3B23C]" />
      <span className="text-sm font-bold text-white">Resumo da venda</span>
      {itens.length > 0 && (
        <span className="flex h-5 w-5 items-center justify-center rounded-full
          bg-[#E3B23C] text-[10px] font-black text-slate-900">
          {itens.length}
        </span>
      )}
    </div>
    <div className="flex items-center gap-3">
      <button
        onClick={() => {
          audit.setOpen(o => !o);
          if (!audit.open) audit.fetch(aluno?.id, aluno?.matricula_id);
        }}
        className="text-[10px] font-bold uppercase tracking-widest
          text-slate-500 hover:text-white transition-colors">
        {audit.open ? "Fechar audit" : "Audit trail"}
      </button>
      {itens.length > 0 && (
        <button onClick={limpar}
          className="text-[10px] font-bold uppercase tracking-widest
            text-slate-500 hover:text-white transition-colors">
          Limpar
        </button>
      )}
    </div>
  </div>

  {/* Audit trail */}
  <AuditTrail
    audit={audit} aluno={aluno}
    onRefresh={() => audit.fetch(aluno?.id, aluno?.matricula_id)}
  />

  {/* Lista de itens */}
  <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/50">
    {itens.length === 0 ? (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-300">
        <ShoppingCart className="h-10 w-10 opacity-30" />
        <p className="text-xs font-medium">Carrinho vazio</p>
      </div>
    ) : (
      itens.map(item => {
        const podeImprimir =
          item.tipo === "servico" &&
          Number(item.preco ?? 0) <= 0 &&
          (item as Servico).documento_tipo;

        return (
          <div key={`${item.id}-${item.tipo}`}
            className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm
              flex items-start justify-between gap-3 group">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-800 leading-tight">{item.nome}</p>
              <p className="text-[10px] uppercase font-bold text-slate-400 mt-0.5">{item.tipo}</p>
              {podeImprimir && (
                <button type="button"
                  onClick={async () => {
                    const url = await checkout.emitirDocumento(item as Servico);
                    if (url) checkout.setPrintQueue(prev => [{ label: item.nome, url }, ...prev]);
                  }}
                  className="mt-1.5 text-[10px] font-semibold text-[#1F6B3B] hover:underline">
                  Imprimir agora
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <p className="text-sm font-black text-slate-900">{kwanza.format(item.preco)}</p>
              <button onClick={() => remover(item.id, item.tipo)}
                className="p-1 text-slate-300 hover:text-rose-500 transition-colors
                  opacity-0 group-hover:opacity-100">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        );
      })
    )}
  </div>

  {/* Footer de pagamento */}
  <div className="border-t border-slate-100 bg-white p-5 space-y-4 flex-shrink-0">

    {/* Total */}
    <div className="flex items-end justify-between">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total a pagar</p>
      <p className="text-3xl font-black text-slate-900">{kwanza.format(total)}</p>
    </div>

    {/* Métodos */}
    <div className="grid grid-cols-5 gap-1.5">
      {METODOS_UI.map(({ id, icon: Icon, label }) => {
        const active = metodo === id;
        return (
          <button key={id} onClick={() => setMetodo(id)}
            className={`flex flex-col items-center justify-center py-2.5 rounded-xl border gap-1
              transition-all ${active
                ? "border-[#E3B23C] bg-[#E3B23C]/5 text-slate-900"
                : "border-slate-200 text-slate-400 hover:border-slate-300"}`}>
            <Icon className={`h-4 w-4 ${active ? "text-[#E3B23C]" : "text-current"}`} />
            <span className="text-[9px] font-bold uppercase">{label}</span>
          </button>
        );
      })}
    </div>

    {/* Referência TPA / MCX / KIWK */}
    {(metodo === "tpa" || metodo === "mcx" || metodo === "kiwk") && (
      <div className="space-y-2">
        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Referência {metodo === "tpa" && <span className="text-rose-500">*</span>}
        </label>
        <input value={detalhes.referencia}
          onChange={e => setDetalhes({ referencia: e.target.value })}
          placeholder={metodo === "tpa" ? "TPA-2026-000882" : "Opcional"}
          className={inputCls} />
        {(metodo === "mcx" || metodo === "kiwk") && (
          <input value={detalhes.gateway_ref}
            onChange={e => setDetalhes({ gateway_ref: e.target.value })}
            placeholder="Gateway ref (opcional)"
            className={inputCls} />
        )}
      </div>
    )}

    {/* Comprovativo transferência */}
    {metodo === "transfer" && (
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
          Comprovativo (URL) <span className="text-rose-500">*</span>
        </label>
        <input value={detalhes.evidencia_url}
          onChange={e => setDetalhes({ evidencia_url: e.target.value })}
          placeholder="https://..." className={inputCls} />
      </div>
    )}

    {/* Valor recebido (cash) */}
    {metodo === "cash" && (
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Recebido
          </label>
          {valorNum > total && (
            <span className="text-xs font-bold text-[#1F6B3B]">
              Troco: {kwanza.format(troco)}
            </span>
          )}
        </div>
        <div className="relative">
          <input type="number" value={valorRecebido}
            onChange={e => setValorRecebido(e.target.value)}
            placeholder="0"
            className={`${inputCls} pr-12 text-lg font-black`} />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
            KZ
          </span>
        </div>
      </div>
    )}

    {/* Botão finalizar */}
    <button
      disabled={!prontoParaPagar || checkout.isSubmitting}
      onClick={checkout.checkout}
      className={`w-full py-3.5 rounded-xl text-sm font-bold flex items-center
        justify-center gap-2 transition-all ${
        prontoParaPagar && !checkout.isSubmitting
          ? "bg-[#E3B23C] text-white shadow-lg shadow-[#E3B23C]/20 hover:brightness-105"
          : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}>
      {checkout.isSubmitting
        ? <><Loader2 className="h-4 w-4 animate-spin" /> A processar...</>
        : total === 0
          ? <><Printer className="h-4 w-4" /> Emitir documentos</>
          : <><Printer className="h-4 w-4" /> Finalizar · {kwanza.format(total)}</>
      }
    </button>
  </div>
</div>

);
}

// ═════════════════════════════════════════════════════════════════════════════
// Componente principal
// ═════════════════════════════════════════════════════════════════════════════

export default function BalcaoAtendimento({
escolaId, selectedAlunoId = null, showSearch = true, embedded = false,
}: BalcaoAtendimentoProps) {
const supabase = createClient();
const { error } = useToast();

const search   = useAlunoSearch();
const dossier  = useAlunoDossier(escolaId);
const servicos = useServicos(escolaId);
const carrinho = useCarrinho();
const audit    = useAuditTrail();

const [servicoModalOpen,   setServicoModalOpen]   = useState(false);
const [servicoModalCodigo, setServicoModalCodigo] = useState<string | null>(null);
const [bloqueioInfo,       setBloqueioInfo]       = useState<{ code: string; detail?: string } | null>(null);
const [addingServicoId,    setAddingServicoId]    = useState<string | null>(null);

const onCheckoutSuccess = useCallback(() => {
if (dossier.aluno?.id) {
void dossier.load(dossier.aluno.id);
void audit.fetch(dossier.aluno.id, dossier.aluno.matricula_id);
}
}, [dossier, audit]);

const checkout = useCheckout({
escolaId, aluno: dossier.aluno, carrinho, onSuccess: onCheckoutSuccess,
});

// selectedAlunoId externo (ex: navegação programática)
useEffect(() => {
if (!selectedAlunoId) { dossier.clear(); return; }
search.clear();
void dossier.load(selectedAlunoId);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [selectedAlunoId]);

// Audit quando o aluno muda
useEffect(() => {
if (dossier.aluno?.id) void audit.fetch(dossier.aluno.id, dossier.aluno.matricula_id);
else audit.setOpen(false);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [dossier.aluno?.id]);

// Decisão de serviço (modal ou directo)
const handleDecision = useCallback((decision: BalcaoDecision, servicoOverride?: Servico) => {
const servico = servicoOverride ?? servicos.find(s => s.codigo === decision.servico_codigo);

if (decision.decision === "BLOCKED") {
  setBloqueioInfo({ code: decision.reason_code, detail: decision.reason_detail ?? undefined });
  if (dossier.aluno?.id) void audit.fetch(dossier.aluno.id, dossier.aluno.matricula_id);
  return;
}

if (!servico) { error("Serviço não encontrado."); return; }
const docTipo = getDocTipo(servico);

if (decision.decision === "GRANTED") {
  carrinho.adicionar({ ...servico, preco: 0, documento_tipo: docTipo, pedido_id: decision.pedido_id });
  if (dossier.aluno?.id) void audit.fetch(dossier.aluno.id, dossier.aluno.matricula_id);
  return;
}

carrinho.adicionar({
  ...servico,
  preco:               decision.amounts?.total ?? servico.preco,
  documento_tipo:      docTipo,
  pedido_id:           decision.pedido_id,
  pagamento_intent_id: decision.payment_intent_id,
});

}, [servicos, carrinho, dossier.aluno, audit, error]);

const handleAdicionarServico = useCallback(async (servico: Servico) => {
if (!dossier.aluno?.id) { error("Aluno não seleccionado."); return; }
setAddingServicoId(servico.id);
try {
const { data, error: rpcError } = await supabase.rpc("balcao_criar_pedido_e_decidir", {
p_servico_codigo: servico.codigo,
p_aluno_id:       dossier.aluno.id,
p_contexto:       {},
});
if (rpcError || !data) throw new Error(rpcError?.message || "Erro ao criar pedido.");
handleDecision({ ...(data as object), servico_codigo: servico.codigo } as BalcaoDecision, servico);
} catch (err: any) {
error(err.message || "Erro ao adicionar serviço.");
} finally {
setAddingServicoId(null);
}
}, [dossier.aluno, supabase, handleDecision, error]);

return (
<>
<div className={embedded ? "" : "min-h-screen bg-slate-50"}>
<div className={embedded ? "" : "mx-auto max-w-screen-2xl px-6 py-6"}>
<div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* Coluna esquerda */}
        <div className="xl:col-span-8 space-y-5">

          {showSearch && (
            <SearchCard
              searchTerm={search.searchTerm}
              setSearchTerm={search.setSearchTerm}
              alunosEncontrados={search.alunosEncontrados}
              isSearching={search.isSearching}
              clear={search.clear}
              onSelect={id => void dossier.load(id)}
            />
          )}

          {dossier.loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12
              flex flex-col items-center justify-center gap-3 min-h-[280px]">
              <Loader2 className="h-8 w-8 animate-spin text-[#E3B23C]" />
              <p className="text-sm text-slate-400">A carregar ficha do aluno...</p>
            </div>
          ) : dossier.aluno ? (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
              <AlunoCard aluno={dossier.aluno} />
              <Catalogo
                mensalidades={dossier.mensalidades}
                servicos={servicos}
                onAdicionarMensalidade={carrinho.adicionar}
                onAdicionarServico={handleAdicionarServico}
                emittingDocId={checkout.emittingDocId}
                addingServicoId={addingServicoId}
                onServicoAvulso={() => {
                  setServicoModalCodigo(null);
                  setServicoModalOpen(true);
                }}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
              <div className="mx-auto h-14 w-14 rounded-full bg-slate-50
                flex items-center justify-center mb-4">
                <Search className="h-7 w-7 text-slate-300" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Balcão de Atendimento</h3>
              <p className="mt-1 text-sm text-slate-400 max-w-sm mx-auto">
                Pesquise um aluno para iniciar o atendimento.
              </p>
            </div>
          )}
        </div>

        {/* Coluna direita */}
        <div className="xl:col-span-4 space-y-4">

          {/* Feedback de pagamento */}
          {checkout.feedback && (
            <div className={`p-4 rounded-xl border flex items-start gap-3
              animate-in slide-in-from-top-2 duration-200 ${
              checkout.feedback.type === "success"
                ? "bg-[#1F6B3B]/5 border-[#1F6B3B]/20 text-[#1F6B3B]"
                : "bg-rose-50 border-rose-200 text-rose-700"}`}>
              {checkout.feedback.type === "success"
                ? <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              }
              <p className="flex-1 text-sm font-medium">{checkout.feedback.message}</p>
              <button onClick={() => checkout.setFeedback(null)}>
                <X className="h-4 w-4 opacity-40 hover:opacity-100" />
              </button>
            </div>
          )}

          {/* Documentos prontos */}
          {checkout.printQueue.length > 0 && (
            <div className="rounded-xl border border-[#1F6B3B]/20 bg-[#1F6B3B]/5 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1F6B3B] mb-2">
                Documentos prontos
              </p>
              <div className="space-y-1.5">
                {checkout.printQueue.map((doc, i) => (
                  <button key={`${doc.url}-${i}`}
                    onClick={() => window.open(doc.url, "_blank", "noopener,noreferrer")}
                    className="w-full rounded-lg border border-[#1F6B3B]/20 bg-white
                      px-3 py-2 text-left text-xs font-semibold text-[#1F6B3B]
                      hover:bg-[#1F6B3B]/5 transition-colors">
                    Abrir {doc.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <CarrinhoPanel
            carrinho={carrinho}
            checkout={checkout}
            audit={audit}
            aluno={dossier.aluno}
          />
        </div>

      </div>
    </div>
  </div>

  <BalcaoServicoModal
    open={servicoModalOpen}
    onClose={() => setServicoModalOpen(false)}
    alunoId={dossier.aluno?.id ?? null}
    servicos={servicos}
    initialCodigo={servicoModalCodigo}
    onDecision={decision => {
      setServicoModalOpen(false);
      handleDecision(decision);
    }}
  />
  <MotivoBloqueioModal
    open={!!bloqueioInfo}
    onClose={() => setBloqueioInfo(null)}
    reasonCode={bloqueioInfo?.code ?? ""}
    reasonDetail={bloqueioInfo?.detail ?? null}
  />
</>

);
}

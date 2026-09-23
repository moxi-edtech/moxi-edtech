"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Activity, ArrowRight, AlertTriangle, CheckCircle2, Eye, ExternalLink } from "lucide-react";
import { useEscolaId } from "@/hooks/useEscolaId";
import { familyBadgeClasses, familyLabel, toFeedSubline, type ActivityFeedItem } from "@/lib/admin/activityFeed";
import { useAdminActivityFeed } from "./useAdminActivityFeed";
import { useOperationalActivityFeed } from "./useOperationalActivityFeed";
import { buildPortalHref } from "@/lib/navigation";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/Button";
import { 
  User, 
  Users, 
  Calendar, 
  CreditCard, 
  FileCheck, 
  Info, 
  ChevronDown, 
  ChevronUp,
  Hash,
  FileText as FileIcon,
  Banknote
} from "lucide-react";

type Props = {
  escolaId: string;
  portalBase?: "admin" | "operacoes";
};

function formatTime(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "--:--";
  return dt.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

function getActivityAction(item: ActivityFeedItem, escolaParam: string) {
  const payload = (item.payload || {}) as Record<string, unknown>;
  const turmaId = typeof payload.turma_id === "string" ? payload.turma_id : null;
  const avaliacaoId = typeof payload.avaliacao_id === "string" ? payload.avaliacao_id : null;

  if (item.event_type === "NOTA_LANCADA_BATCH" && turmaId) {
    const params = new URLSearchParams({ turma_id: turmaId });
    if (avaliacaoId) params.set("avaliacao_id", avaliacaoId);
    return {
      href: buildPortalHref(escolaParam, `/admin/notas?${params.toString()}`),
      label: "Ver pauta",
    };
  }

  if (item.event_type === "PAUTA_FECHADA" && turmaId) {
    return {
      href: buildPortalHref(escolaParam, `/admin/notas?turma_id=${encodeURIComponent(turmaId)}`),
      label: "Ver pauta fechada",
    };
  }

  return null;
}

function getActivityPriority(item: ActivityFeedItem): "urgente" | "importante" | "informativa" {
  const payload = (item.payload || {}) as Record<string, unknown>;
  if (payload.critical === true || item.event_type.includes("ERRO") || item.event_type.includes("FALHA")) {
    return "urgente";
  }
  if (["NOTA_LANCADA_BATCH", "PAUTA_FECHADA", "PAGAMENTO_REGISTRADO", "ADMISSAO_CONVERTIDA_MATRICULA"].includes(item.event_type)) {
    return "importante";
  }
  return "informativa";
}

const priorityStyles = {
  urgente: "bg-rose-50 text-rose-700 ring-rose-200",
  importante: "bg-amber-50 text-amber-700 ring-amber-200",
  informativa: "bg-slate-50 text-slate-500 ring-slate-200",
} as const;

type PayloadDetail = {
  label: string;
  value: React.ReactNode;
  icon: React.ElementType;
};

function payloadDetails(item: ActivityFeedItem): PayloadDetail[] {
  const p = (item.payload || {}) as Record<string, any>;
  return [
    { label: "Aluno", value: item.aluno_nome || p.aluno_nome || p.nome_aluno, icon: User },
    { label: "Turma", value: item.turma_nome || p.turma_nome || p.nome_turma, icon: Users },
    { label: "Valor", value: item.amount_kz ? `${item.amount_kz.toLocaleString("pt-PT")} KZ` : p.valor_formatado || p.valor, icon: Banknote },
    { label: "Referência", value: p.mes_referencia || p.referencia || p.periodo_nome, icon: Calendar },
    { label: "Documento", value: p.tipo_documento || p.documento_nome || p.documento, icon: FileIcon },
    { label: "Método", value: p.metodo_pagamento || p.pago_via || p.forma_pagamento, icon: CreditCard },
    { label: "Cód. Referência", value: p.referencia_pagamento || p.codigo || p.id_externo, icon: Hash },
    { label: "Disciplina", value: p.disciplina_nome || p.materia, icon: FileCheck },
  ].filter(d => !!d.value);
}

function ActivityPayloadDetails({
  item,
  variant = "default",
}: {
  item: ActivityFeedItem;
  variant?: "default" | "discreet";
}) {
  const [showRaw, setShowRaw] = useState(false);
  const p = (item.payload || {}) as Record<string, any>;
  const details = payloadDetails(item);
  const discreet = variant === "discreet";

  return (
    <div className={discreet ? "space-y-3" : "space-y-6"}>
      {details.length > 0 ? (
        discreet ? (
          // Variante discreta (operações): pares chave/valor numa lista, sem cartão
          // por linha nem ícone — o detalhe herda o ritmo do feed em vez de o imitar.
          <dl className="divide-y divide-slate-50">
            {details.map((d, i) => (
              <div key={i} className="flex items-baseline gap-4 py-1.5">
                <dt className="w-28 shrink-0 text-[11px] font-medium text-slate-400">{d.label}</dt>
                <dd className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700">{d.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {details.map((d, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
                  <d.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{d.label}</p>
                  <p className="truncate text-sm font-bold text-slate-900">{d.value}</p>
                </div>
              </div>
            ))}
          </div>
        )
      ) : discreet ? (
        <p className="text-xs text-slate-400">Sem detalhes adicionais.</p>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center">
          <Info className="mx-auto h-6 w-6 text-slate-300 mb-2" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sem detalhes adicionais</p>
        </div>
      )}

      {discreet ? (
        <div>
          <button
            type="button"
            onClick={() => setShowRaw(!showRaw)}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400 transition-colors hover:text-slate-600"
          >
            <span>Metadados técnicos</span>
            {showRaw ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          {showRaw && (
            <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-slate-50 p-3 font-mono text-[10px] text-slate-600">
              {JSON.stringify(p, null, 2)}
            </pre>
          )}
        </div>
      ) : (
        <div className="pt-4 border-t border-slate-100">
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="flex items-center justify-between w-full text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
          >
            <span>Metadados Técnicos</span>
            {showRaw ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          {showRaw && (
            <pre className="mt-3 rounded-xl bg-slate-900 p-4 text-[10px] text-emerald-400 overflow-auto font-mono max-h-60">
              {JSON.stringify(p, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export default function OperationalFeedSection({ escolaId, portalBase = "admin" }: Props) {
  const { escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;
  const adminFeed = useAdminActivityFeed(escolaId, 20);
  const operationalFeed = useOperationalActivityFeed(escolaId, 20);
  const { items, loading, realtimeState } =
    portalBase === "operacoes" ? operationalFeed : adminFeed;
  const [selectedItem, setSelectedAction] = useState<ActivityFeedItem | null>(null);
  const [viewType, setViewType] = useState<"validate" | "details">("details");
  const [newItem, setNewItem] = useState<ActivityFeedItem | null>(null);
  const [newCount, setNewCount] = useState(0);
  // Só operações: o detalhe abre em linha, dentro do próprio item. Um de cada vez —
  // é o que permite comparar sem perder a lista de vista.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const knownIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (loading) return;
    const currentIds = new Set(items.map((item) => item.id));
    if (!knownIdsRef.current) {
      knownIdsRef.current = currentIds;
      return;
    }
    const added = items.filter((item) => !knownIdsRef.current?.has(item.id));
    if (added.length > 0) {
      setNewItem(added[0]);
      setNewCount((count) => count + added.length);
    }
    knownIdsRef.current = currentIds;
  }, [items, loading]);

  const handleAction = (item: ActivityFeedItem, type: "validate" | "details") => {
    setViewType(type);
    setSelectedAction(item);
  };

  const toggleExpanded = (id: string) =>
    setExpandedId((current) => (current === id ? null : id));

  const isOperacoes = portalBase === "operacoes";

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      {isOperacoes ? (
        // Versão discreta (só operações): sem o selo escuro do cabeçalho, título
        // em minúsculas e um ponto de estado em vez de um bloco de cor.
        <header className="mb-2 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-xs font-bold uppercase tracking-widest text-slate-500">
              Fila operacional
            </h3>
            {realtimeState === "live" ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 text-[10px] font-medium text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                ao vivo
              </span>
            ) : null}
          </div>

          <Link
            href={buildPortalHref(escolaParam, "/operacoes/alertas")}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald transition-colors hover:bg-emerald-50"
          >
            Abrir fila <ArrowRight className="h-3 w-3" />
          </Link>
        </header>
      ) : (
        <header className="mb-6 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="rounded-lg bg-slate-900 p-2 text-white shadow-sm">
              <Activity className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-black text-slate-900 tracking-tight uppercase">Fila Operacional</h3>
              <p className="truncate text-[10px] font-bold text-slate-400 uppercase">Acções pendentes e actividade</p>
            </div>
          </div>

          <Link
            href={buildPortalHref(escolaParam, "/admin/relatorios")}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wider text-emerald hover:bg-emerald-50 transition-colors"
          >
            Histórico <ArrowRight className="h-3 w-3" />
          </Link>
        </header>
      )}

      {newItem && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-emerald/20 bg-emerald/5 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald">
              Nova actividade{newCount > 1 ? ` · ${newCount} novidades` : ""}
            </p>
            <p className="truncate text-sm font-bold text-slate-900">{newItem.headline}</p>
            <p className="truncate text-xs text-slate-500">{toFeedSubline(newItem) || "Acção registada no sistema."}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {getActivityAction(newItem, escolaParam) && (
              <Link
                href={getActivityAction(newItem, escolaParam)!.href}
                onClick={() => { setNewItem(null); setNewCount(0); }}
                className="rounded-lg bg-emerald px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white hover:bg-emerald/90"
              >
                {getActivityAction(newItem, escolaParam)!.label}
              </Link>
            )}
            <button
              type="button"
              onClick={() => { setNewItem(null); setNewCount(0); }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50"
            >
              Entendi
            </button>
          </div>
        </div>
      )}

      {realtimeState === "polling" && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-bold uppercase text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>A verificar novidades automaticamente</span>
        </div>
      )}

      {loading ? (
        <ul className="space-y-3">
          {Array.from({ length: 5 }).map((_, idx) => (
            <li key={idx} className="animate-pulse rounded-xl border border-slate-50 p-4">
              <div className="mb-2 h-2.5 w-12 rounded bg-slate-100" />
              <div className="mb-2 h-3 w-3/4 rounded bg-slate-100" />
              <div className="h-8 w-full rounded-xl bg-slate-50" />
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sem actividade recente</p>
        </div>
      ) : (
        <ul className={isOperacoes ? "max-h-[400px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200" : "space-y-3"}>
          {items.slice(0, 8).map((item) => {
            const isDocument = item.event_family === "documentos";
            const canValidate = isDocument && item.event_type?.includes("enviado");
            const activityAction = getActivityAction(item, escolaParam);
            const priority = getActivityPriority(item);

            return (
              <li
                key={item.id}
                className={
                  isOperacoes
                    ? "group border-b border-slate-100 py-3 last:border-0"
                    : "group rounded-xl border border-slate-50 bg-white p-3 shadow-sm transition-all hover:border-slate-200 hover:shadow-md"
                }
              >
                <div className="flex items-start gap-3">
                  {isOperacoes ? (
                    // Sem cartão por linha nem barra de cor: a hora alinha com o texto
                    // e o evento lê-se como uma linha da lista.
                    <span className="w-10 shrink-0 pt-0.5 text-[11px] font-semibold tabular-nums text-slate-400">
                      {formatTime(item.occurred_at)}
                    </span>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-black text-slate-400">{formatTime(item.occurred_at)}</span>
                      <div className={`w-1 h-8 rounded-full ${item.event_family === 'financeiro' ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-md px-1.5 py-0.5 uppercase ${
                          isOperacoes
                            ? `text-[10px] font-semibold tracking-wide ${familyBadgeClasses(item.event_family)}`
                            : `text-[9px] font-black tracking-tighter ${familyBadgeClasses(item.event_family)}`
                        }`}
                      >
                        {familyLabel(item.event_family)}
                      </span>
                      <p className="truncate text-sm font-bold text-slate-900 group-hover:text-emerald transition-colors">{item.headline}</p>
                      {/* A prioridade continua a ser dita — só deixa de ser um segundo selo com anel. */}
                      <span
                        className={
                          isOperacoes
                            ? "text-[10px] font-medium uppercase text-slate-400"
                            : `rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ring-1 ${priorityStyles[priority]}`
                        }
                      >
                        {priority}
                      </span>
                    </div>
                    {toFeedSubline(item) && (
                      <p className="truncate text-xs font-medium text-slate-500 mb-3">{toFeedSubline(item)}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 transition-opacity">
                      {canValidate && (
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className={
                            isOperacoes
                              ? "h-7 bg-emerald/10 px-2.5 text-xs font-semibold text-emerald hover:bg-emerald/15"
                              : "h-7 px-2 text-[10px] font-black uppercase tracking-wider bg-emerald text-white hover:bg-emerald/90"
                          }
                          onClick={() => handleAction(item, "validate")}
                        >
                          <CheckCircle2 className="mr-1.5 h-3 w-3" /> {isOperacoes ? "Validar" : "Validar Rápido"}
                        </Button>
                      )}
                      {activityAction && (
                        <Link
                          href={activityAction.href}
                          className={
                            isOperacoes
                              ? "inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-semibold text-emerald hover:bg-emerald/10"
                              : "inline-flex h-7 items-center gap-1 rounded-md border border-emerald/20 bg-emerald/5 px-2 text-[10px] font-black uppercase tracking-wider text-emerald hover:bg-emerald/10"
                          }
                        >
                          {activityAction.label} <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                      {isOperacoes ? (
                        // Expande em linha em vez de abrir o drawer: o detalhe fica
                        // debaixo do próprio evento e a lista continua à vista.
                        <button
                          type="button"
                          aria-expanded={expandedId === item.id}
                          onClick={() => toggleExpanded(item.id)}
                          className="inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                        >
                          {expandedId === item.id ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                          {expandedId === item.id ? "Fechar" : "Detalhes"}
                        </button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[10px] font-black uppercase tracking-wider border-slate-200 text-slate-600"
                          onClick={() => handleAction(item, "details")}
                        >
                          <Eye className="mr-1.5 h-3 w-3" /> Detalhes
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {isOperacoes && expandedId === item.id && (
                  // Alinha com a coluna do texto (hora w-10 + gap-3 = 52px) em ecrã
                  // largo; em telemóvel ocupa a largura toda.
                  <div className="mt-3 border-t border-slate-100 pt-3 sm:pl-[52px]">
                    <ActivityPayloadDetails item={item} variant="discreet" />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Sheet open={!!selectedItem} onOpenChange={(open) => !open && setSelectedAction(null)}>
        <SheetContent side="right" className="sm:max-w-xl">
          <SheetHeader className="border-b border-slate-100 pb-4 mb-6">
            <SheetTitle className="flex items-center gap-2 text-xl font-black tracking-tight">
              {viewType === "validate" ? <CheckCircle2 className="h-5 w-5 text-emerald" /> : <Activity className="h-5 w-5 text-slate-400" />}
              {viewType === "validate" ? "Validação Expressa" : "Detalhes do Evento"}
            </SheetTitle>
            <SheetDescription>
              {selectedItem?.headline}
            </SheetDescription>
          </SheetHeader>

          {selectedItem && (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Data/Hora</p>
                    <p className="text-sm font-bold text-slate-900">{new Date(selectedItem.occurred_at).toLocaleString('pt-PT')}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Categoria</p>
                    <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase ${familyBadgeClasses(selectedItem.event_family)}`}>
                      {familyLabel(selectedItem.event_family)}
                    </span>
                  </div>
                </div>
              </div>

              {viewType === "validate" ? (
                <div className="space-y-6">
                   <div className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-200 bg-slate-100">
                      <div className="text-center p-8">
                        <Activity className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Pré-visualização do Comprovativo</p>
                        <p className="text-[10px] text-slate-400 mt-2 font-medium">O ficheiro PDF/Imagem será renderizado aqui.</p>
                      </div>
                   </div>
                   
                   <div className="flex items-center gap-3">
                     <Button className="flex-1 bg-emerald text-white font-black uppercase tracking-widest h-12 shadow-lg shadow-emerald-200">
                       Aprovar Documento
                     </Button>
                     <Button variant="outline" className="flex-1 border-rose-200 text-rose-600 font-black uppercase tracking-widest h-12 hover:bg-rose-50">
                       Rejeitar
                     </Button>
                   </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <ActivityPayloadDetails item={selectedItem} />
                  
                  <Button variant="outline" className="w-full h-11 border-slate-200 text-slate-900 font-bold uppercase tracking-widest gap-2">
                    Ver Contexto Completo <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { Activity, ArrowRight, AlertTriangle, CheckCircle2, Eye, ExternalLink } from "lucide-react";
import { useEscolaId } from "@/hooks/useEscolaId";
import { familyBadgeClasses, familyLabel, toFeedSubline, type ActivityFeedItem } from "@/lib/admin/activityFeed";
import { useAdminActivityFeed } from "./useAdminActivityFeed";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/Button";

type Props = {
  escolaId: string;
};

function formatTime(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "--:--";
  return dt.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

export default function OperationalFeedSection({ escolaId }: Props) {
  const { escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;
  const { items, loading, realtimeState } = useAdminActivityFeed(escolaId, 20);
  const [selectedItem, setSelectedAction] = useState<ActivityFeedItem | null>(null);
  const [viewType, setViewType] = useState<"validate" | "details">("details");

  const handleAction = (item: ActivityFeedItem, type: "validate" | "details") => {
    setViewType(type);
    setSelectedAction(item);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="rounded-xl bg-slate-900 p-2 text-white shadow-md">
            <Activity className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-black text-slate-900 tracking-tight uppercase tracking-widest">Fila Operacional</h3>
            <p className="truncate text-[10px] font-bold text-slate-400 uppercase">Acções pendentes e actividade</p>
          </div>
        </div>

        <Link
          href={`/escola/${escolaParam}/admin/relatorios`}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wider text-klasse-green hover:bg-emerald-50 transition-colors"
        >
          Histórico <ArrowRight className="h-3 w-3" />
        </Link>
      </header>

      {realtimeState === "polling" && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-700 uppercase">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Actualização via Polling</span>
        </div>
      )}

      {loading ? (
        <ul className="space-y-3">
          {Array.from({ length: 5 }).map((_, idx) => (
            <li key={idx} className="animate-pulse rounded-2xl border border-slate-50 p-4">
              <div className="mb-2 h-2.5 w-12 rounded bg-slate-100" />
              <div className="mb-2 h-3 w-3/4 rounded bg-slate-100" />
              <div className="h-8 w-full rounded-xl bg-slate-50" />
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sem actividade recente</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.slice(0, 8).map((item) => {
            const isDocument = item.event_family === "documentos";
            const canValidate = isDocument && item.event_type.includes("enviado");

            return (
              <li key={item.id} className="group rounded-2xl border border-slate-50 bg-white p-3 transition-all hover:border-slate-200 hover:shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-black text-slate-400">{formatTime(item.occurred_at)}</span>
                    <div className={`w-1 h-8 rounded-full ${item.event_family === 'financeiro' ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-tighter ${familyBadgeClasses(item.event_family)}`}>
                        {familyLabel(item.event_family)}
                      </span>
                      <p className="truncate text-sm font-bold text-slate-900 group-hover:text-klasse-green transition-colors">{item.headline}</p>
                    </div>
                    {toFeedSubline(item) && (
                      <p className="truncate text-xs font-medium text-slate-500 mb-3">{toFeedSubline(item)}</p>
                    )}

                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {canValidate && (
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="h-7 px-2 text-[10px] font-black uppercase tracking-wider bg-klasse-green text-white hover:bg-klasse-green/90"
                          onClick={() => handleAction(item, "validate")}
                        >
                          <CheckCircle2 className="mr-1.5 h-3 w-3" /> Validar Rápido
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 px-2 text-[10px] font-black uppercase tracking-wider border-slate-200 text-slate-600"
                        onClick={() => handleAction(item, "details")}
                      >
                        <Eye className="mr-1.5 h-3 w-3" /> Detalhes
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet open={!!selectedItem} onOpenChange={(open) => !open && setSelectedAction(null)}>
        <SheetContent side="right" className="sm:max-w-xl">
          <SheetHeader className="border-b border-slate-100 pb-4 mb-6">
            <SheetTitle className="flex items-center gap-2 text-xl font-black tracking-tight">
              {viewType === "validate" ? <CheckCircle2 className="h-5 w-5 text-klasse-green" /> : <Activity className="h-5 w-5 text-slate-400" />}
              {viewType === "validate" ? "Validação Expressa" : "Detalhes do Evento"}
            </SheetTitle>
            <SheetDescription>
              {selectedItem?.headline}
            </SheetDescription>
          </SheetHeader>

          {selectedItem && (
            <div className="space-y-6">
              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
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
                   <div className="aspect-[3/4] w-full rounded-2xl border-2 border-dashed border-slate-200 bg-slate-100 flex items-center justify-center relative overflow-hidden">
                      <div className="text-center p-8">
                        <Activity className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Pré-visualização do Comprovativo</p>
                        <p className="text-[10px] text-slate-400 mt-2 font-medium">O ficheiro PDF/Imagem será renderizado aqui.</p>
                      </div>
                   </div>
                   
                   <div className="flex items-center gap-3">
                     <Button className="flex-1 bg-klasse-green text-white font-black uppercase tracking-widest h-12 shadow-lg shadow-emerald-200">
                       Aprovar Documento
                     </Button>
                     <Button variant="outline" className="flex-1 border-rose-200 text-rose-600 font-black uppercase tracking-widest h-12 hover:bg-rose-50">
                       Rejeitar
                     </Button>
                   </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Metadados do Evento</p>
                    <pre className="rounded-xl bg-slate-900 p-4 text-[10px] text-emerald-400 overflow-auto font-mono">
                      {JSON.stringify(selectedItem.payload, null, 2)}
                    </pre>
                  </div>
                  
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

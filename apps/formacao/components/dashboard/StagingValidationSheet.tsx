"use client";

import { useState, useTransition, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Search,
  ChevronRight,
  Info,
  CreditCard,
  User,
  GraduationCap,
} from "lucide-react";
import { DocumentPreview } from "./DocumentPreview";
import {
  aprovarInscricaoAction,
  rejeitarInscricaoAction,
} from "@/app/actions/secretaria-actions";
import { toast } from "@/lib/toast";

type PagamentoItem = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  comprovativo_url: string | null;
  curso_nome: string;
  cohort_nome: string;
  valor_referencia: number;
  moeda: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialId?: string | null;
};

export function StagingValidationSheet({ isOpen, onClose, onSuccess, initialId }: Props) {
  const [items, setItems] = useState<PagamentoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initialId || null);
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadItems();
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialId) setSelectedId(initialId);
  }, [initialId]);

  async function loadItems() {
    setLoading(true);
    try {
      const response = await fetch("/api/formacao/secretaria/inbox");
      const json = await response.json();
      if (json.ok) {
        setItems(json.pagamentos || []);
        if (json.pagamentos?.length > 0 && !selectedId) {
          setSelectedId(json.pagamentos[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const selectedItem = items.find((i) => i.id === selectedId);

  async function handleAprovar() {
    if (!selectedId) return;
    const formData = new FormData();
    formData.append("id", selectedId);

    startTransition(async () => {
      const result = await aprovarInscricaoAction(formData);
      if (result.success) {
        toast({ title: "Acesso libertado", description: result.message });
        loadItems();
        onSuccess?.();
      } else {
        toast({ title: "Erro na aprovação", description: result.error, variant: "destructive" });
      }
    });
  }

  async function handleRejeitar() {
    if (!selectedId) return;
    const motivo = window.prompt("Motivo da rejeição (mínimo 5 caracteres):");
    if (!motivo || motivo.trim().length < 5) return;

    const formData = new FormData();
    formData.append("id", selectedId);
    formData.append("motivo", motivo);

    startTransition(async () => {
      const result = await rejeitarInscricaoAction(formData);
      if (result.success) {
        toast({ title: "Inscrição rejeitada", description: result.message });
        loadItems();
        onSuccess?.();
      } else {
        toast({ title: "Erro", description: result.error, variant: "destructive" });
      }
    });
  }

  const filteredItems = items.filter(i => 
    i.nome.toLowerCase().includes(query.toLowerCase()) || 
    i.curso_nome.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full p-0 sm:max-w-[800px]">
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-slate-100 p-6">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <CreditCard size={18} />
              </div>
              <div>
                <SheetTitle className="text-xl font-black">Validação de Comprovativos</SheetTitle>
                <SheetDescription>Aprove ou rejeite inscrições pendentes rapidamente.</SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="flex flex-1 overflow-hidden">
            {/* List Side */}
            <div className="flex w-[300px] flex-col border-r border-slate-100 bg-slate-50/50">
              <div className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Filtrar fila..."
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-slate-400"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                    <Loader2 size={24} className="animate-spin" />
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="p-8 text-center">
                    <CheckCircle2 size={32} className="mx-auto text-emerald-500 opacity-20" />
                    <p className="mt-2 text-xs font-bold text-slate-400 uppercase tracking-widest">Tudo Validado</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        className={`flex w-full flex-col p-4 text-left transition-colors hover:bg-white ${
                          selectedId === item.id ? "bg-white ring-1 ring-inset ring-slate-200" : ""
                        }`}
                      >
                        <p className={`text-sm font-bold ${selectedId === item.id ? "text-slate-900" : "text-slate-600"}`}>
                          {item.nome}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] font-medium text-slate-400 uppercase tracking-tighter">
                          {item.curso_nome}
                        </p>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-black text-slate-500">
                            {new Intl.NumberFormat("pt-AO", { style: "currency", currency: item.moeda }).format(item.valor_referencia)}
                          </span>
                          {selectedId === item.id && <ChevronRight size={14} className="text-slate-400" />}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Content Side */}
            <div className="flex flex-1 flex-col overflow-y-auto bg-white p-6">
              {selectedItem ? (
                <div className="space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="text-lg font-black text-slate-900">{selectedItem.nome}</h3>
                      <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
                        <span className="flex items-center gap-1"><User size={12} /> {selectedItem.email || "Sem email"}</span>
                        <span className="flex items-center gap-1"><GraduationCap size={12} /> {selectedItem.cohort_nome}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Documento de Pagamento</p>
                    </div>
                    <DocumentPreview url={selectedItem.comprovativo_url || ""} className="aspect-[4/3] w-full" />
                  </div>

                  <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                    <div className="flex gap-3">
                      <Info className="shrink-0 text-blue-500" size={18} />
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-blue-900 uppercase tracking-tight">Verificação Sugerida</p>
                        <p className="text-xs leading-relaxed text-blue-700/80">
                          Verifique se o nome no comprovativo coincide com o do formando e se o valor de{" "}
                          <span className="font-bold">{new Intl.NumberFormat("pt-AO", { style: "currency", currency: selectedItem.moeda }).format(selectedItem.valor_referencia)}</span>{" "}
                          está correto antes de libertar o acesso.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <button
                      onClick={handleRejeitar}
                      disabled={isPending}
                      className="flex h-12 items-center justify-center gap-2 rounded-xl border border-rose-200 font-bold text-rose-600 transition-all hover:bg-rose-50 disabled:opacity-50"
                    >
                      <XCircle size={18} /> Rejeitar
                    </button>
                    <button
                      onClick={handleAprovar}
                      disabled={isPending}
                      className="flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-900 font-bold text-white transition-all hover:bg-slate-800 disabled:opacity-50 shadow-lg shadow-slate-200"
                    >
                      {isPending ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                      Libertar Acesso
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 text-slate-200">
                    <CreditCard size={32} />
                  </div>
                  <p className="mt-4 text-sm font-bold text-slate-400 uppercase tracking-widest">Selecione um item na fila</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

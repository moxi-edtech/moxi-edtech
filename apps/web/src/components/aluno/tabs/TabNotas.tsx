"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { AlunoCard } from "@/components/aluno/shared/AlunoCard";
import { SectionTitle } from "@/components/aluno/shared/SectionTitle";
import { Lock as LockIcon, FileText, ChevronRight, AlertCircle, Loader2, Calculator } from "lucide-react";
import Link from "next/link";
import { SimuladorNotasModal } from "@/components/aluno/academico/SimuladorNotasModal";

type Disciplina = {
  id: string;
  nome: string;
  nota_t1?: number | null;
  nota_t2?: number | null;
  nota_t3?: number | null;
  nota_final?: number | null;
  faltas?: number;
};

type BoletimResponse = {
  ok: boolean;
  is_liberado: boolean;
  nome_aluno?: string | null;
  disciplinas: Disciplina[];
};

type ListaDisciplina = { id: string; nome: string };

function fmtNota(v?: number | null) {
  return typeof v === "number" ? v.toFixed(1) : "—";
}

function finalStatus(nota?: number | null) {
  if (typeof nota !== "number") return { label: "Pendente", cls: "bg-slate-100 text-slate-700" };
  return nota >= 10
    ? { label: "Aprovado", cls: "bg-klasse-green-100 text-klasse-green-700" }
    : { label: "Reprovado", cls: "bg-red-100 text-red-700" };
}

export function TabNotas() {
  const searchParams = useSearchParams();
  const studentId = useMemo(() => searchParams?.get("aluno") ?? null, [searchParams]);
  const [loading, setLoading] = useState(true);
  const [isLiberado, setIsLiberado] = useState(false);
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [listaDisciplinas, setListaDisciplinas] = useState<ListaDisciplina[]>([]);
  const [loadingLista, setLoadingLista] = useState(true);
  const [isSimuladorOpen, setIsSimuladorOpen] = useState(false);

  const query = studentId ? `?aluno=${studentId}` : "";

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/aluno/boletim${studentId ? `?studentId=${studentId}` : ""}`, { cache: "no-store", signal: ctrl.signal })
      .then((r) => r.json() as Promise<BoletimResponse>)
      .then((json) => {
          setDisciplinas(json.disciplinas ?? []);
          setIsLiberado(json.is_liberado);
      })
      .catch((error) => {
        if (error?.name !== "AbortError") {
          setDisciplinas([]);
        }
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [studentId]);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoadingLista(true);
    fetch("/api/aluno/disciplinas", { cache: "no-store", signal: ctrl.signal })
      .then((r) => r.json() as Promise<{ disciplinas?: ListaDisciplina[] }>)
      .then((json) => setListaDisciplinas(json.disciplinas ?? []))
      .catch((error) => {
        if (error?.name !== "AbortError") {
          setListaDisciplinas([]);
        }
      })
      .finally(() => setLoadingLista(false));
    return () => ctrl.abort();
  }, []);

  return (
    <div className="space-y-6 pb-8">
      <div className="space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-2 px-1">
            <SectionTitle>Meu Boletim</SectionTitle>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsSimuladorOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold transition-all border border-emerald-200 shadow-sm active:scale-95"
              >
                <Calculator size={14} className="text-emerald-600" /> Simulador de Aprovação
              </button>
              {!loading && !isLiberado && (
                  <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-[10px] font-black uppercase tracking-tight border border-amber-100">
                      <LockIcon size={12} /> Acesso Restrito
                  </span>
              )}
            </div>
        </header>

        {loading ? (
          <div className="h-48 animate-pulse rounded-[2.5rem] bg-slate-100" />
        ) : (
          <section className="space-y-3">
            {!isLiberado && (
              <div className="relative mb-5 overflow-hidden rounded-2xl border border-amber-300/80 bg-gradient-to-r from-amber-500/15 via-amber-50 to-amber-100/80 p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-slate-950 shadow-md">
                      <LockIcon size={22} className="animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-black text-slate-950 tracking-tight">
                          Pauta de Notas Publicada pelos Professores
                        </h3>
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/80 bg-amber-400/30 px-2.5 py-0.5 text-[9px] font-black uppercase text-amber-950">
                          🔒 Emolumento Pendente
                        </span>
                      </div>
                      <p className="text-xs font-medium text-slate-700 leading-relaxed max-w-xl">
                        Os professores já lançaram as notas no sistema. Regularize a taxa de secretaria para desbloquear as médias detalhadas e descarregar o Boletim Oficial em PDF com QR Code de autenticidade.
                      </p>
                    </div>
                  </div>

                  <Link 
                    href={`/aluno/documentos${query}`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-xs font-black text-slate-950 shadow-md hover:bg-amber-300 active:scale-95 transition-all shrink-0 self-start sm:self-center"
                  >
                    <span>Desbloquear na Secretaria</span>
                    <ChevronRight size={16} />
                  </Link>
                </div>
              </div>
            )}

            <div className="grid gap-3">
              {disciplinas.map((disc) => {
                const status = finalStatus(disc.nota_final);
                return (
                  <details key={disc.id} className="group rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm transition-all open:ring-2 open:ring-klasse-green/10">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold text-slate-900">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-open:bg-klasse-green-50 group-open:text-klasse-green transition-colors">
                                <FileText size={16} />
                            </div>
                            <span>{disc.nome}</span>
                        </div>
                        <div className="flex items-center gap-2">
                             {!isLiberado && <LockIcon size={12} className="text-slate-300" />}
                             <ChevronRight size={16} className="text-slate-300 transition-transform group-open:rotate-90" />
                        </div>
                    </summary>

                    {isLiberado ? (
                        <div className="mt-5 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                            <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                                <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">1º Trimestre</p>
                                <div className="space-y-1.5 font-medium text-slate-700">
                                    <div className="flex justify-between"><span>MAC:</span> <span>{fmtNota(disc.nota_t1)}</span></div>
                                    <div className="flex justify-between"><span>NPP:</span> <span>{fmtNota(disc.nota_t1)}</span></div>
                                    <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1.5">
                                        <span className="font-bold">Média:</span> <span className="font-bold text-slate-900">{fmtNota(disc.nota_t1)}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                                <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">2º Trimestre</p>
                                <div className="space-y-1.5 font-medium text-slate-700">
                                    <div className="flex justify-between"><span>MAC:</span> <span>{fmtNota(disc.nota_t2)}</span></div>
                                    <div className="flex justify-between"><span>NPP:</span> <span>{fmtNota(disc.nota_t2)}</span></div>
                                    <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1.5">
                                        <span className="font-bold">Média:</span> <span className="font-bold text-slate-900">{fmtNota(disc.nota_t2)}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                                <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">3º Trimestre</p>
                                <div className="space-y-1.5 font-medium text-slate-700">
                                    <div className="flex justify-between"><span>MAC:</span> <span>{fmtNota(disc.nota_t3)}</span></div>
                                    <div className="flex justify-between"><span>NPP:</span> <span>{fmtNota(disc.nota_t3)}</span></div>
                                    <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1.5">
                                        <span className="font-bold">Média:</span> <span className="font-bold text-slate-900">{fmtNota(disc.nota_t3)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="md:col-span-3 mt-2 flex items-center justify-between px-2">
                                <div className="flex flex-col">
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nota Final</p>
                                    <p className="text-xl font-black text-slate-900">{fmtNota(disc.nota_final)}</p>
                                </div>
                                <span className={`rounded-xl px-4 py-1.5 text-xs font-black uppercase tracking-tight shadow-sm ${status.cls}`}>{status.label}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-4 p-4 text-center bg-slate-50/80 rounded-xl border border-dashed border-slate-200">
                            <LockIcon size={20} className="mx-auto text-slate-400 mb-1.5" />
                            <p className="text-xs font-semibold text-slate-600">Efetue o pagamento do boletim para liberar as notas detalhadas.</p>
                            <Link href={`/aluno/documentos${query}`} className="mt-2 inline-flex items-center gap-1 text-xs font-black text-emerald-700 hover:underline">
                                Ir para Secretaria Digital →
                            </Link>
                        </div>
                    )}
                  </details>
                );
              })}
              {disciplinas.length === 0 && <p className="text-sm text-slate-500 text-center py-8">Sem disciplinas no boletim.</p>}
            </div>
          </section>
        )}
      </div>

      <div className="space-y-4">
        <SectionTitle>Minhas Disciplinas</SectionTitle>
        {loadingLista ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
          </div>
        ) : listaDisciplinas.length === 0 ? (
          <AlunoCard>
            <p className="text-sm text-slate-500">Nenhuma disciplina encontrada.</p>
          </AlunoCard>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {listaDisciplinas.map((disc) => (
              <AlunoCard key={disc.id} className="border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                        <FileText size={20} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-900">{disc.nome}</p>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Disciplina Activa</p>
                    </div>
                </div>
              </AlunoCard>
            ))}
          </div>
        )}
      </div>

      {isLiberado && (
        <div className="flex justify-end pt-2">
            <Button asChild tone="green" className="min-h-10 w-full sm:w-auto px-5 rounded-xl font-black text-xs shadow-sm">
                <a href={`/api/aluno/boletim/pdf${studentId ? `?studentId=${studentId}` : ""}`} target="_blank" rel="noreferrer">
                    <Download className="mr-2 h-4 w-4" /> Descarregar Boletim Oficial (PDF)
                </a>
            </Button>
        </div>
      )}

      <SimuladorNotasModal
        isOpen={isSimuladorOpen}
        onClose={() => setIsSimuladorOpen(false)}
        disciplinas={disciplinas}
      />
    </div>
  );
}

function Download({ className, ...props }: any) {
    return <svg {...props} className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M7 10l5 5m0 0l5-5m-5 5V3" /></svg>
}

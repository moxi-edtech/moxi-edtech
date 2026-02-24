"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save, RefreshCw, Calendar, Lock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/feedback/FeedbackSystem";
import { format, parseISO } from "date-fns"; // Recomendo usar date-fns se tiver, senão use helpers nativos abaixo
import { useToast } from "@/components/feedback/FeedbackSystem";

// --- TYPES ---
type Periodo = {
  id: string;
  ano_letivo_id: string;
  tipo: string; // "I Trimestre", "Semestre", etc.
  numero: number;
  data_inicio: string; // YYYY-MM-DD
  data_fim: string;    // YYYY-MM-DD
  trava_notas_em?: string | null; // ISO String
  peso?: number | null;
};

type Props = {
  params: Promise<{ id: string }>;
};

// --- HELPERS (Sem date-fns para não quebrar seu build se não tiver) ---
const toInputDate = (isoString?: string | null) => {
  if (!isoString) return "";
  // Corta o ISO para caber no input datetime-local (YYYY-MM-DDThh:mm)
  return isoString.slice(0, 16);
};

export default function CalendarioConfigPage({ params }: Props) {
  const { id: escolaId } = use(params);
  const base = escolaId ? `/escola/${escolaId}/admin/configuracoes` : "";
  const { toast, dismiss, success, error, warning } = useToast();

  // --- STATE ---
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [anoLetivo, setAnoLetivo] = useState<{ id: string; ano: number } | null>(null);

  // --- CALCULATED ---
  const pesoTotal = useMemo(
    () => periodos.reduce((sum, p) => sum + (Number(p.peso) || 0), 0),
    [periodos]
  );
  
  const isPesoValido = pesoTotal === 100;

  // --- FETCH ---
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/escola/${escolaId}/admin/periodos-letivos`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        
        if (cancelled) return;

        if (res.ok && json?.periodos) {
          setPeriodos(json.periodos);
          setAnoLetivo(json.ano_letivo);
        } else {
          error("Não foi possível carregar os períodos.");
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [escolaId]);

  // --- HANDLERS ---
  const handlePesoChange = (id: string, valor: string) => {
    const num = parseFloat(valor);
    setPeriodos(prev => prev.map(p => 
      p.id === id ? { ...p, peso: isNaN(num) ? null : num } : p
    ));
  };

  const handleTravaChange = (id: string, valor: string) => {
    // O input retorna "2025-04-20T23:59". Salvamos assim ou convertemos com cuidado.
    // Para simplificar e evitar UTC shifts indesejados, vamos manter a string local + timezone Z ou tratar no backend.
    // Aqui assumimos que o backend aceita ISO.
    const isoDate = valor ? new Date(valor).toISOString() : null;
    
    setPeriodos(prev => prev.map(p => 
      p.id === id ? { ...p, trava_notas_em: isoDate } : p
    ));
  };

  const handleSave = async () => {
    if (!anoLetivo) return;
    
    // Validação antes do envio
    if (!isPesoValido) {
      warning(`A soma dos pesos é ${pesoTotal}%. Deve ser exatamente 100%.`);
      // Não bloqueamos o save, mas avisamos (soft lock)
    }

    setSaving(true);
    const promise = fetch(`/api/escola/${escolaId}/admin/periodos-letivos/upsert-bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(periodos), // Enviamos o objeto completo atualizado
    }).then(async res => {
      if (!res.ok) throw new Error("Falha ao salvar");
      
      // Commit do setup (opcional, dependendo da sua arquitetura)
      const commitRes = await fetch(`/api/escola/${escolaId}/admin/setup/commit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ changes: { periodos: periodos.map((p) => p.id) } }),
      });
      const commitJson = await commitRes.json().catch(() => ({}));
      if (!commitRes.ok || commitJson?.ok === false) {
        throw new Error(commitJson?.error || "Falha ao publicar alterações.");
      }
    });

    const tid = toast({ variant: "syncing", title: "Salvando estrutura...", duration: 0 });

    try {
      await promise;
      dismiss(tid);
      success("Calendário atualizado.");
    } catch (err) {
      dismiss(tid);
      error("Erro ao salvar alterações.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        
        {/* HEADER */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href={`${base}?tab=calendario`}
              className="group inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors"
            >
              <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-1" />
              Voltar ao painel
            </Link>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              Calendário Acadêmico
            </h1>
            <p className="text-sm text-slate-500 flex items-center gap-2">
              Ano Letivo Ativo: 
              {anoLetivo ? (
                <span className="font-semibold text-slate-900">{anoLetivo.ano}</span>
              ) : (
                <span className="text-amber-600 font-mono text-xs">-- Carregando --</span>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 rounded-xl bg-klasse-gold px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#D4A32C] hover:shadow-md disabled:opacity-70 disabled:grayscale"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Salvando..." : "Salvar Alterações"}
          </button>
        </div>

        {/* CONTENT */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Skeleton className="h-4 w-40" />
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* SELETOR DE ESTRUTURA (Visual Only por enquanto) */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Estrutura do Ano</h3>
              <div className="flex gap-3">
                {['Trimestres (Padrão)', 'Semestres', 'Bimestres'].map((label) => (
                  <button
                    key={label}
                    disabled
                    className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Para alterar a estrutura base, contate o suporte ou reinicie o setup."
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* LISTA DE PERÍODOS */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex justify-between items-center">
                <h3 className="text-sm font-semibold text-slate-900">Configuração dos Períodos</h3>
                
                {/* VALIDATOR BADGE */}
                <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium border ${
                  isPesoValido 
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700" 
                    : "border-amber-200 bg-amber-50 text-amber-700"
                }`}>
                  {isPesoValido ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                  <span>Total: {pesoTotal}%</span>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {periodos.length === 0 && (
                  <div className="p-8 text-center text-sm text-slate-500">
                    Nenhum período letivo encontrado para este ano.
                  </div>
                )}
                
                {periodos.map((p) => (
                  <div key={p.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50/50 transition-colors">
                    
                    {/* NOME E DATAS */}
                    <div className="md:col-span-5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                          {p.numero}
                        </span>
                        <span className="font-medium text-slate-900">{p.tipo}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 ml-8">
                        <Calendar className="h-3 w-3" />
                        <span>{format(parseISO(p.data_inicio), 'dd/MM')}</span>
                        <span>→</span>
                        <span>{format(parseISO(p.data_fim), 'dd/MM/yyyy')}</span>
                      </div>
                    </div>

                    {/* PESO INPUT */}
                    <div className="md:col-span-3">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                        Peso na Nota Final
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          className="w-full rounded-lg border-slate-200 pl-3 pr-8 text-sm font-semibold text-slate-900 focus:border-klasse-gold focus:ring-klasse-gold"
                          value={p.peso ?? ""}
                          onChange={(e) => handlePesoChange(p.id, e.target.value)}
                          placeholder="0"
                          min="0"
                          max="100"
                        />
                        <span className="absolute right-3 top-2 text-xs text-slate-400">%</span>
                      </div>
                    </div>

                    {/* TRAVA NOTAS INPUT */}
                    <div className="md:col-span-4">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block flex items-center gap-1">
                        <Lock className="h-3 w-3" /> Travar Notas Em
                      </label>
                      <input
                        type="datetime-local"
                        className="w-full rounded-lg border-slate-200 text-xs text-slate-600 focus:border-klasse-gold focus:ring-klasse-gold"
                        value={toInputDate(p.trava_notas_em)}
                        onChange={(e) => handleTravaChange(p.id, e.target.value)}
                      />
                      <p className="mt-1 text-[10px] text-slate-400">
                        Professores não lançam notas após esta data.
                      </p>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

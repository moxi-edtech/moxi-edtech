"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save, RefreshCw, Calendar, Lock, AlertTriangle, CheckCircle2, Wand2, Plus, Trash2, X, ChevronDown } from "lucide-react";
import { Skeleton } from "@/components/feedback/FeedbackSystem";
import { format, parseISO } from "date-fns";
import { useToast, useConfirm } from "@/components/feedback/FeedbackSystem";
import { useEscolaId } from "@/hooks/useEscolaId";
import { fetchPeriodosLetivos } from "@/lib/periodosLetivosClient";
import { buildPortalHref } from "@/lib/navigation";
import { createClient } from "@/lib/supabaseClient";
import { ModalShell } from "@/components/ui/ModalShell";
import type { Database } from "~types/supabase";

// --- TYPES ---
type Periodo = {
  id: string;
  ano_letivo_id: string;
  tipo: string;
  numero: number;
  data_inicio: string;
  data_fim: string;
  trava_notas_em?: string | null;
  peso?: number | null;
};

type EventoTipo = Database['public']['Enums']['tipo_evento_calendario'];

type EventoCalendario = {
  id: string;
  tipo: EventoTipo;
  nome: string;
  data_inicio: string;
  data_fim: string;
  cor_hex?: string | null;
};

type CalendarioTemplate = {
  id: string;
  nome: string;
  ano_base: number;
};

type Props = {
  params: Promise<{ id: string }>;
};

const toInputDate = (isoString?: string | null) => {
  if (!isoString) return "";
  return isoString.slice(0, 16);
};

export default function CalendarioConfigPage({ params }: Props) {
  const { id: escolaIdFromParams } = use(params);
  const { escolaId: escolaUuid, escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaIdFromParams;
  const base = buildPortalHref(escolaParam, "/admin/configuracoes");
  const { toast, dismiss, success, error } = useToast();
  const confirm = useConfirm();
  const supabase = useMemo(() => createClient(), []);

  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'trimestres' | 'eventos'>('trimestres');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [eventos, setEventos] = useState<EventoCalendario[]>([]);
  const [anoLetivo, setAnoLetivo] = useState<{ id: string; ano: number; ativo: boolean; data_inicio: string; data_fim: string } | null>(null);
  const [anosDisponiveis, setAnosDisponiveis] = useState<Array<{ id: string; ano: number; ativo: boolean }>>([]);
  const [selectedAnoId, setSelectedAnoId] = useState<string | null>(null);
  
  // Templates State
  const [templates, setTemplates] = useState<CalendarioTemplate[]>([]);
  const [showTemplateMenu, setShowTemplatesMenu] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    nome: "",
    tipo: "FERIADO" as EventoTipo,
    data_inicio: "",
    data_fim: "",
  });

  // --- FETCH ---
  const loadData = async (targetAnoId?: string) => {
    if (!escolaUuid) return;
    setLoading(true);
    try {
      const [json, templatesRes, anosRes] = await Promise.all([
        fetchPeriodosLetivos(escolaParam, targetAnoId || selectedAnoId || undefined),
        supabase.from('calendario_templates').select('id, nome, ano_base').order('ano_base', { ascending: false }),
        supabase.from('anos_letivos').select('id, ano, ativo, data_inicio, data_fim').eq('escola_id', escolaUuid).order('ano', { ascending: false })
      ]);

      if (!json.error && Array.isArray(json?.periodos)) {
        setPeriodos(json.periodos as Periodo[]);
        setAnoLetivo(json.ano_letivo as any ?? null);
        if (json.ano_letivo?.id && !targetAnoId) setSelectedAnoId(json.ano_letivo.id);

        if (json.ano_letivo?.id) {
          const { data: evs } = await supabase
            .from('calendario_eventos')
            .select('*')
            .eq('ano_letivo_id', json.ano_letivo.id)
            .order('data_inicio', { ascending: true });
          setEventos((evs as EventoCalendario[]) || []);
        }
      }

      if (templatesRes.data) setTemplates(templatesRes.data);
      if (anosRes.data) setAnosDisponiveis(anosRes.data as any);

    } catch (e) {
      console.error(e);
      error("Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (escolaUuid) loadData();
  }, [escolaUuid]);

  const handleAnoChange = (id: string) => {
    setSelectedAnoId(id);
    loadData(id);
  };

  // --- HANDLERS ---
  const handleSetActiveAno = async () => {
    if (!anoLetivo || anoLetivo.ativo || !escolaUuid) return;
    
    const ok = await confirm({
      title: "Activar Ano Lectivo",
      message: `Tem certeza que deseja ativar o Ano Lectivo ${anoLetivo.ano} como o principal da escola? Esta acção impacta os dashboards e acessos de todos os portais.`,
      confirmLabel: "Activar agora",
    });
    if (!ok) return;

    setSaving(true);
    const tid = toast({ variant: "syncing", title: "A ativar ano...", duration: 0 });
    try {
      const { error: err } = await supabase.rpc('setup_active_ano_letivo', {
        p_escola_id: escolaUuid,
        p_ano_data: {
          id: anoLetivo.id,
          ano: anoLetivo.ano,
          data_inicio: anoLetivo.data_inicio,
          data_fim: anoLetivo.data_fim,
          ativo: true
        }
      });

      if (err) throw err;
      
      success(`Ano Lectivo ${anoLetivo.ano} agora é o ativo.`);
      await loadData(anoLetivo.id);
    } catch (err: any) {
      error(err.message);
    } finally {
      dismiss(tid);
      setSaving(false);
    }
  };

  const handleCreateManualYear = async () => {
    if (!escolaUuid) return;
    const anoStr = await confirm({
      title: "Criar novo Ano Lectivo",
      message: "Indique o ano que deseja configurar (ex: 2027).",
      inputType: "number",
      placeholder: "2027",
      confirmLabel: "Criar ano",
    });

    if (!anoStr) return;
    const anoNum = parseInt(anoStr);
    if (isNaN(anoNum)) return error("Ano inválido");

    setSaving(true);
    try {
      const { data, error: err } = await supabase
        .from('anos_letivos')
        .insert({
          escola_id: escolaUuid,
          ano: anoNum,
          data_inicio: `${anoNum}-01-01`,
          data_fim: `${anoNum}-12-31`,
          ativo: false
        })
        .select()
        .single();

      if (err) throw err;

      success(`Ano ${anoNum} criado! Agora pode configurar os períodos.`);
      setSelectedAnoId(data.id);
      await loadData(data.id);
    } catch (err: any) {
      error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleApplyTemplate = async (templateId: string, templateNome: string) => {
    const ok = await confirm({
      title: "Aplicar modelo oficial",
      message: `Esta acção irá importar as datas e configurações do modelo '${templateNome}'. Os dados actuais do ano seleccionado serão substituídos. Deseja continuar?`,
      confirmLabel: "Aplicar modelo",
    });
    if (!ok) return;

    setSaving(true);
    setShowTemplatesMenu(false);
    const tid = toast({ variant: "syncing", title: "A aplicar modelo...", duration: 0 });

    try {
      const res = await fetch(`/api/escola/${escolaParam}/admin/calendario/aplicar-template`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao aplicar modelo");
      
      success("Modelo aplicado com sucesso!");
      if (data.anoLetivoId) {
        setSelectedAnoId(data.anoLetivoId);
        await loadData(data.anoLetivoId);
      } else {
        await loadData();
      }
    } catch (err: any) {
      error(err.message);
    } finally {
      dismiss(tid);
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const tid = toast({ variant: "syncing", title: "A guardar alterações...", duration: 0 });
    try {
      // 1. Salvar datas macro do Ano Letivo
      if (anoLetivo && escolaUuid) {
        const { error: anoErr } = await supabase
          .from('anos_letivos')
          .update({ 
            data_inicio: anoLetivo.data_inicio, 
            data_fim: anoLetivo.data_fim 
          })
          .eq('id', anoLetivo.id);
        if (anoErr) throw anoErr;
      }

      // 2. Salvar Trimestres
      const res = await fetch(`/api/escola/${escolaParam}/admin/periodos-letivos/upsert-bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(periodos),
      });
      if (!res.ok) throw new Error("Erro ao salvar trimestres");
      
      success("Configurações guardadas.");
      await loadData(selectedAnoId || undefined);
    } catch (err) {
      error("Erro ao guardar.");
    } finally {
      dismiss(tid);
      setSaving(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anoLetivo?.id || !escolaUuid) return;
    
    setSaving(true);
    try {
      const { data, error: err } = await supabase
        .from('calendario_eventos')
        .insert({
          escola_id: escolaUuid,
          ano_letivo_id: anoLetivo.id,
          nome: newEvent.nome,
          tipo: newEvent.tipo,
          data_inicio: newEvent.data_inicio,
          data_fim: newEvent.data_fim || newEvent.data_inicio,
        })
        .select()
        .single();

      if (err) throw err;

      setEventos(prev => [...prev, data as EventoCalendario].sort((a, b) => a.data_inicio.localeCompare(b.data_inicio)));
      setIsModalOpen(false);
      setNewEvent({ nome: "", tipo: "FERIADO", data_inicio: "", data_fim: "" });
      success("Evento criado com sucesso.");
    } catch (err: any) {
      error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const removeEvento = async (id: string) => {
    const ok = await confirm({
      title: "Remover evento",
      message: "Tem certeza que deseja remover este evento do calendário?",
      confirmLabel: "Remover",
      variant: "danger",
    });
    if (!ok) return;

    try {
      const { error: err } = await supabase
        .from('calendario_eventos')
        .delete()
        .eq('id', id);
      
      if (err) throw err;

      setEventos(prev => prev.filter(e => e.id !== id));
      success("Evento removido.");
    } catch (err: any) {
      error(err.message);
    }
  };

  const handleCopyEvents = async () => {
    if (!anoLetivo || !escolaUuid) return;
    const previousAno = anosDisponiveis.filter(a => a.ano < anoLetivo.ano).sort((a, b) => b.ano - a.ano)[0];
    if (!previousAno) return error("Nenhum ano anterior encontrado.");
    
    const ok = await confirm({
      title: "Copiar feriados",
      message: `Deseja copiar todos os feriados de ${previousAno.ano} para o Ano Lectivo ${anoLetivo.ano}?`,
      confirmLabel: "Copiar agora",
    });
    if (!ok) return;

    setSaving(true);
    const tid = toast({ variant: "syncing", title: "Copiando eventos...", duration: 0 });
    try {
      const res = await fetch(`/api/escola/${escolaParam}/admin/calendario/copiar-eventos`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromAnoId: previousAno.id, toAnoId: anoLetivo.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao copiar");
      success(data.message);
      await loadData(anoLetivo.id);
    } catch (err: any) { error(err.message); } finally { dismiss(tid); setSaving(false); }
  };

  const handleCloneStructure = async () => {
    if (!anoLetivo || !escolaUuid) return;
    const previousAno = anosDisponiveis.filter(a => a.ano < anoLetivo.ano).sort((a, b) => b.ano - a.ano)[0];
    if (!previousAno) return error("Nenhum ano anterior encontrado para clonar.");

    const ok = await confirm({
      title: "Clonar estrutura escolar",
      message: `Esta acção irá clonar TODAS as turmas e as atribuições de professores de ${previousAno.ano} para o novo ano ${anoLetivo.ano}. Deseja continuar?`,
      confirmLabel: "Clonar estrutura",
    });
    if (!ok) return;

    setSaving(true);
    const tid = toast({ variant: "syncing", title: "Clonando estrutura...", duration: 0 });
    try {
      const res = await fetch(`/api/escola/${escolaParam}/admin/calendario/clonar-estrutura`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          fromAnoId: previousAno.id,
          toAnoId: anoLetivo.id,
          cloneProfessores: true
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao clonar estrutura");

      success(data.message);
      await loadData(anoLetivo.id);
    } catch (err: any) {
      error(err.message);
    } finally {
      dismiss(tid);
      setSaving(false);
    }
  };

  const pesoTotal = useMemo(() => periodos.reduce((sum, p) => sum + (Number(p.peso) || 0), 0), [periodos]);
  const isPesoValido = pesoTotal === 100;

  return (
    <div className="min-h-screen bg-slate-50 text-left">
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        
        {/* HEADER */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href={base} className="group inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors">
              <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-1" />
              Voltar às configurações
            </Link>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Configuração de Calendário</h1>
            <p className="text-sm text-slate-500">Gestão de períodos lectivos, feriados e interrupções.</p>
          </div>

          <div className="flex items-center gap-3">
             {periodos.length === 0 && (
               <button
                type="button"
                onClick={handleCloneStructure}
                disabled={saving || loading}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-600/30 bg-white px-4 py-2.5 text-sm font-bold text-emerald-600 shadow-sm transition-all hover:bg-emerald-50 disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" />
                Clonar Turmas e Professores
              </button>
             )}

             <div className="relative">
              <button
                type="button"
                onClick={() => setShowTemplatesMenu(!showTemplateMenu)}
                disabled={saving || loading}
                className="inline-flex items-center gap-2 rounded-xl border border-klasse-gold/30 bg-white px-4 py-2.5 text-sm font-bold text-klasse-gold shadow-sm transition-all hover:bg-klasse-gold/5 disabled:opacity-50"
              >
                <Wand2 className="h-4 w-4" />
                Importar Modelo Oficial
                <ChevronDown className={`h-3 w-3 transition-transform ${showTemplateMenu ? 'rotate-180' : ''}`} />
              </button>

              {showTemplateMenu && (
                <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl animate-in fade-in slide-in-from-top-2">
                  <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Modelos Disponíveis</p>
                  {templates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleApplyTemplate(t.id, t.nome)}
                      className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-between"
                    >
                      {t.nome}
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{t.ano_base}</span>
                    </button>
                  ))}
                  {templates.length === 0 && (
                    <p className="px-3 py-4 text-center text-xs text-slate-400 italic">Nenhum modelo oficial encontrado.</p>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="inline-flex items-center gap-2 rounded-xl bg-klasse-gold px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#D4A32C] disabled:opacity-70"
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "A guardar..." : "Guardar Tudo"}
            </button>
          </div>
        </div>

        {/* YEAR SELECTOR & TABS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200">
          <div className="flex">
            <button 
              onClick={() => setActiveTab('trimestres')}
              className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'trimestres' ? 'border-klasse-gold text-klasse-gold' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Trimestres e Pesos
            </button>
            <button 
              onClick={() => setActiveTab('eventos')}
              className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'eventos' ? 'border-klasse-gold text-klasse-gold' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Feriados e Interrupções
            </button>
          </div>

          <div className="pb-2 sm:pb-0 sm:pr-2 flex items-center gap-2">
             <select 
                className="rounded-lg border-slate-200 text-sm font-bold text-slate-700 focus:border-klasse-gold focus:ring-klasse-gold"
                value={selectedAnoId || ""}
                onChange={(e) => handleAnoChange(e.target.value)}
              >
                {anosDisponiveis.map(a => (
                  <option key={a.id} value={a.id}>
                    Ano Lectivo {a.ano} {a.ativo ? '(Ativo)' : ''}
                  </option>
                ))}
              </select>

              <button 
                onClick={handleCreateManualYear}
                title="Criar novo ano do zero"
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><RefreshCw className="h-8 w-8 animate-spin text-slate-300" /></div>
        ) : (
          <div className="space-y-6">
            
            {activeTab === 'trimestres' && (
              <div className="space-y-6">
                {/* DATAS MACRO DO ANO */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-klasse-gold" />
                    Duração Global do Ano Lectivo {anoLetivo?.ano}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block text-left">Início Oficial</label>
                      <input 
                        type="date"
                        className="w-full rounded-lg border-slate-200 text-sm font-bold"
                        value={anoLetivo?.data_inicio || ""}
                        onChange={e => setAnoLetivo(prev => prev ? { ...prev, data_inicio: e.target.value } : null)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block text-left">Término Oficial</label>
                      <input 
                        type="date"
                        className="w-full rounded-lg border-slate-200 text-sm font-bold"
                        value={anoLetivo?.data_fim || ""}
                        onChange={e => setAnoLetivo(prev => prev ? { ...prev, data_fim: e.target.value } : null)}
                      />
                    </div>
                  </div>
                </div>

                {/* LISTA DE TRIMESTRES */}
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="bg-slate-50/50 px-6 py-4 flex justify-between items-center border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-semibold text-slate-900">
                        Configuração dos Trimestres
                      </h3>
                      {anoLetivo?.ativo ? (
                        <span className="flex items-center gap-1 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                          <CheckCircle2 className="h-3 w-3" /> Ativo
                        </span>
                      ) : (
                        <button 
                          onClick={handleSetActiveAno}
                          className="text-[10px] bg-slate-100 text-slate-500 hover:bg-klasse-gold hover:text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider transition-colors"
                        >
                          Tornar Ativo
                        </button>
                      )}
                    </div>
                    <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium border ${isPesoValido ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                      {isPesoValido ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                      <span>Peso Total: {pesoTotal}%</span>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-100 text-left">
                    {periodos.length === 0 ? (
                      <div className="px-6 py-10 text-center text-slate-400 italic text-sm">
                        Nenhum trimestre configurado para este ano. Utilize um modelo acima para começar.
                      </div>
                    ) : periodos.map((p) => (
                      <div key={p.id} className="grid grid-cols-1 md:grid-cols-12 gap-6 px-6 py-6 items-end hover:bg-slate-50/50 transition-colors text-left">
                        <div className="md:col-span-2">
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600">{p.numero}º</span>
                            <p className="font-bold text-slate-900">{p.tipo}</p>
                          </div>
                        </div>
                        
                        <div className="md:col-span-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Início</label>
                          <input 
                            type="date"
                            className="w-full rounded-lg border-slate-200 text-xs font-bold"
                            value={p.data_inicio}
                            onChange={(e) => setPeriodos(prev => prev.map(item => item.id === p.id ? { ...item, data_inicio: e.target.value } : item))}
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Fim</label>
                          <input 
                            type="date"
                            className="w-full rounded-lg border-slate-200 text-xs font-bold"
                            value={p.data_fim}
                            onChange={(e) => setPeriodos(prev => prev.map(item => item.id === p.id ? { ...item, data_fim: e.target.value } : item))}
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Peso na Nota</label>
                          <div className="relative">
                            <input 
                              type="number" 
                              className="w-full rounded-lg border-slate-200 text-sm font-bold" 
                              value={p.peso ?? ""} 
                              onChange={(e) => setPeriodos(prev => prev.map(item => item.id === p.id ? { ...item, peso: parseInt(e.target.value) } : item))}
                            />
                            <span className="absolute right-3 top-2 text-slate-400 text-xs">%</span>
                          </div>
                        </div>
                        <div className="md:col-span-4">
                          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block flex items-center gap-1"><Lock className="h-3 w-3" /> Bloquear Notas</label>
                          <input 
                            type="datetime-local" 
                            className="w-full rounded-lg border-slate-200 text-xs" 
                            value={toInputDate(p.trava_notas_em)} 
                            onChange={(e) => setPeriodos(prev => prev.map(item => item.id === p.id ? { ...item, trava_notas_em: e.target.value ? new Date(e.target.value).toISOString() : null } : item))}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'eventos' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {eventos.map((ev) => (
                    <div key={ev.id} className="group relative rounded-xl border border-slate-200 bg-white p-4 hover:border-klasse-gold/30 transition-all text-left">
                      <div className="flex justify-between items-start">
                        <div className="flex gap-3">
                          <div className={`mt-1 h-2 w-2 rounded-full ${ev.tipo === 'FERIADO' ? 'bg-red-400' : ev.tipo === 'PAUSA_PEDAGOGICA' ? 'bg-blue-400' : ev.tipo === 'PROVA_TRIMESTRAL' ? 'bg-amber-400' : 'bg-slate-400'}`} />
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{ev.nome}</p>
                            <p className="text-xs text-slate-500 mt-1">
                              {format(parseISO(ev.data_inicio), 'dd/MM/yyyy')} 
                              {ev.data_inicio !== ev.data_fim && ` — ${format(parseISO(ev.data_fim), 'dd/MM/yyyy')}`}
                            </p>
                            <span className="mt-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500 uppercase">{ev.tipo.replace('_', ' ')}</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => removeEvento(ev.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {/* BOTÕES DE ACÇÃO EM GRID */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:col-span-2">
                    <button 
                      onClick={() => setIsModalOpen(true)}
                      className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 p-6 text-slate-400 hover:border-klasse-gold hover:text-klasse-gold transition-all"
                    >
                      <Plus className="h-6 w-6 mb-2" />
                      <span className="text-xs font-bold uppercase tracking-widest">Adicionar Evento</span>
                    </button>

                    {anosDisponiveis.some(a => a.ano < (anoLetivo?.ano || 0)) && (
                      <button 
                        onClick={handleCopyEvents}
                        className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 p-6 text-slate-400 hover:border-klasse-gold hover:text-klasse-gold transition-all"
                      >
                        <RefreshCw className="h-6 w-6 mb-2" />
                        <span className="text-xs font-bold uppercase tracking-widest text-center">Copiar do Ano Anterior</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* MODAL: CRIAR EVENTO */}
      <ModalShell
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Novo Evento de Calendário"
        description="Adicione feriados, pausas ou datas especiais da escola."
      >
        <form onSubmit={handleCreateEvent} className="space-y-5">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase mb-1.5 block">Nome do Evento</label>
              <input 
                type="text" 
                required
                className="w-full rounded-xl border-slate-200 focus:border-klasse-gold focus:ring-klasse-gold"
                placeholder="Ex: Dia do Patrono, Festa da Escola..."
                value={newEvent.nome}
                onChange={e => setNewEvent(prev => ({ ...prev, nome: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-1.5 block">Tipo</label>
                <select 
                  className="w-full rounded-xl border-slate-200 focus:border-klasse-gold focus:ring-klasse-gold"
                  value={newEvent.tipo}
                  onChange={e => setNewEvent(prev => ({ ...prev, tipo: e.target.value as EventoTipo }))}
                >
                  <option value="FERIADO">Feriado</option>
                  <option value="PAUSA_PEDAGOGICA">Pausa Pedagógica</option>
                  <option value="PROVA_TRIMESTRAL">Época de Provas</option>
                  <option value="EXAME_NACIONAL">Exame Nacional</option>
                  <option value="EVENTO_ESCOLA">Outro Evento da Escola</option>
                </select>
              </div>
              <div />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-1.5 block">Data Início</label>
                <input 
                  type="date" 
                  required
                  className="w-full rounded-xl border-slate-200 focus:border-klasse-gold focus:ring-klasse-gold"
                  value={newEvent.data_inicio}
                  onChange={e => setNewEvent(prev => ({ ...prev, data_inicio: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-1.5 block">Data Fim (Opcional)</label>
                <input 
                  type="date" 
                  className="w-full rounded-xl border-slate-200 focus:border-klasse-gold focus:ring-klasse-gold"
                  value={newEvent.data_fim}
                  onChange={e => setNewEvent(prev => ({ ...prev, data_fim: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-klasse-gold px-8 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#D4A32C] disabled:opacity-70"
            >
              {saving ? "A criar..." : "Criar Evento"}
            </button>
          </div>
        </form>
      </ModalShell>
    </div>
  );
}

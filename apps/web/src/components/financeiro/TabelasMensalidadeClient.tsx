"use client";

import { useEffect, useMemo, useState, useCallback } from 'react';
import { 
  Plus, Filter, Search, Edit, Trash2, AlertCircle, 
  DollarSign, Calendar, Layers, BookOpen, X
} from "lucide-react";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildEscolaUrl } from "@/lib/escola/url";
import { useToast, useConfirm } from "@/components/feedback/FeedbackSystem";

// --- TIPOS ---
type Item = { 
  id: string; 
  curso_id: string | null; 
  classe_id: string | null; 
  valor: number; 
  dia_vencimento: number | null; 
  ativo: boolean; 
  created_at?: string; 
  ano_letivo?: number;
}; 
type Ref = { id: string; nome: string };
type Curso = { id: string; nome: string; tipo: string; classes: Ref[] };
type CursoResponse = { id: string; nome: string; tipo?: string | null; classes?: Ref[] };

export default function TabelasMensalidadeClient({
  escolaId: escolaIdProp,
}: {
  escolaId?: string;
}) {
  // --- ESTADOS ---
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const { escolaId: resolvedEscolaId, isLoading: escolaLoading, error: escolaError } = useEscolaId();
  const escolaId = escolaIdProp || resolvedEscolaId;
  void escolaLoading
  void escolaError
  const { toast, dismiss, success, error } = useToast();
  const confirm = useConfirm();
  
  // Filtros
  const [search, setSearch] = useState("");
  const [fCurso, setFCurso] = useState<string>("");
  const [fAno, setFAno] = useState<string>(new Date().getFullYear().toString());

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  // --- DATA FETCHING ---
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
        const anoQuery = fAno ? `?ano_letivo=${encodeURIComponent(fAno)}` : "";
        if (!escolaId) throw new Error('Escola não identificada');
        const [r0, r1] = await Promise.all([
            fetch(`/api/financeiro/tabelas-mensalidade${anoQuery}`),
            fetch(buildEscolaUrl(escolaId, '/cursos')),
        ]);
        
        const j0: { ok?: boolean; items?: Item[] } = await r0.json();
        const j1: { data?: CursoResponse[]; ok?: boolean; items?: CursoResponse[] } = await r1.json();

        if (j0.ok) setItems(j0.items || []);
        if (j1.ok) {
          const mappedCursos = (j1.items || j1.data || []).map((c) => ({
            id: c.id,
            nome: c.nome,
            tipo: c.tipo ?? 'core',
            classes: Array.isArray(c.classes) ? c.classes : [],
          }));
          setCursos(mappedCursos);
        }

    } catch {
      error("Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }, [escolaId, fAno]);

  useEffect(() => { if (escolaId) loadAll(); }, [escolaId, loadAll]);

  // --- FILTRAGEM ---
  const filtered = useMemo(() => {
    return items.filter(it => {
      const curso = cursos.find(c => c.id === it.curso_id);
      const cursoNome = curso?.nome || "";
      const classeNome = curso?.classes?.find(c => c.id === it.classe_id)?.nome || "";
      
      const matchesSearch = !search || 
        cursoNome.toLowerCase().includes(search.toLowerCase()) ||
        classeNome.toLowerCase().includes(search.toLowerCase());

      const matchesCurso = !fCurso || it.curso_id === fCurso;

      return matchesSearch && matchesCurso;
    });
  }, [items, search, fCurso, cursos]);

  const cursosReais = useMemo(() => {
    return cursos.filter(c => c.tipo === 'tecnico' || c.tipo === 'puniv')
  }, [cursos])

  // --- HELPER: NOME DA REGRA ---
  const getRuleName = (it: Item) => {
    const curso = cursos.find(c => c.id === it.curso_id);
    const classe = curso?.classes?.find(c => c.id === it.classe_id);

    if (curso && classe) return `${curso.nome} - ${classe.nome}`;
    if (curso) return `Todos de ${curso.nome}`;
    if (classe) return `Todas as ${classe.nome}`;
    return "Regra Geral (Toda a Escola)";
  };

  // --- ACTIONS ---
  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Remover regra de preço",
      message: "Tem a certeza que deseja apagar esta regra de preço? Esta acção pode impactar o cálculo de novas mensalidades e já não poderá ser revertida.",
      confirmLabel: "Remover",
      variant: "danger",
    });
    if (!ok) return;

    const t = toast({ variant: "syncing", title: "A apagar...", duration: 0 });    try {
        const res = await fetch(`/api/financeiro/tabelas-mensalidade?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
            dismiss(t);
            success("Regra removida.");
            loadAll();
        } else {
            throw new Error();
        }
    } catch {
        dismiss(t);
        error("Erro ao remover.");
    }
  };

  return (
    <div className="min-h-full bg-background p-4 text-foreground sm:p-6 lg:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-3xl font-bold text-foreground">Tabelas de Preço</h1>
                <p className="text-muted-foreground mt-1">Defina quanto custa a propina para cada curso ou classe.</p>
            </div>
            <button 
                onClick={() => { setEditingItem(null); setShowModal(true); }}
                className="bg-foreground text-background px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-foreground/90 shadow-lg flex items-center gap-2 transition-all hover:-translate-y-0.5"
            >
                <Plus size={18}/> Nova Regra
            </button>
        </div>

        {/* FILTROS */}
        <div className="bg-card p-4 rounded-2xl border border-border shadow-sm flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4"/>
                <input 
                    value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Pesquisar regra..." 
                    className="w-full pl-10 pr-4 py-2 bg-muted border-none rounded-xl outline-none focus:ring-2 focus:ring-teal-500/20 text-sm font-medium"
                />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
                <Filter size={16} className="text-muted-foreground"/>
                <input
                    type="number"
                    value={fAno}
                    onChange={e => setFAno(e.target.value)}
                    className="w-28 bg-muted border-none text-sm font-bold text-foreground/80 py-2 pl-3 pr-3 rounded-xl outline-none focus:ring-2 focus:ring-teal-500/20"
                    placeholder="Ano"
                    min="2000"
                    max="3000"
                />
                <select 
                    value={fCurso} onChange={e => setFCurso(e.target.value)}
                    className="bg-muted border-none text-sm font-bold text-foreground/80 py-2 pl-3 pr-8 rounded-xl cursor-pointer outline-none focus:ring-2 focus:ring-teal-500/20"
                >
                    <option value="">Todos os Cursos</option>
                    {cursosReais.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
            </div>
        </div>

        {/* GRID DE REGRAS */}
        {loading ? (
             <div className="text-center py-12 text-muted-foreground">Carregando preçário...</div>
        ) : filtered.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-2xl border border-dashed border-border">
                <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-3"/>
                <p className="text-muted-foreground font-medium">Nenhuma regra encontrada.</p>
                <button onClick={() => setShowModal(true)} className="text-teal-600 text-sm font-bold mt-2 hover:underline">Criar a primeira regra</button>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(item => (
                    <div key={item.id} className="bg-card p-5 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all group relative">
                        <div className="flex justify-between items-start mb-3">
                            <div className={`p-2 rounded-lg ${item.ativo ? 'bg-emerald-50 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                                <DollarSign size={20}/>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => { setEditingItem(item); setShowModal(true); }} className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground/80 transition"><Edit size={16}/></button>
                                <button onClick={() => handleDelete(item.id)} className="p-2 hover:bg-red-50 rounded-lg text-muted-foreground hover:text-red-600 transition"><Trash2 size={16}/></button>
                            </div>
                        </div>
                        
                        <h3 className="font-bold text-foreground text-lg mb-1">{formatMoney(item.valor)}</h3>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">Mensalidade</p>

                        <div className="space-y-2 pt-4 border-t border-border">
                            <div className="flex items-center gap-2 text-sm text-foreground/80">
                                <Layers size={14} className="text-muted-foreground"/>
                                <span className="font-medium text-foreground">{getRuleName(item)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Calendar size={14} className="text-muted-foreground"/>
                                Vence dia <strong className="text-foreground">{item.dia_vencimento || 10}</strong>
                            </div>
                            {item.ano_letivo && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <BookOpen size={14} className="text-muted-foreground"/>
                                    Ano letivo <strong className="text-foreground">{item.ano_letivo}</strong>
                                </div>
                            )}
                        </div>
                        
                        {!item.ativo && (
                            <div className="absolute top-4 right-4 bg-muted text-muted-foreground text-[10px] font-bold px-2 py-1 rounded">INATIVO</div>
                        )}
                    </div>
                ))}
            </div>
        )}

      </div>

      {/* MODAL DE FORMULÁRIO */}
      {showModal && (
        <PriceRuleForm 
            onClose={() => setShowModal(false)} 
            onSuccess={() => { setShowModal(false); loadAll(); }}
            initialData={editingItem}
            cursos={cursosReais}
            defaultAno={fAno}
        />
      )}

    </div>
  );
}

// --- MICRO-COMPONENT: FORMULARIO ---
type PriceRuleFormProps = {
    onClose: () => void;
    onSuccess: () => void;
    initialData: Item | null;
    cursos: Curso[];
    defaultAno: string;
};

function PriceRuleForm({ onClose, onSuccess, initialData, cursos, defaultAno }: PriceRuleFormProps) {
    const { success, error } = useToast();
    const getClasseNumero = (nome: string) => {
        const match = nome.match(/\d+/);
        return match ? parseInt(match[0], 10) : null;
    };

    const allclasses = useMemo(() => {
        const allClasses: Ref[] = [];
        cursos.forEach(c => {
            allClasses.push(...c.classes);
        });
        return allClasses;
    }, [cursos]);

    const generalClasses = useMemo(() => {
        return allclasses.filter((c: Ref) => {
            const n = getClasseNumero(c.nome);
            return n !== null && n < 10;
        });
    }, [allclasses]);

    const [regime, setRegime] = useState<'geral' | 'curso'>(
        initialData?.curso_id ? 'curso' : 'geral'
    );
    const [formData, setFormData] = useState({
        curso_id: initialData?.curso_id || "",
        classe_id: initialData?.classe_id || "",
        valor: initialData?.valor || "",
        dia_vencimento: initialData?.dia_vencimento || "10",
        ativo: initialData ? initialData.ativo : true,
        ano_letivo: (initialData?.ano_letivo ?? defaultAno ?? new Date().getFullYear()).toString(),
        applyExisting: false
    });
    const [saving, setSaving] = useState(false);
    const [courseSpecificClasses, setCourseSpecificClasses] = useState<Ref[]>([]);
    
    useEffect(() => {
        if (regime === 'curso' && formData.curso_id) {
            const curso = cursos.find(c => c.id === formData.curso_id);
            setCourseSpecificClasses(curso?.classes || []);
        } else {
            setCourseSpecificClasses([]);
        }
    }, [formData.curso_id, regime, cursos]);

    useEffect(() => {
        setFormData(prev => ({...prev, classe_id: ""}));
    }, [regime]);

    const parseValor = (raw: string | number) => {
        if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
        if (typeof raw !== 'string') return null;
        const str = raw.trim();
        if (!str) return null;
        if (str.includes(',')) {
            const normalized = str.replace(/\./g, '').replace(/,/g, '.');
            const num = Number(normalized);
            return Number.isFinite(num) ? num : null;
        }
        const num = Number(str);
        return Number.isFinite(num) ? num : null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const valorNumber = parseValor(formData.valor);
        if(valorNumber === null || valorNumber <= 0) return error("Valor é obrigatório e deve ser numérico");
        if(regime === 'geral' && !formData.classe_id) return error("Selecione a classe (1ª a 9ª)");
        if(regime === 'curso' && (!formData.curso_id || !formData.classe_id)) return error("Curso e classe do curso são obrigatórios");
        
        setSaving(true);
        try {
            const diaNumber = Number(formData.dia_vencimento);
            const safeDia = Number.isFinite(diaNumber) ? diaNumber : undefined;
            const payload = {
                ...formData,
                valor: valorNumber,
                dia_vencimento: safeDia,
                ano_letivo: formData.ano_letivo || new Date().getFullYear().toString(),
                curso_id: formData.curso_id || null,
                classe_id: formData.classe_id || null
            };
            
            const res = await fetch('/api/financeiro/tabelas-mensalidade', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(initialData ? { ...payload, id: initialData.id } : payload)
            });

            const json = await res.json();
            if(json.ok) {
                success("Regra guardada.");
                
                if(formData.applyExisting) {
                    await fetch('/api/financeiro/tabelas-mensalidade/apply', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ 
                            valor: valorNumber,
                            curso_id: payload.curso_id,
                            classe_id: payload.classe_id
                        })
                    });
                    success("Preços atualizados nos alunos existentes.");
                }

                onSuccess();
            } else {
                throw new Error(json.error);
            }
        } catch(e) {
            const message = e instanceof Error ? e.message : "Erro ao salvar.";
            error(message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-2xl sm:p-6 space-y-5 scale-100 animate-in zoom-in-95">
                <div className="flex justify-between items-center border-b border-border pb-4">
                    <h3 className="font-bold text-lg text-foreground">{initialData ? "Editar Regra" : "Nova Regra de Preço"}</h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground hover:text-foreground/80"/></button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => { setRegime('geral'); }}
                            className={`p-3 rounded-xl border text-sm font-bold transition ${regime === 'geral' ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-sm' : 'border-border bg-card text-foreground/80 hover:border-border'}`}
                        >
                            Ensino Geral
                        </button>
                        <button
                            type="button"
                            onClick={() => { setRegime('curso'); }}
                            className={`p-3 rounded-xl border text-sm font-bold transition ${regime === 'curso' ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-sm' : 'border-border bg-card text-foreground/80 hover:border-border'}`}
                        >
                            Curso Técnico / PUNIV
                        </button>
                    </div>

                    {regime === 'curso' && (
                        <div>
                            <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Curso</label>
                            <select 
                                value={formData.curso_id}
                                onChange={e => setFormData({...formData, curso_id: e.target.value, classe_id: ''})}
                                className="w-full p-2 bg-muted border border-border rounded-lg text-sm"
                                required
                            >
                                <option value="">Selecione...</option>
                                {cursos.map((c: Curso) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Ano Letivo</label>
                        <input
                            type="number"
                            min="2000"
                            max="3000"
                            value={formData.ano_letivo}
                            onChange={e => setFormData({...formData, ano_letivo: e.target.value})}
                            className="w-full p-2 bg-muted border border-border rounded-lg text-sm"
                            required
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">{regime === 'geral' ? 'Classe (1ª a 9ª)' : 'Classe do Curso'}</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {(regime === 'geral' ? generalClasses : courseSpecificClasses).map((c: Ref) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setFormData({...formData, classe_id: c.id})}
                                    disabled={regime === 'curso' && !formData.curso_id}
                                    className={`py-2 px-3 rounded-lg border text-sm font-bold transition ${formData.classe_id === c.id ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-border bg-card text-foreground/80 hover:border-border'} ${regime === 'curso' && !formData.curso_id ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {c.nome}
                                </button>
                            ))}
                        </div>
                        {regime === 'curso' && !formData.curso_id && (
                            <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Selecione um curso para escolher a classe.
                            </p>
                        )}
                         {regime === 'curso' && formData.curso_id && courseSpecificClasses.length === 0 && (
                            <p className="text-sm text-muted-foreground mt-2">Nenhuma classe encontrada para este curso.</p>
                        )}
                    </div>

                    <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Valor da Propina (KZ)</label>
                        <input 
                            type="number" 
                            required
                            value={formData.valor}
                            onChange={e => setFormData({...formData, valor: e.target.value})}
                            className="w-full p-3 bg-background border border-border rounded-xl text-lg font-bold text-foreground focus:ring-2 focus:ring-teal-500 outline-none"
                            placeholder="0.00"
                            autoFocus
                        />
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Dia Vencimento</label>
                            <select
                                required
                                value={formData.dia_vencimento}
                                onChange={e => setFormData({...formData, dia_vencimento: e.target.value})}
                                className="w-full p-2 bg-muted border border-border rounded-lg text-sm"
                            >
                                {Array.from({ length: 31 }, (_, idx) => idx + 1).map((day) => (
                                    <option key={day} value={String(day)}>{day}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center gap-2 pt-6">
                            <input 
                                type="checkbox" 
                                checked={formData.ativo} 
                                onChange={e => setFormData({...formData, ativo: e.target.checked})}
                                className="w-4 h-4 text-teal-600 rounded"
                            />
                            <span className="text-sm font-medium text-foreground">Regra Ativa</span>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-border">
                        <label className="flex items-start gap-3 p-3 bg-muted rounded-xl border border-border cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={formData.applyExisting} 
                                onChange={e => setFormData({...formData, applyExisting: e.target.checked})}
                                className="mt-1 w-4 h-4 text-foreground/80 rounded"
                            />
                            <div className="text-xs text-foreground">
                                <span className="font-bold block">Aplicar a alunos existentes?</span>
                                Atualiza o valor das próximas mensalidades de quem já está matriculado nesta regra.
                            </div>
                        </label>
                    </div>

                    <div className="flex justify-end pt-2">
                        <button type="submit" disabled={saving} className="w-full bg-foreground text-background py-3 rounded-xl font-bold shadow-lg hover:bg-slate-800 transition disabled:opacity-50">
                            {saving ? "A guardar..." : "Salvar Regra"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

function formatMoney(v: number) {
  return v.toLocaleString('pt-AO', { style: 'currency', currency: 'AOA' });
}

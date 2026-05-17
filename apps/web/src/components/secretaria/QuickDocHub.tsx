"use client";

import { useEffect, useState } from "react";
import { 
  FileText, 
  CalendarCheck, 
  LayoutDashboard, 
  BookOpen, 
  Search,
  Loader2,
  GraduationCap,
  Download
} from "lucide-react";
import SecaoLabel from "@/components/shared/SecaoLabel";

type TurmaItem = {
  id: string;
  turma_nome?: string | null;
  nome?: string | null;
  turno?: string | null;
  classe_nome?: string | null;
};

type PeriodoItem = {
  id: string;
  numero: number;
  tipo: string;
};

export default function QuickDocHub({ escolaId }: { escolaId?: string | null }) {
  const [anoLetivo] = useState<number>(new Date().getFullYear());
  const [turmas, setTurmas] = useState<TurmaItem[]>([]);
  const [periodos, setPeriodos] = useState<PeriodoItem[]>([]);
  const [loadingTurmas, setLoadingTurmas] = useState(false);
  const [loadingPeriodos, setLoadingPeriodos] = useState(false);
  const [turmaId, setTurmaId] = useState("");
  const [month, setMonth] = useState(() => (new Date().getMonth() + 1).toString().padStart(2, '0'));
  const [periodoId, setPeriodoId] = useState("");

  // Load Turmas
  useEffect(() => {
    if (!escolaId) return;
    let active = true;
    const loadTurmas = async () => {
      setLoadingTurmas(true);
      try {
        const res = await fetch(`/api/secretaria/turmas-simples?ano=${anoLetivo}`);
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        if (res.ok && json.ok) {
          setTurmas(json.items || json.data || []);
        }
      } catch (e) {
        console.error("Erro ao carregar turmas:", e);
      } finally {
        if (active) setLoadingTurmas(false);
      }
    };
    loadTurmas();
    return () => { active = false; };
  }, [escolaId, anoLetivo]);

  // Load Periodos
  useEffect(() => {
    if (!escolaId) return;
    let active = true;
    const loadPeriodos = async () => {
      setLoadingPeriodos(true);
      try {
        const res = await fetch(`/api/secretaria/relatorios/mapa-aproveitamento`);
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        if (res.ok && json.ok) {
          const fetched = json.filtros?.periodos || [];
          setPeriodos(fetched);
          if (fetched.length > 0 && !periodoId) setPeriodoId(fetched[0].id);
        }
      } catch (e) {
        console.error("Erro ao carregar períodos:", e);
      } finally {
        if (active) setLoadingPeriodos(false);
      }
    };
    loadPeriodos();
    return () => { active = false; };
  }, [escolaId]);

  const handlePrint = (type: 'attendance' | 'nominal' | 'blank' | 'mini' | 'pauta-geral' | 'pauta-anual' | 'mapa-aproveitamento' | 'excel') => {
    if (!turmaId) return;
    let url = "";
    const selectedPeriodo = periodos.find(p => p.id === periodoId);
    
    switch (type) {
      case 'attendance':
        url = `/api/secretaria/turmas/${turmaId}/alunos/lista?format=pdf&month=${month}`;
        break;
      case 'nominal':
        url = `/api/secretaria/turmas/${turmaId}/alunos/lista?format=pdf`;
        break;
      case 'blank':
        url = `/api/secretaria/turmas/${turmaId}/pauta-branca`;
        break;
      case 'mini':
        url = `/api/secretaria/turmas/${turmaId}/mini-pautas`;
        break;
      case 'pauta-geral':
        if (!periodoId) return;
        url = `/api/secretaria/turmas/${turmaId}/pauta-geral?periodo_letivo_id=${periodoId}&periodoNumero=${selectedPeriodo?.numero || 1}`;
        break;
      case 'pauta-anual':
        url = `/api/secretaria/turmas/${turmaId}/pauta-anual`;
        break;
      case 'excel':
        url = `/api/secretaria/turmas/${turmaId}/pauta`;
        break;
    }
    if (url) window.open(url, "_blank");
  };

  return (
    <div className="bg-slate-50/50 rounded-2xl border border-slate-200/60 p-5 space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Emissão Rápida por Turma</p>
        {(loadingTurmas || loadingPeriodos) && <Loader2 size={14} className="text-slate-400 animate-spin" />}
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <Search size={16} className="text-slate-400" />
        </div>
        <select
          value={turmaId}
          onChange={(e) => setTurmaId(e.target.value)}
          className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:bg-white focus:ring-4 focus:ring-klasse-gold/10 focus:border-klasse-gold outline-none transition-all cursor-pointer"
        >
          <option value="">
            {loadingTurmas ? "Carregando turmas..." : "Selecione a turma para emissão rápida..."}
          </option>
          {turmas.map(t => (
            <option key={t.id} value={t.id}>
              {t.turma_nome || t.nome} ({t.classe_nome} • {t.turno})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Grupo Presença */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Presença</p>
            <select 
              value={month} 
              onChange={(e) => setMonth(e.target.value)}
              className="text-[10px] font-bold bg-slate-100 rounded-md px-1.5 py-0.5 outline-none text-slate-600 border-none cursor-pointer"
            >
              {[
                { v: '01', l: 'Jan' }, { v: '02', l: 'Fev' }, { v: '03', l: 'Mar' },
                { v: '04', l: 'Abr' }, { v: '05', l: 'Mai' }, { v: '06', l: 'Jun' },
                { v: '07', l: 'Jul' }, { v: '08', l: 'Ago' }, { v: '09', l: 'Set' },
                { v: '10', l: 'Out' }, { v: '11', l: 'Nov' }, { v: '12', l: 'Dez' },
              ].map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <DocButton 
              icon={<CalendarCheck size={14} />} 
              label="Mapa de Frequência" 
              disabled={!turmaId} 
              onClick={() => handlePrint('attendance')}
              primary
            />
            <DocButton 
              icon={<LayoutDashboard size={14} />} 
              label="Pauta em Branco" 
              disabled={!turmaId} 
              onClick={() => handlePrint('blank')}
            />
          </div>
        </div>

        {/* Grupo Desempenho */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Desempenho</p>
            <select 
              value={periodoId} 
              onChange={(e) => setPeriodoId(e.target.value)}
              className="text-[10px] font-bold bg-slate-100 rounded-md px-1.5 py-0.5 outline-none text-slate-600 border-none cursor-pointer"
            >
              {periodos.length === 0 && <option value="">Sem Período</option>}
              {periodos.map(p => <option key={p.id} value={p.id}>{p.numero}º {p.tipo === 'TRIMESTRE' ? 'Trim' : 'Per'}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <DocButton 
              icon={<BookOpen size={14} />} 
              label="Pauta Geral" 
              disabled={!turmaId || !periodoId} 
              onClick={() => handlePrint('pauta-geral')}
            />
            <DocButton 
              icon={<GraduationCap size={14} />} 
              label="Pauta Anual" 
              disabled={!turmaId} 
              onClick={() => handlePrint('pauta-anual')}
            />
          </div>
        </div>

        {/* Grupo Outros */}
        <div className="space-y-4">
          <div className="flex items-center px-1 h-[17px]">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Geral & Exportação</p>
          </div>
          <div className="flex flex-col gap-2">
            <DocButton 
              icon={<FileText size={14} />} 
              label="Lista Nominal" 
              disabled={!turmaId} 
              onClick={() => handlePrint('nominal')}
            />
            <DocButton 
              icon={<Download size={14} />} 
              label="Pauta Digital (Excel)" 
              disabled={!turmaId} 
              onClick={() => handlePrint('excel')}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function DocButton({ icon, label, onClick, disabled, primary }: { icon: any, label: string, onClick: () => void, disabled?: boolean, primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all
        ${disabled 
          ? "bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed" 
          : primary
            ? "bg-[#1F6B3B] text-white hover:brightness-95 shadow-sm"
            : "bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 shadow-sm"
        }
      `}
    >
      {icon}
      {label}
    </button>
  );
}

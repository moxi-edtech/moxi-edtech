import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { Megaphone, Clock, Flame, ChevronDown } from "lucide-react";
import { EstadoVazio } from "@/components/harmonia";

export type NoticeItemData = {
  id: string;
  titulo: string;
  resumo: string;
  data: string;
  action_label?: string;
  action_href?: string;
  aluno_id?: string;
  candidatura_id?: string;
  type?: string; 
  is_priority?: boolean;
  priority_note?: string;
};

const CATEGORIAS = [
  { id: 'all', label: 'Todos' },
  { id: 'CANDIDATURA_PENDENTE', label: 'Candidaturas' },
  { id: 'FICHA_RAPIDA', label: 'Fichas' },
  { id: 'BIRTHDAY_WHATSAPP', label: 'Aniversários' },
  { id: 'DEBT_PAYMENT', label: 'Dívidas' },
];

export function NoticePanel({
  items,
  showHeader = true,
  title = "Avisos Gerais",
  onAction,
  onSnooze,
}: {
  items: NoticeItemData[];
  showHeader?: boolean;
  title?: string;
  onAction?: (item: NoticeItemData) => void;
  onSnooze?: () => void;
}) {
  const [filtro, setFiltro] = useState('all');

  const itemsFiltrados = useMemo(() => {
    let list = items;
    if (filtro !== 'all') {
      list = list.filter(i => i.type === filtro);
    }
    // Sempre prioriza os marcados pelo Admin no topo da lista filtrada
    return [...list].sort((a, b) => (a.is_priority === b.is_priority ? 0 : a.is_priority ? -1 : 1));
  }, [items, filtro]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white flex flex-col h-[500px]">
      {showHeader && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-klasse-gold/10 text-klasse-gold ring-1 ring-klasse-gold/25 flex items-center justify-center">
              <Megaphone className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          </div>
        </div>
      )}

      {/* Barra de Filtros */}
      <div className="px-2 py-2 border-b border-slate-50 flex gap-1 overflow-x-auto shrink-0 scrollbar-hide">
         {CATEGORIAS.map(cat => (
           <button
             key={cat.id}
             onClick={() => setFiltro(cat.id)}
             className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
               filtro === cat.id 
                 ? 'bg-slate-900 text-white shadow-sm' 
                 : 'text-slate-500 hover:bg-slate-100'
             }`}
           >
             {cat.label}
           </button>
         ))}
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
        {itemsFiltrados.length === 0 ? (
          <div className="p-12 text-center">
            <div className="opacity-50 grayscale contrast-125">
               <EstadoVazio tipo="notificacoes.nenhuma" />
            </div>
          </div>
        ) : (
          itemsFiltrados.map((item) => (
            <NoticeItem 
              key={item.id} 
              item={item} 
              onAction={onAction} 
              onSnooze={onSnooze}
            />
          ))
        )}
      </div>
    </div>
  );
}

function NoticeItem({ 
  item, 
  onAction,
  onSnooze
}: { 
  item: NoticeItemData; 
  onAction?: (item: NoticeItemData) => void;
  onSnooze?: () => void;
}) {
  const [snoozing, setSnoozing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handler);
    }
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleAction = (e: React.MouseEvent) => {
    if (onAction) {
      e.preventDefault();
      onAction(item);
    }
  };

  const handleSnooze = async (days: number) => {
    setSnoozing(true);
    setMenuOpen(false);
    try {
      const aviso_id = item.aluno_id || item.candidatura_id || item.id;
      await fetch('/api/secretaria/balcao/snooze-aviso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aviso_id,
          aviso_type: item.type,
          days
        })
      });
      if (onSnooze) onSnooze();
    } catch (err) {
      console.error(err);
    } finally {
      setSnoozing(false);
    }
  };

  return (
    <div className={`p-4 hover:bg-slate-50 transition relative group ${snoozing ? 'opacity-50 pointer-events-none' : ''} ${item.is_priority ? 'bg-rose-50/40' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          {item.is_priority && (
            <span 
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter bg-rose-600 text-white w-fit shadow-sm"
              title={item.priority_note}
            >
              <Flame size={8} fill="currentColor" /> 
              {item.priority_note || "Prioridade Admin"}
            </span>
          )}
          <p className="text-sm font-semibold text-slate-900 truncate" title={item.titulo}>{item.titulo}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
           <span className="text-[11px] text-slate-400 whitespace-nowrap">
             {new Date(item.data).toLocaleDateString()}
           </span>
           
           <div className="relative" ref={menuRef}>
              <button 
                onClick={() => setMenuOpen(!menuOpen)}
                className="h-6 w-6 rounded-md hover:bg-slate-200 flex items-center justify-center text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Clock size={12} />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-xl border border-slate-200 bg-white shadow-xl py-1 animate-in slide-in-from-top-1 duration-100">
                  <p className="px-3 py-1.5 text-[9px] font-bold uppercase text-slate-400 tracking-widest">Postergar para:</p>
                  {[
                    { days: 1, label: 'Amanhã (1 dia)' },
                    { days: 3, label: '3 dias' },
                    { days: 7, label: '1 semana' },
                  ].map(opt => (
                    <button
                      key={opt.days}
                      onClick={() => handleSnooze(opt.days)}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                    >
                      {opt.label}
                    </button>
                  ))}
                  <button
                    onClick={() => handleSnooze(30)}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors border-t border-slate-50"
                  >
                    Próximo mês
                  </button>
                </div>
              )}
           </div>
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-600 leading-relaxed line-clamp-2">{item.resumo}</p>
      
      {item.action_label && (
        <div className="mt-2 flex items-center gap-2">
          {item.action_href && !onAction ? (
            <Link
              href={item.action_href}
              className="inline-flex items-center rounded-md border border-[#1F6B3B]/20 px-2.5 py-1 text-[10px] font-bold text-[#1F6B3B] hover:bg-[#1F6B3B]/5"
            >
              {item.action_label}
            </Link>
          ) : (
            <button
              onClick={handleAction}
              className="inline-flex items-center rounded-md border border-[#1F6B3B]/20 px-2.5 py-1 text-[10px] font-bold text-[#1F6B3B] hover:bg-[#1F6B3B]/5"
            >
              {item.action_label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { 
  UserPlus, FileWarning, History, CheckCircle2, Clock, Wallet, 
  FileText, UserCog, ExternalLink, Hash, Calendar, Building,
  ClipboardCheck, CalendarCheck
} from "lucide-react";
import SecaoLabel from "@/components/shared/SecaoLabel";
import { ModalShell } from "@/components/ui/ModalShell";

function formatActivityLabel(act: any) {
  const entityMap: Record<string, string> = {
    'matriculas': 'Matrícula',
    'alunos': 'Aluno',
    'pagamentos': 'Pagamento',
    'documentos_emitidos': 'Documento',
    'frequencias': 'Frequências',
    'notas': 'Notas',
  };

  const actionMap: Record<string, string> = {
    'CREATE': 'Registo de',
    'UPDATE': 'Alteração em',
    'DELETE': 'Remoção de',
    'PAGAMENTO_REGISTRADO': 'Pagamento Efetuado',
    'ADMISSAO_CONCLUIDA': 'Matrícula Concluída',
    'DOCUMENTO_EMITIDO': 'Documento Emitido',
    'ALUNO_ATUALIZADO': 'Dados do Aluno Atualizados',
    'MATRICULA_VALIDADA': 'Matrícula Validada',
    'NOTA_LANCADA_BATCH': 'Notas Lançadas',
    'FREQUENCIA_UPSERT_BATCH': 'Faltas Registadas'
  };

  if (act.action === 'PAGAMENTO_REGISTRADO') return 'Recebimento de Mensalidade';
  if (act.action === 'CREATE' && act.entity === 'pagamentos') return 'Pagamento Registado';
  if (act.action === 'CREATE' && act.entity === 'matriculas') return 'Nova Matrícula';
  if (act.action === 'NOTA_LANCADA_BATCH') return 'Lançamento de Notas';
  if (act.action === 'FREQUENCIA_UPSERT_BATCH') return 'Controlo de Assiduidade';

  const label = actionMap[act.action];
  if (label && !['CREATE', 'UPDATE', 'DELETE'].includes(act.action)) return label;

  const entity = entityMap[act.entity] || act.entity || '';
  const prefix = actionMap[act.action] || act.action;
  
  return `${prefix} ${entity}`.trim();
}

function ActivityIcon({ act }: { act: any }) {
  if (act.action?.includes('PAGAMENTO') || act.entity === 'pagamentos') return <Wallet size={16} className="text-emerald-500" />;
  if (act.entity === 'matriculas') return <UserPlus size={16} className="text-blue-500" />;
  if (act.entity === 'documentos_emitidos') return <FileText size={16} className="text-amber-500" />;
  if (act.action === 'NOTA_LANCADA_BATCH') return <ClipboardCheck size={16} className="text-purple-500" />;
  if (act.action === 'FREQUENCIA_UPSERT_BATCH') return <CalendarCheck size={16} className="text-rose-500" />;
  if (act.entity === 'alunos') return <UserCog size={16} className="text-slate-500" />;
  return <CheckCircle2 size={16} className="text-emerald-500" />;
}

export function MinhaProdutividade({ 
  escolaId, 
  onData,
  onAtenderAluno
}: { 
  escolaId: string, 
  onData?: (data: any) => void,
  onAtenderAluno?: (alunoId: string) => void
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/secretaria/balcao/produtividade?escolaId=${escolaId}`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) {
          setData(j);
          if (onData) {
            onData(j);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [escolaId, onData]);

  if (loading) return <div className="h-40 bg-slate-50 animate-pulse rounded-2xl" />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SecaoLabel>Minha Produtividade (Hoje)</SecaoLabel>
        <div className="flex items-center gap-1.5">
           <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tempo Real</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 shadow-sm transition-all hover:shadow-md">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <UserPlus size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Minhas Admissões</p>
            <p className="text-xl font-black text-slate-900">{data.admissoes_hoje}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 shadow-sm transition-all hover:shadow-md">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <FileWarning size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Docs Pendentes</p>
            <p className="text-xl font-black text-slate-900">{data.documentos_pendentes}</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col h-[400px]">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center gap-2 shrink-0">
          <History size={14} className="text-slate-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Últimas Atividades</span>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {data.atividades_recentes.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Nenhuma atividade registrada ainda hoje.
            </div>
          ) : (
            data.atividades_recentes.map((act: any) => (
              <button 
                key={act.id} 
                onClick={() => setSelectedActivity(act)}
                className="w-full text-left p-3 flex items-center gap-3 hover:bg-slate-50 transition-colors group"
              >
                <div className="shrink-0 w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-white transition-colors">
                   <ActivityIcon act={act} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate flex items-center gap-2">
                    {act.contexto || formatActivityLabel(act)} 
                    <ExternalLink size={10} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(act.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {act.aluno_nome && (
                      <p className="text-[10px] text-slate-500 truncate max-w-[150px]">
                        • {act.aluno_nome}
                      </p>
                    )}
                  </div>
                </div>
                {act.valor_pago && (
                  <div className="text-right shrink-0">
                    <p className="text-[11px] font-mono font-black text-emerald-600">
                      {moneyAOA.format(act.valor_pago)}
                    </p>
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {selectedActivity && (
        <ModalShell
          open={!!selectedActivity}
          onClose={() => setSelectedActivity(null)}
          title="Detalhes da Atividade"
          description={formatActivityLabel(selectedActivity)}
        >
          <div className="space-y-6 py-4">
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100">
                       <ActivityIcon act={selectedActivity} />
                    </div>
                    <div>
                       <p className="text-sm font-black text-slate-900">{selectedActivity.contexto || formatActivityLabel(selectedActivity)}</p>
                       <p className="text-[11px] text-slate-500 flex items-center gap-1">
                         <Clock size={12} /> 
                         {new Date(selectedActivity.created_at).toLocaleString('pt-PT')}
                       </p>
                    </div>
                  </div>
                  {selectedActivity.valor_pago && (
                    <div className="text-right">
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valor</p>
                       <p className="text-lg font-mono font-black text-emerald-600">{moneyAOA.format(selectedActivity.valor_pago)}</p>
                    </div>
                  )}
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <DetailCard icon={<UserCog size={16}/>} label="Aluno" value={selectedActivity.aluno_nome || 'Não identificado'} />
               <DetailCard icon={<Building size={16}/>} label="Turma" value={selectedActivity.turma_nome ? `Turma ${selectedActivity.turma_nome}` : 'N/A'} />
               <DetailCard icon={<Hash size={16}/>} label="ID do Registo" value={selectedActivity.entity_id?.slice(0, 13) + '...'} isMono />
               <DetailCard icon={<Calendar size={16}/>} label="Entidade" value={selectedActivity.entity} />
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
               {selectedActivity.aluno_id && onAtenderAluno && (
                 <button 
                  onClick={() => {
                    onAtenderAluno(selectedActivity.aluno_id);
                    setSelectedActivity(null);
                  }}
                  className="px-4 py-2.5 bg-klasse-gold text-white rounded-xl text-sm font-bold shadow-sm hover:brightness-110 active:scale-95 transition-all"
                 >
                   Atender Aluno
                 </button>
               )}
               <button 
                onClick={() => setSelectedActivity(null)}
                className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-200 active:scale-95 transition-all"
               >
                 Fechar Detalhes
               </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function DetailCard({ icon, label, value, isMono = false }: { icon: React.ReactNode, label: string, value: string, isMono?: boolean }) {
  return (
    <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm flex items-center gap-3">
       <div className="text-slate-400 shrink-0">
          {icon}
       </div>
       <div className="min-w-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
          <p className={`text-sm font-bold text-slate-800 truncate ${isMono ? 'font-mono' : ''}`}>{value}</p>
       </div>
    </div>
  )
}

const moneyAOA = new Intl.NumberFormat("pt-AO", {
  style: "currency",
  currency: "AOA",
});

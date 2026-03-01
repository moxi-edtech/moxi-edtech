import { supabaseServer } from '@/lib/supabaseServer';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';


const EMPTY_STATE = (
  <div className="rounded-2xl bg-white border border-slate-200 p-12 text-center shadow-sm">
    <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4 border border-slate-100">
      <span className="text-xl">📜</span>
    </div>
    <h3 className="text-slate-900 font-bold mb-1">Sem eventos consolidados</h3>
    <p className="text-slate-500 text-sm max-w-xs mx-auto italic">
      Assim que ocorrerem alterações, suspensões, reativações e validações de comprovativo,
      elas aparecerão aqui.
    </p>
  </div>
);

const BILLING_ACTIONS = [
  'BILLING_SUBSCRIPTION_UPDATED',
  'BILLING_SUBSCRIPTION_SUSPENDED',
  'BILLING_SUBSCRIPTION_REACTIVATED',
  'BILLING_RECEIPT_CONFIRMED',
  'BILLING_RECEIPT_REJECTED',
];

function formatField(field: string) {
  switch (field) {
    case 'valor_kz':
      return 'valor';
    case 'notas_internas':
      return 'notas';
    default:
      return field;
  }
}

function formatAction(action: string) {
  switch (action) {
    case 'BILLING_SUBSCRIPTION_SUSPENDED':
      return 'Suspensão de assinatura';
    case 'BILLING_SUBSCRIPTION_REACTIVATED':
      return 'Reativação de assinatura';
    case 'BILLING_RECEIPT_CONFIRMED':
      return 'Comprovativo confirmado';
    case 'BILLING_RECEIPT_REJECTED':
      return 'Comprovativo rejeitado';
    default:
      return 'Atualização de assinatura';
  }
}

export default async function BillingAuditHistoryTab() {
  let events: any[] = [];

  try {
    const s = await supabaseServer();

    const { data } = await s
    .from('audit_logs')
    .select('id, created_at, acao, entity_id, escola_id, details')
    .eq('portal', 'super_admin')
    .in('acao', BILLING_ACTIONS)
    .order('created_at', { ascending: false })
    .limit(50);

    events = data || [];
  } catch {
    return EMPTY_STATE;
  }

  if (events.length === 0) {
    return EMPTY_STATE;
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 px-6 py-4 bg-slate-50/50">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Histórico consolidado</p>
        <p className="text-[10px] text-slate-400">Últimos 50 eventos de contratos e comprovativos</p>
      </div>

      <div className="divide-y divide-slate-100">
        {events.map((event: any) => {
          const changedFields = Array.isArray(event.details?.changed_fields) ? event.details.changed_fields : [];
          return (
            <div key={event.id} className="px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{formatAction(event.acao)}</p>
                  <p className="text-[11px] text-slate-500 font-mono">Assinatura: {(event.entity_id || '').slice(0, 8)}</p>
                  <p className="text-[11px] text-slate-400 font-mono">Escola: {(event.escola_id || '').slice(0, 8)}</p>
                </div>
                <p className="text-[11px] text-slate-500 whitespace-nowrap">
                  {format(new Date(event.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: pt })}
                </p>
              </div>

              <div className="mt-2 text-[11px] text-slate-600">
                Campos alterados:{' '}
                {changedFields.length > 0
                  ? changedFields.map((field: string) => formatField(field)).join(', ')
                  : 'sem mudanças rastreadas'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

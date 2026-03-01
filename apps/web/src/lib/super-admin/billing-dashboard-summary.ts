export type BillingAssinaturaSnapshot = {
  id: string;
  ciclo: "mensal" | "anual";
  status: string;
  valor_kz: number;
  data_renovacao: string;
  created_at?: string | null;
};

export type BillingPagamentoSnapshot = {
  assinatura_id: string;
  status: "pendente" | "confirmado" | "falhado" | string;
  comprovativo_url?: string | null;
  periodo_fim?: string | null;
  created_at: string;
};

export type BillingDashboardSummary = {
  mrr: number;
  arr: number;
  pendentes_comprovativo: number;
  vencidas_gt_7d: number;
  vencidas_assinatura_ids: string[];
  mrr_variacao_percentual: number;
  mrr_mes_anterior: number;
  regras: {
    tolerancia_atraso_dias: number;
    renovacao_base: string;
    pagamento_confirmado_status: string;
  };
};

const STATUS_ATIVO = "activa";
const STATUS_PAGAMENTO_CONFIRMADO = "confirmado";
export const TOLERANCIA_ATRASO_DIAS = 7;

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getLatestPaymentBefore(
  paymentsByAssinatura: Map<string, BillingPagamentoSnapshot[]>,
  assinaturaId: string,
  referenceDate: Date,
) {
  const all = paymentsByAssinatura.get(assinaturaId) ?? [];
  const refTs = referenceDate.getTime();
  for (const pg of all) {
    if (new Date(pg.created_at).getTime() <= refTs) return pg;
  }
  return null;
}

function isCoveredByConfirmedPayment(payment: BillingPagamentoSnapshot | null, referenceDate: Date) {
  if (!payment || payment.status !== STATUS_PAGAMENTO_CONFIRMADO) return false;
  if (!payment.periodo_fim) return true;
  return new Date(payment.periodo_fim).getTime() >= startOfDay(referenceDate).getTime();
}

function isOverdue(
  assinatura: BillingAssinaturaSnapshot,
  latestPayment: BillingPagamentoSnapshot | null,
  referenceDate: Date,
) {
  const renewalDate = new Date(assinatura.data_renovacao);
  const renewalDeadline = addDays(renewalDate, TOLERANCIA_ATRASO_DIAS);
  if (renewalDeadline.getTime() >= referenceDate.getTime()) return false;
  return !isCoveredByConfirmedPayment(latestPayment, referenceDate);
}

function computeMrrAt(
  assinaturas: BillingAssinaturaSnapshot[],
  paymentsByAssinatura: Map<string, BillingPagamentoSnapshot[]>,
  referenceDate: Date,
) {
  return assinaturas.reduce((acc, assinatura) => {
    if (assinatura.status !== STATUS_ATIVO || assinatura.ciclo !== "mensal") return acc;

    const latestPayment = getLatestPaymentBefore(paymentsByAssinatura, assinatura.id, referenceDate);
    if (isOverdue(assinatura, latestPayment, referenceDate)) return acc;

    return acc + Number(assinatura.valor_kz ?? 0);
  }, 0);
}

export function buildBillingDashboardSummary(
  assinaturas: BillingAssinaturaSnapshot[],
  pagamentos: BillingPagamentoSnapshot[],
  referenceDate = new Date(),
): BillingDashboardSummary {
  const orderedPayments = [...pagamentos].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const paymentsByAssinatura = orderedPayments.reduce((map, payment) => {
    const bucket = map.get(payment.assinatura_id) ?? [];
    bucket.push(payment);
    map.set(payment.assinatura_id, bucket);
    return map;
  }, new Map<string, BillingPagamentoSnapshot[]>());

  const currentMrr = computeMrrAt(assinaturas, paymentsByAssinatura, referenceDate);
  const previousMonthReference = new Date(referenceDate);
  previousMonthReference.setMonth(previousMonthReference.getMonth() - 1);
  const previousMrr = computeMrrAt(assinaturas, paymentsByAssinatura, previousMonthReference);

  const vencidasAssinaturaIds: string[] = [];
  let arr = 0;

  for (const assinatura of assinaturas) {
    if (assinatura.status !== STATUS_ATIVO) continue;

    const latestPayment = getLatestPaymentBefore(paymentsByAssinatura, assinatura.id, referenceDate);
    if (isOverdue(assinatura, latestPayment, referenceDate)) {
      vencidasAssinaturaIds.push(assinatura.id);
      continue;
    }

    if (assinatura.ciclo === "anual") {
      arr += Number(assinatura.valor_kz ?? 0);
    }
  }

  arr += currentMrr * 12;

  const pendentesComprovativo = orderedPayments.filter(
    (payment) => payment.status === "pendente" && !!payment.comprovativo_url,
  ).length;

  const mrrVariacaoPercentual =
    previousMrr <= 0 ? (currentMrr > 0 ? 100 : 0) : ((currentMrr - previousMrr) / previousMrr) * 100;

  return {
    mrr: currentMrr,
    arr,
    pendentes_comprovativo: pendentesComprovativo,
    vencidas_gt_7d: vencidasAssinaturaIds.length,
    vencidas_assinatura_ids: vencidasAssinaturaIds,
    mrr_variacao_percentual: mrrVariacaoPercentual,
    mrr_mes_anterior: previousMrr,
    regras: {
      tolerancia_atraso_dias: TOLERANCIA_ATRASO_DIAS,
      renovacao_base: "data_renovacao",
      pagamento_confirmado_status: STATUS_PAGAMENTO_CONFIRMADO,
    },
  };
}

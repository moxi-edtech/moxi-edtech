type MoneyInput = number | string | null | undefined;

type PdfMoneyItem = {
  preco_unit: MoneyInput;
  unit_price_base: MoneyInput;
  settlement_amount: MoneyInput;
  total_liquido_moeda: MoneyInput;
  total_impostos_moeda: MoneyInput;
  total_bruto_moeda: MoneyInput;
  total_bruto_aoa: MoneyInput;
};

function toNumber(value: MoneyInput) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function resolveFiscalPdfMoney(params: {
  moeda: string;
  totalsAoa: {
    incidencia: MoneyInput;
    imposto: MoneyInput;
    totalGeral: MoneyInput;
  };
  items: PdfMoneyItem[];
}) {
  const moeda = params.moeda.trim().toUpperCase() || "AOA";
  const foreignCurrency = moeda !== "AOA";

  const itemAmounts = params.items.map((item) => ({
    unitPrice: toNumber(item.unit_price_base ?? item.preco_unit),
    settlementAmount: toNumber(item.settlement_amount),
    total: toNumber(
      foreignCurrency ? item.total_bruto_moeda : item.total_bruto_aoa
    ),
  }));

  const totals = foreignCurrency
    ? params.items.reduce(
        (acc, item) => ({
          incidencia: acc.incidencia + toNumber(item.total_liquido_moeda),
          imposto: acc.imposto + toNumber(item.total_impostos_moeda),
          totalGeral: acc.totalGeral + toNumber(item.total_bruto_moeda),
        }),
        { incidencia: 0, imposto: 0, totalGeral: 0 }
      )
    : {
        incidencia: toNumber(params.totalsAoa.incidencia),
        imposto: toNumber(params.totalsAoa.imposto),
        totalGeral: toNumber(params.totalsAoa.totalGeral),
      };

  return {
    moeda,
    foreignCurrency,
    itemAmounts,
    totals,
  };
}

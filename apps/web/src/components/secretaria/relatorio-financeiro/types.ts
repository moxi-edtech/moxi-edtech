export type Mensal = {
  anoLetivo: number;
  ano: number;
  mes: number;
  labelMes: string;
  competenciaMes: string;
  qtdMensalidades: number;
  qtdEmAtraso: number;
  qtdPagasAdiantadas: number;
  qtdParciais: number;
  totalPrevisto: number;
  totalPago: number;
  totalPagoAdiantado: number;
  totalParcialEmAberto: number;
  totalEmAtraso: number;
  inadimplenciaPct: number;
};

export type CaptacaoItem = {
  label: string;
  matriculas: number;
  confirmacoes: number;
  bolsistas: number;
  total: number;
  detalhes_mensais: Record<string, { matriculas: number; confirmacoes: number; bolsistas: number }>;
};

export type DespesaItem = {
  label: string;
  total: number;
  qtd: number;
};

export type PorTurma = {
  turmaId: string;
  turmaNome: string;
  classe: string | null;
  turno: string | null;
  anoLetivo: number;
  qtdMensalidades: number;
  qtdEmAtraso: number;
  qtdPagasAdiantadas: number;
  qtdParciais: number;
  totalPrevisto: number;
  totalPago: number;
  totalPagoAdiantado: number;
  totalParcialEmAberto: number;
  totalEmAtraso: number;
  inadimplenciaPct: number;
};

export type SessionItem = {
  id: string;
  nome?: string | null;
  status?: string | null;
  ano_letivo?: number | string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
};

export type ResumoFinanceiro = {
  mensalidades: number;
  emAtraso: number;
  pagasAdiantadas: number;
  parciais: number;
  previsto: number;
  pago: number;
  pagoAdiantado: number;
  parcialEmAberto: number;
  atraso: number;
  despesasTotal: number;
  entradasTotal: number;
  saldoAnterior: number;
  saldoPeriodo: number;
  saldoAcumulado: number;
  taxaAtrasoPct: number;
};

export type FluxoMensalItem = {
  mesRef: string;
  saldoAnterior: number;
  entradasTotal: number;
  saidasTotal: number;
  diferenca: number;
  saldoFinal: number;
};

export type InadimplenciaClasseItem = {
  mesRef: string;
  classeId: string;
  classeLabel: string;
  qtdEmAtraso: number;
  valorUnitarioMedio: number;
  totalEmAtraso: number;
  qtdParciais: number;
  totalParcialEmAberto: number;
};

export type MensalidadePreview = {
  competencia: string;
  ano: number;
  mes: number;
  data_vencimento: string;
  valor_base: number;
  valor: number;
};

function monthStart(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day || 1));
}

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function buildMensalidadesPreview(input: {
  dataInicio: string;
  dataFim: string;
  isClasseExame: boolean;
  valorMensalidade: number;
  diaVencimento?: number | null;
  descontoPercentual?: number | null;
  today?: Date;
}): MensalidadePreview[] {
  const valorBase = Math.max(0, Number(input.valorMensalidade || 0));
  if (!valorBase || !input.dataInicio || !input.dataFim) return [];

  const inicio = monthStart(parseDateOnly(input.dataInicio));
  const fim = monthStart(parseDateOnly(input.dataFim));
  const hoje = monthStart(input.today ?? new Date());

  // Deve espelhar public.set_matricula_financial_start()/financeiro.gerar_carnet_anual:
  // a matrícula nova começa financeiramente no mês anterior à entrada, sem nunca
  // retroceder para antes da janela académica da turma.
  if (hoje > fim) return [];
  const mesAnteriorEntrada = new Date(hoje);
  mesAnteriorEntrada.setUTCMonth(mesAnteriorEntrada.getUTCMonth() - 1);
  const primeiro = inicio > mesAnteriorEntrada ? inicio : mesAnteriorEntrada;

  const desconto = Math.min(100, Math.max(0, Number(input.descontoPercentual ?? 0)));
  const valor = Math.round((valorBase * (1 - desconto / 100) + Number.EPSILON) * 100) / 100;
  const dia = Math.min(28, Math.max(1, Number(input.diaVencimento ?? 10)));

  const items: MensalidadePreview[] = [];
  for (let cursor = new Date(primeiro); cursor <= fim; cursor.setUTCMonth(cursor.getUTCMonth() + 1)) {
    if (!input.isClasseExame && cursor.getTime() === fim.getTime()) break;
    const ano = cursor.getUTCFullYear();
    const mes = cursor.getUTCMonth() + 1;
    const vencimento = new Date(Date.UTC(ano, mes - 1, dia));
    items.push({
      competencia: `${ano}-${String(mes).padStart(2, "0")}`,
      ano,
      mes,
      data_vencimento: formatDateOnly(vencimento),
      valor_base: valorBase,
      valor,
    });
  }
  return items;
}

export function normalizeCompetenciasPrefix(
  available: MensalidadePreview[],
  selected: string[],
): string[] {
  if (!selected.length) return [];
  const indexes = selected
    .map((competencia) => available.findIndex((item) => item.competencia === competencia))
    .filter((index) => index >= 0);
  if (!indexes.length) return [];
  const maxIndex = Math.max(...indexes);
  return available.slice(0, maxIndex + 1).map((item) => item.competencia);
}

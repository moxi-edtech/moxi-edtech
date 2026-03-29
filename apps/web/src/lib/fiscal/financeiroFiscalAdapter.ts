import "server-only";

type TipoFluxoFinanceiro = "immediate_payment" | "deferred_payment";
type PaymentMechanism = "NU" | "TB" | "CC" | "MB";
type FiscalTipoDocumento = "FR" | "FT" | "RC";

const CONSUMIDOR_FINAL_NIF = "999999999";
const CONSUMIDOR_FINAL_NOME = "Consumidor final";
const DESCONHECIDO = "Desconhecido";

type AdapterItem = {
  descricao: string;
  valor: number;
};

type AdapterCliente = {
  nome?: string | null;
  nif?: string | null;
};

type EmitirFinanceiroFiscalInput = {
  tipoFluxoFinanceiro: TipoFluxoFinanceiro;
  origemOperacao: string;
  origemId: string;
  descricaoPrincipal: string;
  itens: AdapterItem[];
  cliente?: AdapterCliente;
  escolaId: string;
  origin: string;
  cookieHeader?: string | null;
  paymentMechanism?: PaymentMechanism;
  metadata?: Record<string, unknown>;
  prefixoSerie?: string;
  invoiceDate?: string;
};

type ComplianceStatusResponse = {
  ok?: boolean;
  data?: {
    empresa_id?: string | null;
  };
  error?: {
    code?: string;
    message?: string;
  };
};

type FiscalDocumentoResponse = {
  ok?: boolean;
  data?: {
    documento_id?: string;
    numero_formatado?: string;
    hash_control?: string;
    key_version?: number;
  };
  error?: {
    code?: string;
    message?: string;
  };
};

export type EmitirFinanceiroFiscalResult = {
  empresa_id: string;
  tipo_documento: FiscalTipoDocumento;
  documento_id: string;
  numero_formatado: string;
  hash_control: string;
  key_version: number;
  payload_snapshot: Record<string, unknown>;
};

function sanitizeMoney(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Number(value.toFixed(2));
}

function normalizeTipoDocumento(tipoFluxoFinanceiro: TipoFluxoFinanceiro): FiscalTipoDocumento {
  if (tipoFluxoFinanceiro === "immediate_payment") return "FR";
  return "FT";
}

function isValidNif(value: string | null | undefined) {
  if (!value) return false;
  const normalized = value.trim();
  return /^\d{9,20}$/.test(normalized);
}

function normalizeCliente(cliente?: AdapterCliente) {
  const rawNome = cliente?.nome?.trim();
  const rawNif = cliente?.nif?.trim();

  if (!isValidNif(rawNif)) {
    return {
      nome: CONSUMIDOR_FINAL_NOME,
      nif: CONSUMIDOR_FINAL_NIF,
      address_detail: DESCONHECIDO,
      city: DESCONHECIDO,
      postal_code: DESCONHECIDO,
      country: DESCONHECIDO,
      fallback: true,
    };
  }

  return {
    nome: rawNome && rawNome.length > 0 ? rawNome : CONSUMIDOR_FINAL_NOME,
    nif: rawNif!,
    address_detail: DESCONHECIDO,
    city: DESCONHECIDO,
    postal_code: DESCONHECIDO,
    country: DESCONHECIDO,
    fallback: false,
  };
}

function toFiscalHeaders({
  escolaId,
  cookieHeader,
}: {
  escolaId: string;
  cookieHeader?: string | null;
}) {
  const headers = new Headers({
    "Content-Type": "application/json",
    "x-escola-id": escolaId,
  });

  if (cookieHeader && cookieHeader.trim().length > 0) {
    headers.set("cookie", cookieHeader);
  }

  return headers;
}

export async function resolveEmpresaFiscalAtiva({
  origin,
  escolaId,
  cookieHeader,
}: {
  origin: string;
  escolaId: string;
  cookieHeader?: string | null;
}) {
  const response = await fetch(`${origin}/api/fiscal/compliance/status`, {
    method: "GET",
    headers: toFiscalHeaders({ escolaId, cookieHeader }),
    cache: "no-store",
  });

  const json = (await response.json().catch(() => null)) as ComplianceStatusResponse | null;

  if (!response.ok || json?.ok !== true || !json.data?.empresa_id) {
    const message = json?.error?.message ?? "Não foi possível resolver a empresa fiscal para emissão.";
    throw new Error(`FISCAL_EMPRESA_CONTEXT_REQUIRED: ${message}`);
  }

  return json.data.empresa_id;
}

export async function emitirDocumentoFiscalViaAdapter(
  input: EmitirFinanceiroFiscalInput
): Promise<EmitirFinanceiroFiscalResult> {
  const empresaId = await resolveEmpresaFiscalAtiva({
    origin: input.origin,
    escolaId: input.escolaId,
    cookieHeader: input.cookieHeader,
  });

  const tipoDocumento = normalizeTipoDocumento(input.tipoFluxoFinanceiro);
  const prefixoSerie = (input.prefixoSerie?.trim() || tipoDocumento).toUpperCase();
  const cliente = normalizeCliente(input.cliente);
  const itens = input.itens
    .map((item) => ({
      descricao: item.descricao.trim(),
      valor: sanitizeMoney(item.valor),
    }))
    .filter((item) => item.descricao.length > 0 && item.valor > 0);

  if (itens.length === 0) {
    throw new Error("FISCAL_ADAPTER_INVALID_ITEMS: Nenhum item válido para emissão fiscal.");
  }

  const today = new Date().toISOString().slice(0, 10);
  const fiscalPayload: Record<string, unknown> = {
    empresa_id: empresaId,
    tipo_documento: tipoDocumento,
    prefixo_serie: prefixoSerie,
    origem_documento: "integrado",
    invoice_date: input.invoiceDate ?? today,
    moeda: "AOA",
    cliente: {
      nome: cliente.nome,
      nif: cliente.nif,
      address_detail: cliente.address_detail,
      city: cliente.city,
      postal_code: cliente.postal_code,
      country: cliente.country,
    },
    itens: itens.map((item, index) => ({
      descricao: item.descricao,
      product_code: `SERV_INTEGRADO_${index + 1}`,
      quantidade: 1,
      preco_unit: item.valor,
      taxa_iva: 14,
    })),
    metadata: {
      origem_integracao: "financeiro_fiscal_adapter",
      tipo_fluxo_financeiro: input.tipoFluxoFinanceiro,
      origem_operacao: input.origemOperacao,
      origem_id: input.origemId,
      cliente_fallback_consumidor_final: cliente.fallback,
      descricao_principal: input.descricaoPrincipal,
      ...(input.metadata ?? {}),
    },
  };

  if (tipoDocumento === "RC" && input.paymentMechanism) {
    fiscalPayload.payment_mechanism = input.paymentMechanism;
  }

  const response = await fetch(`${input.origin}/api/fiscal/documentos`, {
    method: "POST",
    headers: toFiscalHeaders({ escolaId: input.escolaId, cookieHeader: input.cookieHeader }),
    body: JSON.stringify(fiscalPayload),
    cache: "no-store",
  });

  const json = (await response.json().catch(() => null)) as FiscalDocumentoResponse | null;

  if (!response.ok || json?.ok !== true || !json.data?.documento_id) {
    const code = json?.error?.code ?? "FISCAL_ADAPTER_EMIT_FAILED";
    const message = json?.error?.message ?? "Falha ao emitir documento fiscal pelo adapter.";
    throw new Error(`${code}: ${message}`);
  }

  return {
    empresa_id: empresaId,
    tipo_documento: tipoDocumento,
    documento_id: json.data.documento_id,
    numero_formatado: json.data.numero_formatado ?? "Sem número",
    hash_control: json.data.hash_control ?? "",
    key_version: Number(json.data.key_version ?? 0),
    payload_snapshot: fiscalPayload,
  };
}

export type { TipoFluxoFinanceiro, EmitirFinanceiroFiscalInput };

import "server-only";

import { FISCAL_TAX_PROFILE_CODES, type FiscalTaxProfileCode } from "@/lib/fiscal/taxProfiles";
import {
  cmpExact,
  exactToJsonNumber,
  parseExactDecimal,
  roundExact,
  type DecimalInput,
} from "@/lib/fiscal/decimal";
import { supabaseServerRole } from "@/lib/supabaseServerRole";

type TipoFluxoFinanceiro = "immediate_payment" | "deferred_payment";
type PaymentMechanism = "NU" | "TB" | "CC" | "MB";
type FiscalTipoDocumento = "FR" | "FT" | "RC";

const CONSUMIDOR_FINAL_NIF = "999999999";
const CONSUMIDOR_FINAL_NOME = "Consumidor final";
const DESCONHECIDO = "Desconhecido";

type AdapterItem = {
  descricao: string;
  valor: DecimalInput;
  taxProfileCode?: FiscalTaxProfileCode | string;
  productCode?: string;
  productNumberCode?: string;
  quantidade?: DecimalInput;
  unitPriceBase?: DecimalInput;
  settlementAmount?: DecimalInput;
  productType?: "P" | "S" | "O" | "E" | "I";
  operationType?: "SE" | "SS" | "STP" | "SR" | "SIF" | "SHS" | "ST" | "SG" | "TB" | "AS" | "QT" | "RD";
  unitOfMeasure?: string;
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

function normalizeNonNegative(
  value: DecimalInput,
  field: string,
  decimals: number
) {
  const exact = parseExactDecimal(value, field);
  if (cmpExact(exact, parseExactDecimal("0")) < 0) {
    throw new Error(`FISCAL_ADAPTER_INVALID_AMOUNT: ${field} não pode ser negativo.`);
  }
  return exactToJsonNumber(roundExact(exact, decimals, "half-up"), decimals);
}

function normalizePositive(
  value: DecimalInput,
  field: string,
  decimals: number
) {
  const exact = parseExactDecimal(value, field);
  if (cmpExact(exact, parseExactDecimal("0")) <= 0) {
    throw new Error(`FISCAL_ADAPTER_INVALID_AMOUNT: ${field} deve ser positivo.`);
  }
  return exactToJsonNumber(roundExact(exact, decimals, "half-up"), decimals);
}

function safeInteger(value: unknown, field: string) {
  const raw =
    typeof value === "number"
      ? value.toString()
      : typeof value === "string"
        ? value.trim()
        : "";
  if (!/^\d+$/.test(raw)) {
    throw new Error(`FISCAL_ADAPTER_INVALID_INTEGER: ${field}`);
  }
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== "number" || !Number.isSafeInteger(parsed)) {
    throw new Error(`FISCAL_ADAPTER_INVALID_INTEGER: ${field}`);
  }
  return parsed;
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
      country: "AO",
      fallback: true,
    };
  }

  return {
    nome: rawNome && rawNome.length > 0 ? rawNome : CONSUMIDOR_FINAL_NOME,
    nif: rawNif!,
    address_detail: DESCONHECIDO,
    city: DESCONHECIDO,
    postal_code: DESCONHECIDO,
    country: "AO",
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

export async function isFiscalEngineEnabledForSchool(escolaId: string): Promise<boolean> {
  const admin = supabaseServerRole<any>();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await admin
    .from("fiscal_escola_bindings")
    .select("id")
    .eq("escola_id", escolaId)
    .eq("fiscal_enabled", true)
    .lte("effective_from", today)
    .or(`effective_to.is.null,effective_to.gte.${today}`)
    .limit(1);

  if (error) {
    throw new Error(`FISCAL_ENGINE_GATE_LOOKUP_FAILED: ${error.message}`);
  }

  return Array.isArray(data) && data.length > 0;
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

async function resolveEducationTaxProfileForEmpresa(empresaId: string) {
  const admin = supabaseServerRole<any>();
  const { data, error } = await admin.rpc("fiscal_resolve_education_tax_profile", {
    p_empresa_id: empresaId,
  });

  if (error || typeof data !== "string" || data.trim().length === 0) {
    throw new Error(
      `FISCAL_EDUCATION_TAX_PROFILE_UNRESOLVED: ${error?.message ?? "Enquadramento IVA do ensino não resolvido."}`
    );
  }

  return data.trim() as FiscalTaxProfileCode;
}

export async function emitirDocumentoFiscalViaAdapter(
  input: EmitirFinanceiroFiscalInput
): Promise<EmitirFinanceiroFiscalResult> {
  const fiscalEnabled = await isFiscalEngineEnabledForSchool(input.escolaId);
  if (!fiscalEnabled) {
    throw new Error(
      "FISCAL_ENGINE_NOT_ENABLED: motor fiscal não está ativado para esta escola."
    );
  }

  const empresaId = await resolveEmpresaFiscalAtiva({
    origin: input.origin,
    escolaId: input.escolaId,
    cookieHeader: input.cookieHeader,
  });

  const tipoDocumento = normalizeTipoDocumento(input.tipoFluxoFinanceiro);
  const prefixoSerie = (input.prefixoSerie?.trim() || tipoDocumento).toUpperCase();
  const cliente = normalizeCliente(input.cliente);
  const needsEducationProfile = input.itens.some(
    (item) => item.operationType === "SE" && !item.taxProfileCode
  );
  const resolvedEducationProfile = needsEducationProfile
    ? await resolveEducationTaxProfileForEmpresa(empresaId)
    : null;
  const itens = input.itens
    .map((item) => ({
      ...item,
      descricao: item.descricao.trim(),
      valor: normalizeNonNegative(item.valor, "valor", 4),
      quantidade:
        item.quantidade == null
          ? 1
          : normalizePositive(item.quantidade, "quantidade", 6),
      unitPriceBase:
        item.unitPriceBase == null
          ? undefined
          : normalizeNonNegative(item.unitPriceBase, "unitPriceBase", 4),
      settlementAmount:
        item.settlementAmount == null
          ? 0
          : normalizeNonNegative(item.settlementAmount, "settlementAmount", 2),
      taxProfileCode:
        item.taxProfileCode ??
        (item.operationType === "SE" ? resolvedEducationProfile ?? undefined : undefined),
    }))
    .filter((item) => item.descricao.length > 0 && item.valor >= 0);

  if (itens.some((item) => !item.taxProfileCode)) {
    throw new Error(
      "FISCAL_TAX_PROFILE_REQUIRED: Todo item fiscal deve possuir classificação tributária resolvida."
    );
  }

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
    itens: itens.map((item, index) => {
      const isEducation =
        item.taxProfileCode === FISCAL_TAX_PROFILE_CODES.educationM21;
      return {
        descricao: item.descricao,
        product_code:
          item.productCode?.trim() || `SERV_INTEGRADO_${index + 1}`,
        product_number_code:
          item.productNumberCode?.trim() ||
          item.productCode?.trim() ||
          `SERV_INTEGRADO_${index + 1}`,
        tax_profile_code: item.taxProfileCode,
        product_type: item.productType ?? "S",
        operation_type: item.operationType ?? (isEducation ? "SE" : "SG"),
        unit_of_measure: item.unitOfMeasure ?? "UN",
        quantidade: item.quantidade,
        unit_price_base: item.unitPriceBase ?? item.valor,
        preco_unit: item.valor,
        settlement_amount: item.settlementAmount,
      };
    }),
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
    key_version: safeInteger(json.data.key_version ?? 0, "key_version"),
    payload_snapshot: fiscalPayload,
  };
}

export type { TipoFluxoFinanceiro, EmitirFinanceiroFiscalInput };

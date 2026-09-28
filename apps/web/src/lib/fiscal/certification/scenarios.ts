import type { PostFiscalDocumentoInput } from "@/lib/schemas/fiscal-documento.schema";
import type { CertificationPoint } from "@/lib/fiscal/certification/types";

export const CERTIFICATION_ORIGIN_OPERATION = "agt_certification_0000498";

type BuildContext = {
  runId: string;
  empresaId: string;
  invoiceDate: string;
};

function metadata(ctx: BuildContext, point: CertificationPoint, role = "primary") {
  return {
    certification_office_reference: "0000498/01180000/AGT/2026",
    certification_run_id: ctx.runId,
    certification_point: point,
    certification_role: role,
    origem_operacao: CERTIFICATION_ORIGIN_OPERATION,
    origem_id: `${ctx.runId}:${point}:${role}`,
  };
}

const identifiedWithNif = {
  nome: "Cliente Certificação AGT",
  nif: "5002637618",
  address_detail: "Luanda",
  city: "Luanda",
  postal_code: "1000",
  country: "AO",
} as const;

const normalItem = (description: string, code: string, value: number) => ({
  descricao: description,
  product_code: code,
  product_number_code: code,
  tax_profile_code: "IVA_NORMAL_14_AO",
  product_type: "S" as const,
  operation_type: "SE" as const,
  unit_of_measure: "UN",
  tax_country_region: "AO",
  quantidade: 1,
  preco_unit: value,
  taxa_iva: 14,
  settlement_amount: 0,
});

function base(
  ctx: BuildContext,
  point: CertificationPoint,
  tipoDocumento: PostFiscalDocumentoInput["tipo_documento"],
  role = "primary"
): Omit<PostFiscalDocumentoInput, "itens"> {
  const local = ["PP", "GR", "GT"].includes(tipoDocumento);
  return {
    empresa_id: ctx.empresaId,
    tipo_documento: tipoDocumento,
    prefixo_serie: tipoDocumento,
    origem_documento: local ? "interno" : "integrado",
    cliente: { ...identifiedWithNif },
    invoice_date: ctx.invoiceDate,
    moeda: "AOA",
    metadata: metadata(ctx, point, role),
  };
}

export function buildP01(ctx: BuildContext): PostFiscalDocumentoInput {
  return {
    ...base(ctx, "P01", "FT"),
    itens: [normalItem("P01 - Serviço com cliente identificado", "AGT-P01", 1000)],
  };
}

export function buildP02(ctx: BuildContext): PostFiscalDocumentoInput {
  return {
    ...base(ctx, "P02", "FT"),
    itens: [normalItem("P02 - Documento a anular", "AGT-P02", 1200)],
  };
}

export function buildP03(ctx: BuildContext): PostFiscalDocumentoInput {
  return {
    ...base(ctx, "P03", "PP"),
    itens: [normalItem("P03 - Pró-forma de certificação", "AGT-P03", 1500)],
  };
}

export function buildP04(
  ctx: BuildContext,
  proformaId: string
): PostFiscalDocumentoInput {
  return {
    ...base(ctx, "P04", "FT"),
    documento_origem_id: proformaId,
    itens: [normalItem("P04 - Fatura originada de pró-forma", "AGT-P04", 1500)],
  };
}

export function buildP05(
  ctx: BuildContext,
  invoiceId: string
): PostFiscalDocumentoInput {
  return {
    ...base(ctx, "P05", "NC"),
    rectifica_documento_id: invoiceId,
    itens: [normalItem("P05 - Nota de crédito da P04", "AGT-P05", 1500)],
    metadata: {
      ...metadata(ctx, "P05"),
      reference_reason: "Correção para certificação AGT",
    },
  };
}

export function buildP06(ctx: BuildContext): PostFiscalDocumentoInput {
  return {
    ...base(ctx, "P06", "FT"),
    itens: [
      normalItem("P06 - Linha tributada a 14%", "AGT-P06-14", 100),
      {
        descricao: "P06 - Linha isenta M21",
        product_code: "AGT-P06-M21",
        product_number_code: "AGT-P06-M21",
        tax_profile_code: "IVA_EDUCACAO_M21",
        product_type: "S",
        operation_type: "SE",
        unit_of_measure: "UN",
        tax_country_region: "AO",
        quantidade: 1,
        preco_unit: 50,
        taxa_iva: 0,
        settlement_amount: 0,
        tax_exemption_code: "M21",
        tax_exemption_reason: "Ensino isento - al. l), n. 1 do art. 12 do CIVA",
      },
    ],
  };
}

export function buildP07(ctx: BuildContext): PostFiscalDocumentoInput {
  return {
    ...base(ctx, "P07", "FT"),
    global_discount_pct: 1.5,
    itens: [
      {
        ...normalItem("P07 - 100 x 0,55 com descontos", "AGT-P07", 0.55),
        quantidade: 100,
        line_discount_pct: 8.8,
      },
    ],
  };
}

export function buildP08(ctx: BuildContext): PostFiscalDocumentoInput {
  return {
    ...base(ctx, "P08", "FT"),
    moeda: "USD",
    taxa_cambio_aoa: 920,
    itens: [normalItem("P08 - Serviço em USD", "AGT-P08-USD", 50)],
  };
}

export function buildP09(ctx: BuildContext): PostFiscalDocumentoInput {
  return {
    ...base(ctx, "P09", "FT"),
    cliente: {
      nome: "Cliente Identificado Sem NIF P09",
      address_detail: "Luanda",
      city: "Luanda",
      postal_code: "1000",
      country: "AO",
    },
    itens: [normalItem("P09 - Total inferior a 50 AOA", "AGT-P09", 40)],
  };
}

export function buildP10(ctx: BuildContext): PostFiscalDocumentoInput {
  return {
    ...base(ctx, "P10", "FT"),
    cliente: {
      nome: "Cliente Identificado Sem NIF P10",
      address_detail: "Benguela",
      city: "Benguela",
      postal_code: "2000",
      country: "AO",
    },
    itens: [normalItem("P10 - Segundo cliente identificado sem NIF", "AGT-P10", 100)],
  };
}

export function buildP11(ctx: BuildContext): PostFiscalDocumentoInput[] {
  return (["GR", "GT"] as const).map((type) => ({
    ...base(ctx, "P11", type, type.toLowerCase()),
    itens: [
      {
        ...normalItem(`P11 - Guia ${type}`, `AGT-P11-${type}`, 30),
        product_type: "P",
        operation_type: "TB",
        quantidade: 2,
      },
    ],
  }));
}

export function buildP14(ctx: BuildContext): PostFiscalDocumentoInput {
  return {
    ...base(ctx, "P14", "FG"),
    metadata: {
      ...metadata(ctx, "P14"),
      operation_date: ctx.invoiceDate,
    },
    itens: [
      normalItem("P14 - Serviço global A", "AGT-P14-A", 250),
      normalItem("P14 - Serviço global B", "AGT-P14-B", 125),
    ],
  };
}

export function buildP15Nd(
  ctx: BuildContext,
  originInvoiceId: string
): PostFiscalDocumentoInput {
  return {
    ...base(ctx, "P15", "ND", "nd"),
    documento_origem_id: originInvoiceId,
    itens: [normalItem("P15 - Nota de débito", "AGT-P15-ND", 75)],
    metadata: {
      ...metadata(ctx, "P15", "nd"),
      reference_reason: "Ajuste para certificação AGT",
    },
  };
}

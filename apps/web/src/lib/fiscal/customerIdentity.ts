export const CONSUMIDOR_FINAL_NIF = "999999999";
export const CONSUMIDOR_FINAL_NOME = "Consumidor final";
export const FISCAL_ADDRESS_UNKNOWN = "Desconhecido";

function normalizeOptional(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export function isGenericConsumidorFinal(params: {
  nome?: string | null;
  nif?: string | null;
}) {
  const nif = normalizeOptional(params.nif);
  const nome = normalizeOptional(params.nome);
  return (
    (!nif || nif === CONSUMIDOR_FINAL_NIF) &&
    (!nome || nome.toLocaleLowerCase("pt") === CONSUMIDOR_FINAL_NOME.toLocaleLowerCase("pt"))
  );
}

export function normalizeFiscalCustomerInput(params: {
  nome: string;
  nif?: string | null;
  address_detail?: string | null;
  city?: string | null;
  postal_code?: string | null;
  country?: string | null;
}) {
  const nome = params.nome.trim();
  const nif = normalizeOptional(params.nif);
  const identifiedWithoutNif = !nif && !isGenericConsumidorFinal({ nome, nif });
  const genericConsumidorFinal = !nif && !identifiedWithoutNif;

  const normalizeAddress = (value: string | null | undefined) =>
    normalizeOptional(value) ?? FISCAL_ADDRESS_UNKNOWN;

  return {
    nome: genericConsumidorFinal ? CONSUMIDOR_FINAL_NOME : nome,
    nif: nif ?? CONSUMIDOR_FINAL_NIF,
    address_detail: genericConsumidorFinal
      ? FISCAL_ADDRESS_UNKNOWN
      : normalizeAddress(params.address_detail),
    city: genericConsumidorFinal
      ? FISCAL_ADDRESS_UNKNOWN
      : normalizeAddress(params.city),
    postal_code: genericConsumidorFinal
      ? FISCAL_ADDRESS_UNKNOWN
      : normalizeAddress(params.postal_code),
    country: (normalizeOptional(params.country) ?? "AO").toUpperCase(),
    identifiedWithoutNif,
    genericConsumidorFinal,
  };
}

export function buildSaftCustomerIdentity(params: {
  documentoId: string;
  nome: string;
  nif?: string | null;
}) {
  const rawNif = normalizeOptional(params.nif);
  const rawNome = normalizeOptional(params.nome);
  const withoutNif = !rawNif || rawNif === CONSUMIDOR_FINAL_NIF;

  if (withoutNif) {
    const generic = isGenericConsumidorFinal({
      nome: rawNome,
      nif: rawNif ?? CONSUMIDOR_FINAL_NIF,
    });

    if (generic) {
      return {
        id: `NIF-${CONSUMIDOR_FINAL_NIF}`,
        nif: CONSUMIDOR_FINAL_NIF,
        nome: CONSUMIDOR_FINAL_NOME,
        genericConsumidorFinal: true,
        identifiedWithoutNif: false,
      };
    }

    const compactDocumentId = params.documentoId.replace(/[^A-Za-z0-9]/g, "");
    return {
      id: `SNIF-${compactDocumentId.slice(0, 24)}`,
      nif: CONSUMIDOR_FINAL_NIF,
      nome: rawNome ?? "Cliente sem NIF",
      genericConsumidorFinal: false,
      identifiedWithoutNif: true,
    };
  }

  const id = `NIF-${rawNif}`;
  if (id.length > 30) {
    throw new Error(
      `SAFT_SEMANTIC_ERROR: CustomerID excede 30 caracteres para NIF ${rawNif}.`
    );
  }

  return {
    id,
    nif: rawNif,
    nome: rawNome ?? "Cliente",
    genericConsumidorFinal: false,
    identifiedWithoutNif: false,
  };
}

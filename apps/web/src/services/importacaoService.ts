import { createClient } from "@/lib/supabaseClient";
import type { ImportAlunoDTO, ImportResult } from "@/types/importacao";
import type { Json } from "~types/supabase";
import { cleanExcelDate, cleanPhone } from "@/utils/excelHelpers";

// Helper para buscar valor independentemente de maiúsculas/minúsculas ou acentos
const getColumnValue = (row: any, possibleKeys: string[]) => {
  const rowKeys = Object.keys(row);

  const normalize = (str: string) =>
    str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();

  for (const key of possibleKeys) {
    if (row[key] !== undefined) return row[key];

    const foundKey = rowKeys.find((k) => normalize(k) === normalize(key));
    if (foundKey !== undefined && row[foundKey] !== undefined) return row[foundKey];
  }

  return undefined;
};

// Mapeia a linha crua do Excel para o DTO da RPC
const mapRowToDTO = (row: any): ImportAlunoDTO | null => {
  const nomeRaw = getColumnValue(row, ["NOME_COMPLETO", "Nome Completo", "Nome do Aluno"]);

  if (!nomeRaw || String(nomeRaw).trim() === "") {
    return null;
  }

  return {
    nome: String(nomeRaw).trim().toUpperCase(),

    numero_processo:
      getColumnValue(row, ["NUMERO_PROCESSO", "Nº Processo", "Processo"])
        ?.toString()
        .trim() || null,

    data_nascimento: cleanExcelDate(
      getColumnValue(row, ["DATA_NASCIMENTO", "Data de Nascimento", "Data Nascimento"])
    ),

    genero:
      String(getColumnValue(row, ["GENERO", "Gênero", "Sexo"]) || "M")
        .trim()
        .toUpperCase()
        .startsWith("F")
        ? "F"
        : "M",

    bi_numero:
      getColumnValue(row, ["BI_NUMERO", "Nº do BI", "Bilhete de Identidade", "BI"])
        ?.toString()
        .replace(/\s/g, "")
        .toUpperCase() || null,

    nif:
      getColumnValue(row, ["NIF", "Nif"])
        ?.toString()
        .trim()
        .toUpperCase() || null,

    encarregado_nome:
      getColumnValue(row, ["NOME_ENCARREGADO", "Nome do Encarregado", "Encarregado"])
        ?.toString()
        .trim() || null,

    encarregado_telefone: cleanPhone(
      getColumnValue(row, ["TELEFONE_ENCARREGADO", "Telefone do Encarregado", "Telefone"])
    ),

    encarregado_email:
      getColumnValue(row, ["EMAIL_ENCARREGADO", "Email do Encarregado", "Email"])
        ?.toString()
        .toLowerCase()
        .trim() || null,

    turma_codigo:
      getColumnValue(row, ["TURMA_CODIGO", "Código da Turma", "Turma"])
        ?.toString()
        .replace(/\s/g, "")
        .toUpperCase() || null,
  };
};

/**
 * Função principal: trata linhas do Excel e chama a RPC importar_alunos_v2.
 */
export const processarImportacaoAlunos = async (
  escolaId: string,
  anoLetivo: number,
  rawRows: any[]
): Promise<ImportResult> => {
  const supabase = createClient();

  const alunosPayload: ImportAlunoDTO[] = rawRows
    .map(mapRowToDTO)
    .filter((a): a is ImportAlunoDTO => a !== null);

  if (alunosPayload.length === 0) {
    throw new Error("O arquivo não contém alunos válidos ou as colunas estão erradas.");
  }

  const { data, error } = await supabase.rpc("importar_alunos_v2", {
    p_escola_id: escolaId,
    p_ano_letivo: anoLetivo,
    p_alunos: alunosPayload as unknown as Json,
  });

  if (error) {
    throw new Error(`Erro ao processar importação: ${error.message}`);
  }

  return data as unknown as ImportResult;
};

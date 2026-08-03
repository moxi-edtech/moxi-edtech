import assert from "node:assert/strict";
import test from "node:test";
import { normaliseNotaSpreadsheetRow, previewNotaImport } from "../../src/lib/virada/notas-import";
import { buildPricingProposal } from "../../src/lib/virada/pricing-adjustment";

test("preview de notas aceita vírgula decimal e resultado final", () => {
  const preview = previewNotaImport([
    { numero_processo: "CUR-001", disciplina: "Matemática", periodo: "III", nota: "14,5" },
    { numero_processo: "CUR-002", resultado_final: "concluido" },
  ]);

  assert.equal(preview.validas.length, 2);
  assert.equal(preview.validas[0]?.nota, 14.5);
  assert.equal(preview.validas[1]?.resultado_final, "CONCLUIDO");
  assert.equal(preview.rejeitadas.length, 0);
});

test("normaliza cabeçalhos comuns de planilha", () => {
  assert.deepEqual(
    normaliseNotaSpreadsheetRow({ "Número de Processo": "CUR-001", "Classificação": "15,5", "Trimestre": "III" }),
    { numero_processo: "CUR-001", nota: "15,5", periodo: "III" },
  );
});

test("preview de notas rejeita linha ambígua e duplicado", () => {
  const preview = previewNotaImport([
    { aluno_nome: "Sem identificador", resultado_final: "TRANSITADO" },
    { numero_processo: "CUR-001", resultado_final: "TRANSITADO" },
    { numero_processo: "CUR-001", resultado_final: "TRANSITADO" },
  ]);

  assert.equal(preview.rejeitadas.length, 1);
  assert.equal(preview.duplicadas.length, 1);
});

test("proposta financeira aceita percentual e override manual", () => {
  const rows = [{
    id: "0d864b3f-df61-4567-a2cc-349e7dcd7c13",
    curso_id: null,
    classe_id: null,
    valor_matricula: 2_000,
    valor_mensalidade: 4_000,
    dia_vencimento: 10,
    multa_atraso_percentual: 2,
    multa_diaria: 0,
  }];

  const proposta = buildPricingProposal(rows, {
    percentual: 10,
    arredondar_para: 100,
    overrides: {
      "0d864b3f-df61-4567-a2cc-349e7dcd7c13": { valor_mensalidade: 5_000 },
    },
  });

  assert.equal(proposta[0]?.valor_matricula_proposto, 2_200);
  assert.equal(proposta[0]?.valor_mensalidade_proposto, 5_000);
  assert.equal(proposta[0]?.alterado_manualmente, true);
});

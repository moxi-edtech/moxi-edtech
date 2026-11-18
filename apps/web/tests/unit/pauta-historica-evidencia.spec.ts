import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPautaHistoricaReview } from "../../src/lib/academico/pauta-historica-evidencia";

const nota = (disciplina_id: string, disciplina_nome: string, nota_final: number, arquivo: string,
  extra: Record<string, unknown> = {}) => ({
  disciplina_id, disciplina_nome, nota_final,
  notas_detalhe: { ano_letivo: "2025/2026", arquivo, aba: "6ª Classe", linha: "81", escala_maxima: 10, ...extra },
});

test("historic subjects remain the source even when 2025 operational matrix groups History and Geography", () => {
  const rows = [
    nota("hist", "História", 8, "MAPA_FINAL_DE_EXAME_DA_6ª_CLASSE-2025-2026.xlsx"),
    nota("geo", "Geografia", 9, "MAPA_FINAL_DE_EXAME_DA_6ª_CLASSE-2025-2026.xlsx"),
    nota("art", "Educação Visual e Plástica", 7, "MAPA_FINAL_DE_EXAME_DA_6ª_CLASSE-2025-2026.xlsx"),
  ];
  const review = buildPautaHistoricaReview(rows, new Set(["historia_geografia", "visual_tecnologica"]), "000150", 2025);
  assert.equal(review.contagem_notas, 3);
  assert.equal(review.sem_mapeamento, 3);
  assert.deepEqual(review.disciplinas.map((d) => d.nome), ["Educação Visual e Plástica", "Geografia", "História"]);
  assert.ok(review.alertas.includes("MATRIZ_ATUAL_DIFERENTE_DA_PAUTA"));
  assert.equal(review.evidencia_original_confirmada, false);
});

test("an old filename is flagged without falsely replacing the actual school-year metadata", () => {
  const review = buildPautaHistoricaReview([
    nota("pt", "Português", 7, "MAPA DE APROVEITAMENTO FINAL 2ª CLASSE-2023-24.xlsx", {ano_letivo: "2025",numero_processo: "000031"}),
  ], new Set(["pt"]), "31", 2025);
  assert.ok(review.alertas.includes("ANO_NO_NOME_DO_ARQUIVO"));
  assert.equal(review.divergencia_ano_documento, false);
  assert.equal(review.processo_verificado, true);
  assert.deepEqual(review.arquivos, ["MAPA DE APROVEITAMENTO FINAL 2ª CLASSE-2023-24.xlsx"]);
});

test("mismatched original year, process, scale and duplicated discipline are review alerts", () => {
  const rows = [
    nota("math", "Matemática", 11, "MAPA-2025-26.xlsx", {ano_letivo: "2023/2024",numero_processo: "000150"}),
    nota("math", "Matemática", 5, "MAPA-2025-26.xlsx"),
  ];
  const review = buildPautaHistoricaReview(rows, new Set(["math"]), "000151", 2025);
  assert.equal(review.processo_verificado, false);
  assert.equal(review.divergencia_ano_documento, true);
  for(const code of ["PROCESSO_DIVERGENTE","ANO_DECLARADO_NA_ORIGEM","NOTA_OU_ESCALA_INVALIDA","DISCIPLINA_REPETIDA"])
    assert.ok(review.alertas.includes(code), code);
});

test("a below-half subject triggers manual RAA review and never automatic rejection", () => {
  const review = buildPautaHistoricaReview([
    nota("math", "Matemática", 4.8, "6classe-2025-26.xlsx"),
    nota("pt", "Língua Portuguesa", 8.5, "6classe-2025-26.xlsx"),
  ], new Set(["math","pt"]), "000220", 2025);
  assert.equal(review.notas_abaixo_metade, 1);
  assert.ok(review.disciplinas.find((d) => d.id === "math")?.nota_abaixo_metade);
  assert.ok(review.alertas.includes("NOTAS_BAIXAS_VERIFICAR_RAA"));
  assert.equal(review.evidencia_original_confirmada, false);
});

test("unknown or absent original XLSX must never be treated as certified by import metadata", () => {
  const review = buildPautaHistoricaReview([], null, null, 2025);
  assert.ok(review.alertas.includes("SEM_NOTAS_NA_PAUTA"));
  assert.ok(review.alertas.includes("CONFERIR_EXCEL_ORIGINAL"));
  assert.equal(review.evidencia_original_confirmada, false);
  assert.equal(review.contagem_matriz, null);
});

test("tenant-authenticated review uses historical rows and keeps the canonical RAA ratification flow", () => {
  const route = readFileSync(new URL("../../src/app/api/secretaria/operacoes-academicas/reconciliacao-historica/route.ts",import.meta.url),"utf8");
  const page = readFileSync(new URL("../../src/app/secretaria/(portal-secretaria)/operacoes-academicas/reconciliacao-historica/page.tsx",import.meta.url),"utf8");
  assert.match(route,/await schoolSession\(requestedEscola\)/);
  assert.match(route,/resolveEscolaIdForUser\(supabase, user.id, requestedEscola\)/);
  assert.match(route,/from\("historico_disciplinas"\)/);
  assert.match(route,/historico_ano_id/);
  assert.match(route,/from\("turma_disciplinas"\)/);
  assert.match(route,/buildPautaHistoricaReview/);
  assert.match(route,/body\.acao === "ratificar" \|\| body\.acao === "fechar_historico"/);
  assert.match(route,/PAUTA_CONFLITO_DOCUMENTAL/);
  assert.match(route,/pauta\.processo_verificado === false \|\| pauta\.divergencia_ano_documento/);
  assert.match(route,/\.rpc\("ratificar_resultado_historico_escola"/);
  assert.match(route,/\.rpc\("historico_set_snapshot_state"/);
  assert.doesNotMatch(route,/INSERT INTO public\.notas/i);
  assert.match(page,/Disciplinas da pauta de origem/);
  assert.match(page,/evidencia_original_confirmada|Os metadados não substituem a verificação/);
});

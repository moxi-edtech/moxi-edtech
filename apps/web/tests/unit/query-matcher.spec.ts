import assert from "node:assert/strict";
import test from "node:test";

import {
  matchesIntentQuery,
  normalizeAssistantText,
} from "../../src/lib/assistant/data-copilot/query-matcher";

test("normaliza acentos, ordinais e pontuação", () => {
  assert.equal(
    normalizeAssistantText(" 6ª Classe — Atenção! "),
    "6 classe atencao",
  );
});

test("reconhece admissões com gralhas", () => {
  assert.equal(
    matchesIntentQuery({
      query: "Quantas canditaturas pendetes temos?",
      scopeTerms: ["admiss", "candidat"],
      diagnosisTerms: ["pendent", "quant", "estado"],
      options: { maxDistance: 2 },
    }),
    true,
  );
});

test("reconhece notas e lançamentos incompletos com gralhas", () => {
  assert.equal(
    matchesIntentQuery({
      query: "Existem lancamntos de notas incompletos?",
      scopeTerms: ["nota", "pauta", "lancamento", "avaliacao"],
      diagnosisTerms: ["incomplet", "pendent", "falta"],
      options: { maxDistance: 2 },
    }),
    true,
  );
});

test("reconhece frequência baixa com acentos e gralhas", () => {
  assert.equal(
    matchesIntentQuery({
      query: "Quais alunos têm frequênca baixa?",
      scopeTerms: ["frequencia", "presenca", "falta"],
      diagnosisTerms: ["baix", "risco", "aluno"],
      options: { maxDistance: 2 },
    }),
    true,
  );
});

test("usa o contexto apenas para o scope e ainda exige diagnóstico", () => {
  assert.equal(
    matchesIntentQuery({
      query: "Mostre o resumo",
      scopeTerms: ["admiss", "candidat"],
      diagnosisTerms: ["resumo"],
      contextMatches: true,
    }),
    true,
  );

  assert.equal(
    matchesIntentQuery({
      query: "Olá",
      scopeTerms: ["admiss", "candidat"],
      diagnosisTerms: ["resumo"],
      contextMatches: true,
    }),
    false,
  );
});

test("não activa ferramenta sem scope correspondente", () => {
  assert.equal(
    matchesIntentQuery({
      query: "Quantos pagamentos estão pendentes?",
      scopeTerms: ["admiss", "candidat"],
      diagnosisTerms: ["pendent", "quant"],
      options: { maxDistance: 2 },
    }),
    false,
  );
});

test("reconhece resumo financeiro com gralhas", () => {
  assert.equal(
    matchesIntentQuery({
      query: "Qual e a situacão da inadimplencia total?",
      scopeTerms: ["finance", "inadimpl", "divida", "devedor", "cobranca"],
      diagnosisTerms: ["risco", "resumo", "total", "atencao", "situacao"],
      options: { maxDistance: 2 },
    }),
    true,
  );
});

test("reconhece dívida por turma com a gralha observada", () => {
  assert.equal(
    matchesIntentQuery({
      query: "Quantos alunos iandimplentes temos na 6 classe?",
      scopeTerms: ["divida", "devedor", "atraso", "inadimpl"],
      diagnosisTerms: ["turma", "classe"],
      options: { maxDistance: 2 },
    }),
    true,
  );
});

test("reconhece termos de briefing com gralhas", () => {
  assert.equal(
    matchesIntentQuery({
      query: "Qual a prioridde da escola hoje?",
      scopeTerms: ["prioridade", "briefing", "resumo", "atencao", "risco"],
      diagnosisTerms: ["hoje", "dia", "semana", "escola"],
      options: { maxDistance: 2 },
    }),
    true,
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Receipt from "../../src/components/financeiro/ReciboPagamentoCompacto";

const sample = {
  escolaNome: "Escola de teste",
  alunoNome: "Aluno fictício",
  alunoBi: "—",
  classeNome: "7.ª",
  cursoNome: "",
  turmaNome: "A",
  referencia: "Teste",
  metodo: "TPA",
  valorPago: 100,
  dataPagamento: "2026-10-12",
  numero: null,
  publicId: "synthetic-only",
  urlValidacao: null,
  logoUrl: null,
};

test("operational receipts are visibly marked non-fiscal", () => {
  const html = renderToStaticMarkup(React.createElement(Receipt, { ...sample, operationalOnly: true }));
  assert.match(html, /Comprovativo operacional — não fiscal/);
});

test("unmarked receipts never claim to be operational-only", () => {
  const html = renderToStaticMarkup(React.createElement(Receipt, sample));
  assert.doesNotMatch(html, /Comprovativo operacional — não fiscal/);
});

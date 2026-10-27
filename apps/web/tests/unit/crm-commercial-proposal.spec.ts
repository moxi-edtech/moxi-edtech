import assert from "node:assert/strict";
import test from "node:test";
import { formatKz, proposalPrintErrors, readProposalParams } from "../../src/lib/crm/commercial-proposal";

const base = "escola=Col%C3%A9gio+Teste&contacto=Diretora&plano=profissional&alunos=800&taxa=50000&mensalidade=140000&trial=15&niveis=primario%2Ctecnico";

test("proposta profissional válida com condições negociadas e níveis conhecidos", () => {
  const d = readProposalParams(new URLSearchParams(base));
  assert.deepEqual(proposalPrintErrors(d), []);
  assert.equal(d.mensalidade! + d.taxa!, 190000);
  assert.deepEqual(d.niveis, ["Ensino Primário", "Ensino Técnico"]);
  assert.equal(formatKz(d.mensalidade), "Kz 140.000");
});
test("não inventa preço ou isenção quando parâmetros estão ausentes", () => {
  const d = readProposalParams(new URLSearchParams("escola=Col%C3%A9gio+Teste&plano=profissional&alunos=300&trial=0"));
  assert.equal(d.taxa, null);
  assert.equal(d.mensalidade, null);
  assert.ok(proposalPrintErrors(d).some((e) => e.includes("mensalidade")));
  assert.equal(formatKz(d.taxa), "A definir");
});
test("bloqueia plano abaixo da capacidade e período experimental fora do limite", () => {
  const d = readProposalParams(new URLSearchParams(base.replace("alunos=800", "alunos=1600").replace("trial=15","trial=31")));
  assert.ok(proposalPrintErrors(d).some((e) => e.includes("1.500 alunos")));
  assert.ok(proposalPrintErrors(d).some((e) => e.includes("0 e 30")));
});
test("aceita taxa zero explícita e plano premium negociado", () => {
  const d = readProposalParams(new URLSearchParams(base.replace("plano=profissional","plano=premium").replace("alunos=800","alunos=3000").replace("taxa=50000","taxa=0").replace("trial=15","trial=0")));
  assert.deepEqual(proposalPrintErrors(d), []);
  assert.equal(d.taxa, 0);
});
test("rejeita NaN, negativos, decimais, expoentes e excesso de precisão", () => {
  for (const invalid of ["-1", "1.2", "1e4", "Infinity", "9007199254740992", ""]) {
    const d = readProposalParams(new URLSearchParams(base.replace("mensalidade=140000", `mensalidade=${invalid}`)));
    assert.ok(proposalPrintErrors(d).length > 0, invalid);
  }
});

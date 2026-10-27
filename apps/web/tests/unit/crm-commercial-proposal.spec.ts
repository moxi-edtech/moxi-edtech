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

test("preserva níveis, preset e os três contactos introduzidos no CRM", () => {
  const params = new URLSearchParams(base);
  params.set("niveis", "pre_escolar,primario,ciclo1,puniv,tecnico,primario");
  params.set("preset", "esg_puniv_cfb");
  params.set("secretaria_nome", "Ana");
  params.set("secretaria_email", "ana@colegio.ao");
  params.set("secretaria_telefone", "+244 900 000 001");
  params.set("financeiro_nome", "Bento");
  params.set("financeiro_email", "bento@colegio.ao");
  params.set("financeiro_telefone", "+244 900 000 002");
  params.set("pedagogico_nome", "Carla");
  params.set("pedagogico_email", "carla@colegio.ao");
  params.set("pedagogico_telefone", "+244 900 000 003");
  const data = readProposalParams(params);
  assert.deepEqual(data.niveis, [
    "Educação Pré-Escolar", "Ensino Primário", "I Ciclo do Ensino Secundário",
    "Ensino Secundário Geral / PUNIV", "Ensino Técnico",
  ]);
  assert.equal(data.preset, "PUNIV — Ciências Físicas e Biológicas");
  assert.deepEqual(data.contactos, {
    secretaria: { nome: "Ana", email: "ana@colegio.ao", telefone: "+244 900 000 001" },
    financeiro: { nome: "Bento", email: "bento@colegio.ao", telefone: "+244 900 000 002" },
    pedagogico: { nome: "Carla", email: "carla@colegio.ao", telefone: "+244 900 000 003" },
  });
  assert.deepEqual(proposalPrintErrors(data), []);
});

test("contactos são opcionais, sem inventar informação de onboarding", () => {
  const data = readProposalParams(new URLSearchParams(base));
  assert.deepEqual(data.contactos.secretaria, { nome: "", email: "", telefone: "" });
  assert.deepEqual(data.contactos.financeiro, { nome: "", email: "", telefone: "" });
  assert.deepEqual(data.contactos.pedagogico, { nome: "", email: "", telefone: "" });
  assert.equal(data.preset, null);
  assert.deepEqual(proposalPrintErrors(data), []);
});

test("não descarta silenciosamente códigos de nível ou curricular desconhecidos", () => {
  const params = new URLSearchParams(base);
  params.set("niveis", "primario,codigo_desconhecido");
  params.set("preset", "preset_desconhecido");
  const data = readProposalParams(params);
  assert.deepEqual(data.niveis, ["Ensino Primário"]);
  assert.deepEqual(data.niveisDesconhecidos, ["codigo_desconhecido"]);
  assert.equal(data.presetDesconhecido, true);
  assert.equal(proposalPrintErrors(data).length, 2);
});

test("campos novos podem ser transportados exclusivamente no fragmento da prévia", () => {
  const params = new URLSearchParams(base);
  params.set("secretaria_email", "secretaria@colegio.ao");
  const url = "/crm/proposta/preview#" + params.toString();
  assert.equal(new URL(url, "https://app.klasse.ao").search, "");
  assert.equal(new URL(url, "https://app.klasse.ao").hash.includes("secretaria_email"), true);
  assert.equal(readProposalParams(new URLSearchParams(url.split("#")[1])).contactos.secretaria.email, "secretaria@colegio.ao");
});

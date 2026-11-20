import { mkdir, writeFile } from "node:fs/promises";
import { renderNominalA4, type NominalA4Row } from "../../src/lib/documentos/nominalA4";

/** Identidades inteiramente simuladas; não consultar nenhuma escola real. */
async function main() {
const testNames = [
  "Pessoa Simulada com Nome Muito Extenso e Diversos Apelidos Completos de Exemplo Número Um",
  "Pessoa Simulada da Conceição, João Ângelo e Grácia — Teste de Acentuação",
  "Pessoa Simulada PalavraExtraordinariamenteLongíssimaSemEspaçosEComAcentuaçãoEspecial",
  "Pessoa Simulada de Nome Repetido",
];
const sample: NominalA4Row[] = Array.from({ length: 55 }, (_, i) => ({
  numero: String(i + 1),
  processo: "P-" + String(i + 1).padStart(4, "0"),
  nome: testNames[i % testNames.length],
  turma: i % 2 ? "7.ª B" : "7.ª A",
  estado: i % 6 === 0 ? "Transferida" : "Concluída",
}));

const sample61ComLacunas: NominalA4Row[] = Array.from({ length: 61 }, (_, i) => ({
  numero: String(i < 30 ? i + 1 : i + 14), // 61 matriculados, último número de chamada: 74
  processo: "P-" + String(i + 1).padStart(4, "0"),
  nome: "Estudante Sintético " + String(i + 1),
  turma: "EP-6ª Classe-M-A",
  estado: "Activa",
}));

const output = process.env.ROSTER_PDF_OUTPUT ?? "roster-artifacts";
await mkdir(output, { recursive: true });

for (const [filename, rows, sensitive] of [
  ["lista_sintetica_55.pdf", sample, false],
  ["lista_sintetica_55_sensivel.pdf", sample.map(x => ({
    ...x, nascimento: "01/01/2010", naturalidade: "Localidade Simulada",
    bi: "BI-TESTE-" + x.processo,
  })), true],
  ["lista_sintetica_vazia.pdf", [], false],
  ["lista_sintetica_61_lacunas.pdf", sample61ComLacunas, false],
] as const) {
  const bytes = await renderNominalA4({
    escola: "INSTITUTO FICTÍCIO DE TESTES",
    turma: "7.ª Classe - Turmas A e B",
    anoLetivo: "2025/2026",
    modo: "Lista do ano letivo (histórica)",
    alunos: rows,
    excluidos: "0 (nenhuma)",
    emissor: "conta-de-teste",
    emitidoEm: new Date("2026-01-15T09:30:00Z"),
    camposSensiveis: sensitive,
  });
  await writeFile(output + "/" + filename, bytes);
  console.log(filename, bytes.length, "bytes gerados");
}

}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Falha ao criar fixture");
  process.exitCode = 1;
});

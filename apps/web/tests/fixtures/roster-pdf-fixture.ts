import { mkdir, writeFile } from "node:fs/promises";
import { renderNominalA4, type NominalA4Row } from "../../src/lib/documentos/nominalA4";
import { renderAlunosPdf } from "../../src/lib/services/alunosExport.server";
import type { AlunoListItem } from "../../src/lib/schemas/aluno.schema";

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

// Logótipos inteiramente sintéticos: quadrado, horizontal e vertical.
const logoQuadrado = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAp0lEQVR42rXW3RVAMAyG4egxB3sxgYWYwGAmiTuKavPzJXe9ed6TXJU4bIZpZeaOmcd5o7BJFDnHvvT5A4K+7gHe4HvtFKHnx0ihOizwp2MCFR0QqOveQFN3BSS6PSDUjQG5bgmodHVAq+sCBl0RsOnSgFkXBTx6O+DUGwG/XgtA9N8ASi8HgHohgNXfAbj+CETohRNhdSLqmz8n7wahP997A/hlrjkBMWmzA/qYxywAAAAASUVORK5CYII=",
  "base64"
));
const logoHorizontal = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAGAAAAAYCAIAAACKi2/DAAAAoklEQVR42u3YzQ2AIAwGUDGdQ/fSCVxIJ3AwJ8EDF2NEQaH277sQ0ttLmzR13vvGEkk/LhAes4ilNYKbbOsEx4+28TlZXFZBrUhiT4DmNkkJGIoKoLIoQoDqoTAGwkFhBoSPwgDoXxSKQO+WFOFAdNqEEBALFGwgdigYQKxRagGJQSkJJBLlK5B4lGwgsksKKlDWZVrPGdtu0g9x3TDrnJ3E7LYBRYQGj49aAAAAAElFTkSuQmCC",
  "base64"
));
const logoVertical = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABgAAABQCAIAAACMHiKuAAAArElEQVR42u3YzQ2AIAwF4GrYw8GcwImcwMGcBA8khoARaHvoDz3phfi9Vy4uMUagzbafABDeJ+KswDH3dYT8Be1i+yIxB+UtWaIV22esNYaDUkD5ZbBBq102aJ+uudntgLTTflyz/nZAemlNl/f6ewLSSOt0qaP1u5xu9lBAimijLnf1IwJSQcO5HNWPDkg4jeKS3xra5WWzKQHJpLH8zRRJC8WllfFFxA1K8wBENETHuwa+sgAAAABJRU5ErkJggg==",
  "base64"
));
const escolaFicticia = "INSTITUTO FICTÍCIO DE TESTES";
const escolaLonga = "IDENTIDADE ESCOLAR FICTICIA — CENTRO DE ENSINO COMUNITARIO E DESENVOLVIMENTO SOCIAL E PEDAGOGICO DE TESTES";

const output = process.env.ROSTER_PDF_OUTPUT ?? "roster-artifacts";
await mkdir(output, { recursive: true });

for (const [filename, rows, sensitive, logoBytes, escolaNome] of [
  ["lista_sintetica_55.pdf", sample, false, undefined, undefined],
  ["lista_sintetica_55_sensivel.pdf", sample.map(x => ({
    ...x, nascimento: "01/01/2010", naturalidade: "Localidade Simulada",
    bi: "BI-TESTE-" + x.processo,
  })), true, undefined, undefined],
  ["lista_sintetica_vazia.pdf", [], false, undefined, undefined],
  ["lista_sintetica_61_lacunas.pdf", sample61ComLacunas, false, undefined, undefined],
  ["lista_sintetica_logo_quadrado.pdf", sample.slice(0, 5), false, logoQuadrado, "IDENTIDADE ESCOLAR FICTICIA"],
  ["lista_sintetica_logo_horizontal.pdf", sample.slice(0, 5), false, logoHorizontal, escolaLonga],
  ["lista_sintetica_logo_vertical.pdf", sample.slice(0, 5), false, logoVertical, "IDENTIDADE ESCOLAR FICTICIA"],
] as const) {
  const bytes = await renderNominalA4({
    escola: escolaNome ?? escolaFicticia,
    turma: "7.ª Classe - Turmas A e B",
    anoLetivo: "2025/2026",
    modo: "Lista do ano letivo (histórica)",
    alunos: rows,
    excluidos: "0 (nenhuma)",
    emissor: "conta-de-teste",
    emitidoEm: new Date("2026-01-15T09:30:00Z"),
    camposSensiveis: sensitive,
    logoBytes,
  });
  await writeFile(output + "/" + filename, bytes);
  console.log(filename, bytes.length, "bytes gerados");
}


const alunosGerais: AlunoListItem[] = sample.map((row, index) => ({
  id: "aluno-sintetico-" + String(index + 1),
  aluno_id: "aluno-sintetico-" + String(index + 1),
  nome: row.nome,
  numero_processo_login: row.processo,
  responsavel: "Encarregado de Educação Sintético com Nome Extenso",
  telefone_responsavel: "+244 900 000 000",
  status_matricula: "matriculado",
  turma_nome: row.turma,
  classe_nome: "7ª Classe",
  turno: index % 2 ? "M" : "Manhã",
  bolsa_integral: index % 2 === 0,
}));
const contextoGeral = {
  escola: escolaLonga,
  anoLetivo: "2025/2026",
  emissor: "conta-de-teste",
  filtros: [
    "Ano letivo: 2025/2026",
    "Bolsa: Todos  |  Classe: Todas  |  Turma: Todas  |  Turno: Todos",
  ],
  logoBytes: logoHorizontal,
};
for (const [filename, rows] of [
  ["lista_alunos_geral_sintetica_55.pdf", alunosGerais],
  ["lista_alunos_geral_sintetica_vazia.pdf", []],
] as const) {
  const bytes = await renderAlunosPdf(rows, contextoGeral);
  await writeFile(output + "/" + filename, bytes);
  console.log(filename, bytes.length, "bytes gerados");
}

}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Falha ao criar fixture");
  process.exitCode = 1;
});

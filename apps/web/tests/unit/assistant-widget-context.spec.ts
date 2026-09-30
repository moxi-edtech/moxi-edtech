import test from "node:test";
import assert from "node:assert/strict";

import { deriveWidgetContext } from "../../src/lib/assistant/derive-widget-context";

const ESCOLA = "f406f5a7-a077-431c-b118-297224925726";
const path = (suffix: string) => `/escola/${ESCOLA}${suffix}`;

test("a Oferta Formativa é reconhecida como académico nas duas portas de entrada", () => {
  // A página vive em admin/ e é re-exportada por operacoes/. Antes de existir
  // este ramo, ambas caíam em `dashboard` — o assistente pensava estar no
  // dashboard enquanto o utilizador olhava para os cursos e níveis de ensino.
  for (const entrada of [
    path("/admin/configuracoes/estrutura"),
    path("/operacoes/configuracoes/estrutura"),
  ]) {
    assert.deepEqual(
      deriveWidgetContext(entrada),
      { module: "academico", page: "estrutura", entityType: "none" },
      `${entrada} deve ser académico/estrutura`,
    );
  }
});

test("o ramo de estrutura vence os ramos mais largos de /admin e /operacoes", () => {
  // Regressão directa: os dois caminhos contêm "/admin" e "/operacoes"
  // respetivamente, pelo que a ordem das regras é o que decide.
  assert.equal(deriveWidgetContext(path("/operacoes/configuracoes/estrutura")).module, "academico");
  assert.equal(deriveWidgetContext(path("/admin/configuracoes/estrutura")).module, "academico");
});

test("ramo da Central WhatsApp", () => {
  assert.deepEqual(deriveWidgetContext(path("/admin/comunicacao/whatsapp")), {
    module: "whatsapp",
    page: "central_whatsapp",
    entityType: "none",
  });
});

test("ramo de comunicação (avisos)", () => {
  assert.deepEqual(deriveWidgetContext(path("/admin/avisos")), {
    module: "comunicacao",
    page: "comunicados",
    entityType: "notice",
  });
});

test("ramo financeiro, incluindo a distinção do radar", () => {
  assert.deepEqual(deriveWidgetContext(path("/financeiro/radar")), {
    module: "financeiro",
    page: "radar",
    entityType: "invoice",
  });
  assert.deepEqual(deriveWidgetContext(path("/financeiro/pagamentos")), {
    module: "financeiro",
    page: "financeiro",
    entityType: "none",
  });
});

test("ramo de secretaria, incluindo a distinção de alunos", () => {
  assert.deepEqual(deriveWidgetContext(path("/secretaria/alunos")), {
    module: "secretaria",
    page: "alunos",
    entityType: "student",
  });
  assert.deepEqual(deriveWidgetContext(path("/secretaria/turmas")), {
    module: "secretaria",
    page: "secretaria",
    entityType: "none",
  });
});

test("ramo de operações", () => {
  assert.deepEqual(deriveWidgetContext(path("/operacoes/configuracoes")), {
    module: "operacoes",
    page: "operacoes",
    entityType: "none",
  });
});

test("comportamento actual documentado: o ramo de operações é estreito", () => {
  // Os ramos /financeiro, /secretaria e /comunicacao vêm ANTES do ramo
  // /operacoes na cascata, pelo que qualquer caminho do superportal que
  // contenha um desses segmentos é classificado pelo segmento interior e
  // nunca chega a "operacoes". Ou seja: `/operacoes/financeiro` é
  // `financeiro`, não `operacoes`; `/operacoes/configuracoes/comunicacao`
  // seria `comunicacao`.
  //
  // Isto não é uma afirmação de que está certo — é o comportamento herdado,
  // fixado aqui para que uma alteração futura apareça como decisão consciente.
  assert.deepEqual(deriveWidgetContext(path("/operacoes/financeiro")), {
    module: "financeiro",
    page: "financeiro",
    entityType: "none",
  });
});

test("ramo da Central de Ações IA", () => {
  assert.deepEqual(deriveWidgetContext(path("/admin/ai/actions")), {
    module: "classe_ai",
    page: "actions",
  });
});

test("o resto de /admin e as rotas desconhecidas caem em dashboard", () => {
  assert.deepEqual(deriveWidgetContext(path("/admin")), { module: "dashboard", page: "admin" });
  assert.deepEqual(deriveWidgetContext("/"), { module: "dashboard" });
});

test("comportamento actual documentado: /admin/notas cai em dashboard", () => {
  // Não é uma afirmação de que está certo — é o estado de hoje, fixado aqui
  // para que uma alteração futura que o mude apareça como uma decisão
  // consciente e não como um efeito colateral silencioso. Não há ramo nenhum
  // que produza `academico` a partir do shell além do de estrutura.
  assert.deepEqual(deriveWidgetContext(path("/admin/notas")), {
    module: "dashboard",
    page: "admin",
  });
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { roleMatchesAllowedRoles } from "../../src/lib/permissions";
import { K12_OPERACOES_ROLE_GROUP } from "../../src/lib/roles";
import { sidebarConfig } from "../../src/lib/sidebarNav";
import { toContextualPortalPath } from "../../src/lib/navigation";

test("matriz de acesso de Operações preserva o grupo autorizado", () => {
  for (const role of [
    "admin",
    "admin_escola",
    "staff_admin",
    "admin_financeiro",
  ]) {
    assert.equal(
      roleMatchesAllowedRoles(role, K12_OPERACOES_ROLE_GROUP, "k12"),
      true,
      `${role} deve manter acesso a Operações`
    );
  }

  for (const role of [
    "financeiro",
    "professor",
    "aluno",
    "formacao_admin",
    "formacao_secretaria",
    "formacao_financeiro",
  ]) {
    assert.equal(
      roleMatchesAllowedRoles(role, K12_OPERACOES_ROLE_GROUP, "k12"),
      false,
      `${role} não deve ganhar acesso ao superportal`
    );
  }
});

test("sidebar de Operações simplifica o Financeiro sem expor rotas legadas", () => {
  const finance = sidebarConfig.operacoes?.find(
    (item) => item.href === "/escola/[escolaId]/operacoes/financeiro"
  );
  assert.ok(finance, "grupo Financeiro deve existir em Operações");

  assert.deepEqual(finance.children, [
    { href: "/escola/[escolaId]/operacoes/financeiro", label: "Visão geral" },
    { href: "/escola/[escolaId]/operacoes/financeiro/recebimentos", label: "Recebimentos" },
    { href: "/escola/[escolaId]/operacoes/financeiro/controle-caixa", label: "Controlo de caixa" },
    { href: "/escola/[escolaId]/operacoes/financeiro/cobrancas", label: "Cobranças" },
    { href: "/escola/[escolaId]/operacoes/financeiro/tabelas-mensalidade", label: "Mensalidades e preços" },
    { href: "/escola/[escolaId]/operacoes/financeiro/fiscal", label: "Fiscal" },
    { href: "/escola/[escolaId]/operacoes/financeiro/relatorios", label: "Relatórios" },
  ]);
  assert.equal(
    finance.children?.some((child) => /boleto/i.test(child.label)),
    false,
    "a navegação angolana não deve usar o termo boleto"
  );

  const admissions = sidebarConfig.operacoes?.find(
    (item) => item.href === "/escola/[escolaId]/operacoes/matriculas"
  );
  assert.equal(
    admissions?.children?.some(
      (child) =>
        child.href === "/escola/[escolaId]/operacoes/financeiro/candidaturas" &&
        child.label === "Candidaturas com pagamento"
    ),
    true,
    "candidaturas com validação financeira devem permanecer em Matrículas & Admissões"
  );
});

test("links financeiros permanecem no namespace Operações", () => {
  const pathname = "/escola/demo/operacoes/financeiro/pagamentos";

  assert.equal(
    toContextualPortalPath("/financeiro/conciliacao", pathname),
    "/operacoes/financeiro/conciliacao"
  );
  assert.equal(
    toContextualPortalPath(
      "/financeiro/relatorios/detalhados?periodo=mensal",
      pathname
    ),
    "/operacoes/financeiro/relatorios/detalhados?periodo=mensal"
  );
});

test("rewrites preservam a home e todos os subpaths financeiros", () => {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(resolve(testDir, "../../next.config.ts"), "utf8");

  assert.match(
    source,
    /source: "\/escola\/:id\/operacoes\/financeiro"[\s\S]*destination: "\/escola\/:id\/financeiro"/
  );
  assert.match(
    source,
    /source: "\/escola\/:id\/operacoes\/financeiro\/:path\*"[\s\S]*destination: "\/escola\/:id\/financeiro\/:path\*"/
  );
});

test("middleware classifica Operações como contexto K12", () => {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(resolve(testDir, "../../src/middleware.ts"), "utf8");
  const functionStart = source.indexOf("function pathRequiresK12Model");
  const functionEnd = source.indexOf("function pathRequiresFormacaoModel", functionStart);
  const functionSource = source.slice(functionStart, functionEnd);

  assert.notEqual(functionStart, -1);
  assert.match(functionSource, /pathname\.startsWith\('\/operacoes'\)/);
});

test("legado Admin redireciona para Operações, Secretaria preserva o portal próprio", () => {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(resolve(testDir, "../../next.config.ts"), "utf8");

  assert.match(
    source,
    /source: "\/escola\/:id\/admin\/dashboard"[\s\S]*destination: "\/escola\/:id\/operacoes\/dashboard"/
  );
  assert.doesNotMatch(source, /source: "\/escola\/:id\/secretaria"[\s\S]*destination: "\/escola\/:id\/operacoes/);
  assert.doesNotMatch(source, /permanent: true/);
});

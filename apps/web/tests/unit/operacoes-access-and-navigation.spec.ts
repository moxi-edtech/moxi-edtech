import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { roleMatchesAllowedRoles } from "../../src/lib/permissions";
import { K12_OPERACOES_ROLE_GROUP } from "../../src/lib/roles";
import { isOperationsPortalPath, sidebarConfig } from "../../src/lib/sidebarNav";
import { toContextualPortalPath } from "../../src/lib/navigation";

test("matriz de acesso de Operações preserva o grupo autorizado", () => {
  for (const role of [
    "admin",
    "admin_escola",
    "staff_admin",
    "admin_financeiro",
    "financeiro",
    "secretaria",
    "secretaria_financeiro",
    "admin_secretaria",
  ]) {
    assert.equal(
      roleMatchesAllowedRoles(role, K12_OPERACOES_ROLE_GROUP, "k12"),
      true,
      `${role} deve manter acesso a Operações conforme a matriz de permissões actual`
    );
  }

  for (const role of [
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
    { href: "/escola/[escolaId]/operacoes/radar", label: "Radar de inadimplência" },
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

test("Reconciliação Histórica aparece dentro de Operações Académicas nos três sidebars", () => {
  const routes = {
    operacoes: "/escola/[escolaId]/operacoes/academico/reconciliacao-historica",
    admin: "/escola/[escolaId]/admin/operacoes-academicas/reconciliacao-historica",
    secretaria: "/escola/[escolaId]/secretaria/operacoes-academicas/reconciliacao-historica",
  } as const;
  for (const [role, expectedHref] of Object.entries(routes)) {
    const item = sidebarConfig[role as keyof typeof routes]?.find(
      (entry) => entry.label === "Operações Académicas" || entry.label === "Operações Acadêmicas"
    );
    assert.ok(item, `grupo académico não encontrado no sidebar ${role}`);
    const child = item.children?.find((entry) => entry.label === "Reconciliação Histórica");
    assert.ok(child, `subitem ausente no sidebar ${role}`);
    assert.equal(child.href, expectedHref);
    assert.equal(item.children?.filter((entry) => entry.href === expectedHref).length, 1);
  }
  for (const role of ["admin", "admin_financeiro"]) {
    assert.equal(roleMatchesAllowedRoles(role, K12_OPERACOES_ROLE_GROUP, "k12"), true);
  }
});

test("rotas da Secretaria não assumem indevidamente o sidebar de Operações", () => {
  assert.equal(isOperationsPortalPath("/escola/demo/operacoes/academico/reconciliacao-historica"), true);
  assert.equal(isOperationsPortalPath("/operacoes/dashboard"), true);
  assert.equal(isOperationsPortalPath("/escola/demo/secretaria/operacoes-academicas"), false);
  assert.equal(isOperationsPortalPath("/escola/demo/secretaria/operacoes-academicas/reconciliacao-historica"), false);
  assert.equal(isOperationsPortalPath("/escola/demo/admin/operacoes-academicas"), false);
  assert.equal(isOperationsPortalPath("/escola/demo/operacoes-malformadas"), false);
  const shell = readFileSync(new URL("../../src/components/layout/klasse/AppShell.tsx", import.meta.url), "utf8");
  assert.match(shell, /if \(isOperationsPortalPath\(safePathname\)\) return "operacoes"/);
  assert.doesNotMatch(shell, /safePathname\.includes\("\/operacoes"\)/);
});

test("rotas nos sidebars reutilizam a página canónica e o admin conserva redirect compatível", () => {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const src = (path: string) => readFileSync(resolve(testDir, "../../src/" + path), "utf8");
  const sourceAlias = '@/app/secretaria/(portal-secretaria)/operacoes-academicas/reconciliacao-historica/page';
  for (const route of [
    "app/escola/[id]/(portal)/operacoes/academico/reconciliacao-historica/page.tsx",
    "app/escola/[id]/(portal)/secretaria/(portal-secretaria)/operacoes-academicas/reconciliacao-historica/page.tsx",
  ]) {
    assert.ok(src(route).includes(sourceAlias));
  }
  const config = readFileSync(resolve(testDir, "../../next.config.ts"), "utf8");
  assert.match(config, /source: "\/escola\/:id\/admin\/operacoes-academicas\/:path\*"/);
  assert.match(config, /destination: "\/escola\/:id\/operacoes\/academico\/:path\*"/);
});

# Apply Diff — Simplificação do menu Financeiro

run_id: A93D1984-E41D-4A84-B7FD-F7CEAE03443B  
data: 2026-08-01  
ficheiro alvo: `apps/web/src/lib/sidebarNav.ts`

## Objetivo

Reduzir a navegação financeira do Portal Operações de 22 para 6 entradas orientadas a tarefas, preservar as rotas existentes e adaptar a terminologia ao contexto angolano.

## Verificação P0

Todos os itens de `P0_CHECKLIST.md` estão marcados como concluídos.

## Diff proposto

```diff
@@ Matrículas & Admissões
         { href: "/escola/[escolaId]/operacoes/rematricula", label: "Rematrículas" },
         { href: "/escola/[escolaId]/operacoes/rematricula/janelas", label: "Janelas de rematrícula" },
+        { href: "/escola/[escolaId]/operacoes/financeiro/candidaturas", label: "Candidaturas com pagamento" },

@@ Financeiro
-        { href: "/escola/[escolaId]/operacoes/financeiro", label: "Dashboard financeiro" },
-        { href: "/escola/[escolaId]/operacoes/recebimentos", label: "Balcão & cobrança" },
-        { href: "/escola/[escolaId]/operacoes/financeiro/turmas-alunos", label: "Turmas & alunos" },
-        { href: "/escola/[escolaId]/operacoes/financeiro/pagamentos", label: "Pagamentos" },
-        { href: "/escola/[escolaId]/operacoes/financeiro/boletos", label: "Boletos" },
-        { href: "/escola/[escolaId]/operacoes/financeiro/radar", label: "Cobranças" },
-        { href: "/escola/[escolaId]/operacoes/financeiro/fecho", label: "Fecho de caixa" },
-        { href: "/escola/[escolaId]/operacoes/financeiro/conciliacao", label: "Conciliação" },
-        { href: "/escola/[escolaId]/operacoes/financeiro/candidaturas", label: "Candidaturas" },
-        { href: "/escola/[escolaId]/operacoes/financeiro/configuracoes/precos", label: "Tabelas de preço" },
-        { href: "/escola/[escolaId]/operacoes/financeiro/tabelas-mensalidade", label: "Mensalidades" },
-        { href: "/escola/[escolaId]/operacoes/financeiro/fiscal", label: "Fiscal & compliance" },
-        { href: "/escola/[escolaId]/operacoes/financeiro/contabilidade", label: "Contabilidade" },
-        { href: "/escola/[escolaId]/operacoes/financeiro/vendas", label: "Vendas" },
-        { href: "/escola/[escolaId]/operacoes/financeiro/exportacoes", label: "Exportações" },
-        { href: "/escola/[escolaId]/operacoes/financeiro/alertas", label: "Alertas financeiros" },
-        { href: "/escola/[escolaId]/operacoes/financeiro/relatorios", label: "Relatórios financeiros" },
-        { href: "/escola/[escolaId]/operacoes/financeiro/dashboards", label: "Dashboards analíticos" },
-        { href: "/escola/[escolaId]/operacoes/financeiro/relatorios/extratos-alunos", label: "Extratos de alunos" },
-        { href: "/escola/[escolaId]/operacoes/financeiro/relatorios/fluxo-caixa", label: "Fluxo de caixa" },
-        { href: "/escola/[escolaId]/operacoes/financeiro/relatorios/pagamentos-status", label: "Status de pagamentos" },
-        { href: "/escola/[escolaId]/operacoes/financeiro/relatorios/detalhados", label: "Relatórios detalhados" },
+        { href: "/escola/[escolaId]/operacoes/financeiro", label: "Visão geral" },
+        { href: "/escola/[escolaId]/operacoes/recebimentos", label: "Caixa e pagamentos" },
+        { href: "/escola/[escolaId]/operacoes/financeiro/radar", label: "Cobranças" },
+        { href: "/escola/[escolaId]/operacoes/financeiro/tabelas-mensalidade", label: "Mensalidades e preços" },
+        { href: "/escola/[escolaId]/operacoes/financeiro/fiscal", label: "Fiscal" },
+        { href: "/escola/[escolaId]/operacoes/financeiro/relatorios", label: "Relatórios" },
```

## Risco

Baixo. A alteração afeta somente a descoberta pela sidebar. Nenhuma rota, permissão, API, política RLS, schema ou dado financeiro será removido ou alterado.

## Reversão

Reverter o bloco do perfil `operacoes` em `apps/web/src/lib/sidebarNav.ts` usando este diff.

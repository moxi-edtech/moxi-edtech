# Plano Definitivo — Zero Remount no Portal

## Objetivo
Eliminar remount/reload perceptível ao navegar por cliques internos no portal autenticado, padronizando a navegação em uma única árvore canônica de rotas.

## Escopo
- Portais autenticados: secretaria, financeiro, admin escola, professor, aluno (quando aplicável).
- Navegação interna via `Link` e `router.push/replace`.
- Excluso: logout, troca de tenant explícita, hard refresh manual do navegador.

## Contrato Canônico (Decisão Arquitetural)
1. A URL canônica do portal autenticado é: `/escola/[slug]/...`.
2. Rotas curtas (`/admin/...`, `/secretaria/...`, `/financeiro/...`, etc.) são apenas compatibilidade de entrada.
3. Navegação interna não pode usar aliases.

## Checklist de Execução
- [x] Definir e registrar contrato canônico `/escola/[slug]/...`.
- [x] Criar provider server-first de `escolaSlug`.
- [x] Criar helper `buildPortalHref`.
- [x] **Onda 1 — Secretaria:** Concluída (2026-05-08).
- [x] **Onda 2 — Financeiro:** Concluída (2026-05-08).
- [x] **Onda 3 — Admin Escola:** Concluída (2026-05-09).
- [x] **Onda 4 — Professor/Aluno:** Concluída (2026-05-09).
- [/] Aplicar guardrails de navegação (script local aplicado; CI pendente).
- [ ] Cobrir E2E de navegação crítica.
- [ ] Publicar métricas de navegação no monitoramento.

## Estratégia Definitiva

### Fase 1 — Fonte Única de Slug (Server-First)
1. Resolver `escolaSlug` no layout server do portal.
2. Expor `escolaSlug` por provider/context para componentes client.
3. Proibir montagem de rota principal com fallback para `escolaId`.

### Fase 2 — Helper Canônico Obrigatório
1. Criar helper único: `buildPortalHref(escolaSlug, path)`.
2. Migrar `Link`, `router.push`, `router.replace` para usar o helper.
3. Remover strings hardcoded de rota interna.

### Fase 3 — Migração de Rotas Internas
1. Varrer código por padrões não canônicos: `/secretaria`, `/financeiro`, `/admin`, `/professor`, `/aluno`.
2. Substituir por `/escola/[slug]/...` via helper.
3. Garantir árvore de layout única no fluxo crítico.

## Status de Execução

### Onda 1 — Secretaria (Concluída em 2026-05-08)
**Escopo:** Admissões, Matrículas, Turmas, Alunos.
**Resíduos Eliminados:** `EditarCandidatura`, `ConfirmarRematricula`, `DossierHeader` e `MigrationWizard` migrados para links canônicos.

### Onda 2 — Financeiro (Concluída em 2026-05-08)
**Escopo:** Dashboard, Radar de Cobranças, Conciliação, Pagamentos, Fecho, Relatórios, Fiscal.
**Resíduos Eliminados:** `MissingPricingAlert`, `PagamentoModal`, `ModalPagamentoRapido` e `FiscalRowActions` migrados para `buildPortalHref`. `CommandPalette` e `useGlobalSearch` atualizados.

### Revalidação — Secretaria e Financeiro (Concluída em 2026-05-09)
**Escopo:** Árvore canônica `/escola/[slug]/secretaria/**` e `/escola/[slug]/financeiro/**`, além de componentes partilhados com navegação interna.
**Resultado:** Sem `Link`, `router.push/replace`, `window.location.href` ou `redirect` curto dentro da árvore canônica. Redirects curtos restantes são apenas compatibilidade de entrada fora da árvore canônica.
**Correções aplicadas:** Alertas operacionais da Secretaria canonizados, `JustificarFaltaModal` e fechamento acadêmico migrados para App Router, redirects vazios do Financeiro preservando `/escola/[slug]/financeiro`, `ModuleSwitcher` ajustado para Financeiro canônico.

### Onda 3 — Admin Escola (Concluída em 2026-05-09)
**Escopo:** Configurações Globais, Gestão de Funcionários, Estrutura de Cursos, Dashboard Admin, Operações Académicas.
**Destaques:** Migração massiva do sub-módulo `admin/configuracoes` (Calendário, Avaliação, Turmas, Financeiro, Mensalidades, Sistema), Dashboard, Relatórios, widgets académicos, avisos/eventos e Operações Académicas.
**Resíduos Eliminados:** Montagens manuais `/escola/${...}/admin...` substituídas por `buildPortalHref` nos fluxos críticos de Admin; guardrail local agora cobre Admin, Secretaria e Financeiro.

**Validação técnica:**
- `bash scripts/validate-navigation.sh` ✅
- `pnpm -C apps/web typecheck` ✅
- `pnpm -C apps/web lint` ⚠️ (0 erros, 1031 warnings residuais - projeto necessita de limpeza de tipos e Storybook).

### Onda 4 — Professor/Aluno (Concluída em 2026-05-09)
**Escopo:** Portal do Professor, Portal do Aluno, redirects pós-login, landing por role no middleware, navegação de notificações e componentes legados aplicáveis.
**Destaques:** Criadas árvores canônicas `/escola/[id]/professor/**` e `/escola/[id]/aluno/**` com wrappers para as páginas existentes, mantendo aliases curtos apenas como entrada de compatibilidade. `ProfessorPortalLayout`, dashboard do professor, `AlunoLayoutClient`, header/bottom nav/sidebar do aluno e dropdown de notificações passaram a resolver links por `buildPortalHref`.
**Resíduos Eliminados:** `router.push/replace`, `redirect`, `href` e `window.location` curtos removidos dos fluxos interativos aplicáveis. `action_url` legado de notificações é canonizado no clique quando aponta para Professor/Aluno.
**Guardrail:** `scripts/validate-navigation.sh` agora cobre Admin, Secretaria, Financeiro, Professor e Aluno.

**Validação técnica:**
- `bash scripts/validate-navigation.sh` ✅
- `pnpm -C apps/web typecheck` ✅
- `pnpm -C apps/web lint` ⚠️ (0 erros, 1028 warnings residuais - projeto necessita de limpeza de tipos e Storybook).

## Próximos Passos
1. Ligar `scripts/validate-navigation.sh` ao pipeline de CI.
2. Cobrir E2E dos fluxos críticos Admin/Secretaria/Financeiro/Professor/Aluno para medir remount/reload perceptível.
3. Publicar métrica de reload indevido no monitoramento.

## Definição de Pronto (DoD)
- Sem remount perceptível em cliques internos dos fluxos críticos.
- Nenhum link interno usando alias curto.
- Guardrails ativos em CI.
- E2E verde.
- Métrica de reload indevido estável em patamar próximo de zero.

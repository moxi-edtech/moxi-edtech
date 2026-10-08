# Workspace — relatório de engenharia e evidência (2026-10-07)

**PR:** #175 · **branch:** feat/workspace-responsive-design-20261007 · **sem deploy ou migration**.

## Fase 1 — diagnóstico e decisões
Ver `workspace-product-design-audit-2026-10-07.md`. O Shell exibia altura excessiva; Matrícula deve desassociar o aluno anterior. `AlunoProfilePanel` é editor rápido; o dossier integral canónico permanece `AlunoPerfilPage`, protegido por resolução de escola, RPC e papéis. **Não renderizar indiscriminadamente o dossier do servidor dentro de um client component nem enfraquecer papéis/polo.**

## Implementação
- `CommandCenterShell`: respiro responsivo, largura máxima, altura dinâmica de modal e identificação clara de nova Matrícula.
- `CommandCenterActionBar`: ações responsivas sem criar nova arquitetura de navegação.
- `BalcaoPageClient`: remove altura mínima fixa do conteúdo.
- `CommandCenterPanel`: link contextual para ficha integral canónica, mantendo edição rápida. **Integração integral no mesmo painel ainda pendente; link não é equivalente a incorporação.**
- `action-registry.ts`: deep-link de Matrícula elimina `alunoId` antigo; Pagamentos/Rematrícula preservam contexto.
- `secretaria/page.tsx`: guardas de tipo para dados JSON do dashboard; corrigiu falha de typecheck que já existia antes deste PR.
- Testes: adicionar regressões do contrato de links/contexto no teste do Command Center.

## Evidência recolhida
- `pnpm -C apps/web typecheck`: PASS.
- ESLint focado nos seis ficheiros de código alterados: PASS, zero warnings.
- `pnpm -C apps/web build` com URL e chave **fictícias** em variáveis de ambiente: PASS (compilou e gerou páginas; não testa integrações reais).
- Unit Command Center: 7/7 PASS.
- Rematrícula: 32/32 PASS.
- Estados de pagamento/checkout: 5/5 PASS.
- GitHub Actions: Gracefulness Balcao P0 (Web contracts e Database regressions) e KF2 Search Audit: PASS no commit c22d074ab.
- Shell isolado, `agent-browser`: 12 screenshots, 12/12 sem overflow horizontal. Capturas: [evidência](evidence/workspace-shell-2026-10-07/README.md). Zoom por viewport CSS equivalente, não zoom nativo.
- Navegação fixture: ao selecionar Matrícula, o cabeçalho mudou de "Aluno de Demonstração" para "Nova matrícula" e "NOVO ATENDIMENTO"; ao voltar à Visão geral, o nome fictício reapareceu.

## Limitações / riscos conhecidos
- Lint do repositório completo: **FALHOU** por `react-hooks/purity` em `src/app/crm/proposta/preview/page.tsx:117` (uso preexistente de `Date.now()` em render). 1472 warnings já existentes. Não alterar CRM neste PR de Workspace só para satisfazer uma métrica.
- As capturas só cobrem Shell, sem a sidebar/topbar reais. Os 12 casos de browser zoom nativo em portal autenticado ainda não foram executados.
- Sem fixture multi-tenant com papéis secretaria/financeiro/pedagogo/professor/diretor e escopo por polo. Não foi possível comprovar o Perfil integral no próprio Workspace, permissões de todos os papéis e os fluxos ponta a ponta de pagamentos/matrícula/rematrícula.
- Manter PR em draft. Não efetuar merge enquanto checklist não estiver 8/8 com evidência.

## Checklist estrito de aceite
- [ ] 1. Sem overflow horizontal no **portal completo** (Shell isolado 12/12 comprovado)
- [ ] 2. Sem scroll aninhado desnecessário (fluxos completos pendentes)
- [ ] 3. Navegação completa a zoom **nativo** 100/125/150 (equivalência CSS do Shell comprovada)
- [ ] 4. Aluno identificável em todos os módulos (fixture apenas)
- [ ] 5. Matrícula inicia novo contexto sem ambiguidade (unit + fixture; autenticação real pendente)
- [ ] 6. Perfil integral no Workspace com papéis/polo comprovados (pendente)
- [ ] 7. Ações principais acessíveis nos fluxos compactos (Shell apenas)
- [ ] 8. Sem regressões em matrícula/rematrícula/pagamentos E2E (unitários passam; E2E pendente)

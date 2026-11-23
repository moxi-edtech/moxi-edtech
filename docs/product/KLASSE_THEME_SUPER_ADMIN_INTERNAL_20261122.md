# KLASSE — Tema dos componentes internos do Super Admin (22/11/2026)

## Contexto e dependências

A PR #447 estabelece os tokens semânticos da interface operacional. A #448 aplica os tokens a 23 componentes internos. Esta ronda faz uma **PR empilhada sobre #448**, focada em seis componentes de gestão central que ainda continham estilos neutros claros fixos.

## Ficheiros corrigidos

| Componente | Alteração |
|---|---|
| `ActivitiesSection.tsx` | Cards, timestamps e hover contextuais com tokens |
| `CrmSection.tsx` | KPIs, pipeline, tabelas e badges; tabelas com scroll focável e regiões etiquetadas |
| `EscolaSettingsClient.tsx` | Configuração escolar, select e label acessível, foco institucional |
| `MarketingSection.tsx` | Dashboard, leads, ícones e scores com contraste Claro/Escuro |
| `MorningBriefing.tsx` | Cartão, status, foco de ação e responsividade de superfícies |
| `StudentReclassificationTool.tsx` | Formulários, seleção, alertas e resultados de reclassificação em Claro/Escuro |

## Contratos preservados

- Nenhum pedido, endpoint, parâmetro, cálculo de comissão, regra de reclassificação, RPC, permissão ou RLS foi modificado.
- O botão de reclassificação continua condicionado à seleção do aluno, turma de destino, motivo mínimo e estado de submissão.
- As opções de reprecificação de mensalidades abertas/pagas permanecem independentes e com a mesma decisão padrão.
- Ações e estados críticos (rose/amber/emerald) mantêm cores distintas com variantes dark.
- Ações deliberadamente escuras em superfícies específicas não foram mecanicamente convertidas; impressão e módulo fiscal ficam fora do escopo.

## Verificação

Novo `apps/web/tests/unit/super-admin-internal-theme-coverage.spec.mjs`, importado por `theme-color-coverage.spec.mjs` e executado no workflow **Theme Switcher Guard**. O contrato de regressão verifica seis componentes, zero classes neutras claras fixas no grupo, estados escuros, foco/labels e preservação das ações.

**Gates de publicação:** CI integral deste head, integração da #447, depois #448 e esta PR; reconciliação com #446; QA autenticado final. Aprovação de teste sintético não certifica páginas reais em produção.

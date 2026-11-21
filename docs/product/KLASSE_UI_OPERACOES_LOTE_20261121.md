# KLASSE — UI operacional · Classes e filas da Secretaria

Data: 21/11/2026. Baseline: PRs #398, #407, #409, #412, #413 e #402 já integradas.

## Superfícies abrangidas

| Superfície ativa | Contrato | Melhoria |
| --- | --- | --- |
| Secretaria/Operações → Classes | `buildEscolaUrl(escolaId, "/classes")` | Pesquisa acento-insensível, paginação **local** de 10 itens, esqueleto, vazio/erro diferenciados, botão contextual para disciplinas, cancelamento de fetch e proteção contra troca de escola. O cabeçalho de página permanece no `DashboardHeader` existente. |
| Secretaria → Documentos → Aprovações de documentos gratuitos | GET/POST `/api/secretaria/documentos/aprovacoes` | Pesquisa, paginação dos itens já carregados, feedback, estado de carregamento, confirmação/rejeição em Dialog acessível em vez de `window.confirm/prompt`. Motivo obrigatório para rejeição, até 500 caracteres. |
| Secretaria → Documentos → Justificações de faltas | GET/POST `/api/secretaria/faltas/justificacoes` | Pesquisa, paginação local, estados de erro/vazio, Diálogo preservado e uniformizado, motivo mínimo de 8 caracteres na recusa. |
| Secretaria → Documentos → Workspace | Composição existente | Tokens semânticos e CTA de ação. |

Todos os dados e decisões continuam nos endpoints já existentes. Nenhuma API, RPC, RLS, SQL, permissão, auditoria de decisão ou fonte de verdade alterada.

## Contratos de apresentação

- Pesquisa/paginação atuam apenas sobre os registos efetivamente devolvidos pelo servidor. Não se indica um total global quando o endpoint não o fornece.
- APIs de aprovações e justificações limitam a resposta a **50** e **100** registos, respetivamente. Ao limpar/decidir solicitações, `Atualizar` consulta novamente a fila. Paginadores são apenas de interface, **não substituem paginação no servidor**.
- Pedido antigo não deve sobrescrever a lista de Classes após mudança de escola. Abortar pedidos anteriores nas filas ao atualizar ou desmontar o componente.
- Loading não apresenta cartões de dados inventados nem ações sensíveis, e erros de consulta não aparecem como listas vazias.
- Decisões permanecem explícitas e não são executadas ao abrir o diálogo. Backend valida estado pendente, escola e role e mantém auditoria.

## Problemas detetados, fora do escopo desta PR

1. **Importações**: `/api/migracao/historico` consulta todos os `escolaIds` associados ao utilizador, não necessariamente a escola ativa. A apresentação "nesta escola" pode estar incorreta se o utilizador tiver múltiplos vínculos. Corrigir escopo no servidor antes de padronizar a página, preservando a autorização por escola e a paginação por cursor.
2. **Ocupação das turmas**: `/api/secretaria/turmas/ocupacao` aplica `applyKf2ListInvariants(... defaultLimit: 50)` e devolve `total_turmas: rows.length`, que pode não ser o total real da escola. Corrigir o contrato de paginação/contagem antes de colocar KPIs globais na UI. Evitar `COUNT(*)` indiscriminado e nunca trocar limites por carregamento ilimitado.
3. **Filas de documentos e faltas**: implementar paginação de servidor se as escolas ultrapassarem os respetivos limites. Não apresentar os primeiros 50/100 como "total de pendências".

## Verificação necessária para liberar produção

- CI, typecheck, lint e testes de componentes e contratos.
- Smoke autenticado por função da Secretaria e administração em escola com registos, sem registos, erro de rede e troca entre escolas.
- Confirmar Tab, Shift+Tab, Escape, foco restaurado e bloqueio de clique durante submissão.
- Verificar 320/375/390/768/1280 px, contraste, impressão e zoom 200%.
- Validar documento rejeitado (motivo exigido), aprovado (confirmação), justificação recusada (mínimo 8), aprovada; decisões registadas uma única vez.
- Confirmar deployment READY e commit exato associado a `app.klasse.ao` antes de declarar produção.


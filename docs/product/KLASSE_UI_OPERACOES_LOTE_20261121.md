# KLASSE — UI operacional · Classes e filas da Secretaria

Data: 21/11/2026. Baseline: PRs #398, #407, #409, #412, #413 e #402 já integradas.

## Superfícies abrangidas

| Superfície ativa | Contrato | Melhoria |
| --- | --- | --- |
| Secretaria/Operações → Classes | `buildEscolaUrl(escolaId, "/classes", params)` | Preserva **paginação por cursor no servidor** da PR #418 (`limit=50`, `next_cursor`) e acrescenta proteção contra resultados de escola anterior, tratamento de nomes nulos, loading/erro/vazio e botão contextual. Pesquisa global fica para contrato de servidor, não para filtro incompleto de linhas carregadas. |
| Secretaria → Documentos → Aprovações de documentos gratuitos | GET/POST `/api/secretaria/documentos/aprovacoes` | Pesquisa, paginação dos itens já carregados, feedback, estado de carregamento, confirmação/rejeição em Dialog acessível em vez de `window.confirm/prompt`. Motivo obrigatório para rejeição, até 500 caracteres. |
| Secretaria → Documentos → Justificações de faltas | GET/POST `/api/secretaria/faltas/justificacoes` | Pesquisa, paginação local, estados de erro/vazio, Diálogo preservado e uniformizado, motivo mínimo de 8 caracteres na recusa. |
| Secretaria → Documentos → Workspace | Composição existente | Tokens semânticos e CTA de ação. |

Todos os dados e decisões continuam nos endpoints já existentes. Nenhuma API, RPC, RLS, SQL, permissão, auditoria de decisão ou fonte de verdade alterada.

## Contratos de apresentação

- As filas de Documentos/Faltas usam pesquisa/paginação local apenas sobre pedidos carregados; Classes preserva paginação por cursor no servidor. Nunca apresentar registos carregados como total global.
- APIs de aprovações e justificações limitam a resposta a **50** e **100** registos, respetivamente. Ao limpar/decidir solicitações, `Atualizar` consulta novamente a fila. Paginadores são apenas de interface, **não substituem paginação no servidor**.
- Pedido antigo não deve sobrescrever a lista de Classes após mudança de escola. Abortar pedidos anteriores nas filas ao atualizar ou desmontar o componente.
- Loading não apresenta cartões de dados inventados nem ações sensíveis, e erros de consulta não aparecem como listas vazias.
- Decisões permanecem explícitas e não são executadas ao abrir o diálogo. Backend valida estado pendente, escola e role e mantém auditoria.

## Problemas detetados, fora do escopo desta PR

1. **Importações**: corrigido e integrado pela PR #419; manter os testes de âmbito multi-tenant.
2. **Ocupação das turmas**: corrigido e integrado pela PR #420 com total filtrado exato sobre a vista materializada e grupos explicitamente limitados à página.
3. **Filas de documentos e faltas**: implementar paginação de servidor se as escolas ultrapassarem os respetivos limites. Não apresentar os primeiros 50/100 como "total de pendências".

## Verificação necessária para liberar produção

- CI, typecheck, lint e testes de componentes e contratos.
- Smoke autenticado por função da Secretaria e administração em escola com registos, sem registos, erro de rede e troca entre escolas.
- Confirmar Tab, Shift+Tab, Escape, foco restaurado e bloqueio de clique durante submissão.
- Verificar 320/375/390/768/1280 px, contraste, impressão e zoom 200%.
- Validar documento rejeitado (motivo exigido), aprovado (confirmação), justificação recusada (mínimo 8), aprovada; decisões registadas uma única vez.
- Confirmar deployment READY e commit exato associado a `app.klasse.ao` antes de declarar produção.


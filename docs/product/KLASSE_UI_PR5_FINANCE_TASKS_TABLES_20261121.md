# KLASSE — PR 5 · Moeda, ações reais, limpeza e tabelas

21/11/2026 · Base PR #414 (`871199be`). Lote prioritário com foco em compatibilidade de contratos e isolamento multi-tenant.

## 1. Mensalidades — Kwanza, não reais

- **Contrato conferido**: `GET /api/aluno/financeiro` autentica o aluno, verifica a escola e o `studentId`, filtra as mensalidades por `aluno_id` / `escola_id` / ano e devolve `valor = max(valor_previsto - valor_pago_total, 0)`. A resposta não inclui `currency`; o portal financeiro ativo já interpreta os montantes como **AOA**.
- `MensalidadesTable` deixou de aplicar `R$` e `.toFixed(2)`, adotou `formatKwanza` e `formatDate` do formatter canónico `pt-AO`/`Africa/Luanda` e mudou o rótulo de `Valor` para **Por pagar (Kz)**.
- Diferencia loading, lista vazia e erro recuperável. Um timeout/403 não pode ser apresentado como “sem mensalidades”. Nenhuma consulta, valor, permissão ou RPC foi alterado.

## 2. TaskList — ações sem handlers

- A implementação em `components/dashboard/TaskList.tsx` está **exportada, mas não montada em nenhuma rota ativa**; o Dashboard da Secretaria usa outros componentes do Balcão. Os botões Aprovar/Rejeitar eram inertes.
- Agora só são renderizados quando o consumidor fornece, explicitamente, `onApprove` / `onReject` assíncronos. Há `disabled` durante envio, estado acessível e erro recuperável quando o handler rejeita. Sem handlers, **não há botões**; não existe operação de backend inventada nem feedback de sucesso falso.
- Os handlers, quando futuramente utilizados, devem chamar ações server-side que validem role, escola, elegibilidade e auditoria. Esta PR **não cria nem ativa** aprovação/rejeição em produção por meio do `TaskList` órfão.
- Também foram removidos “Mais” (sem handler) na listagem de Matrículas e “Notificar Encarregados” (toast sem envio) na listagem de Turmas. A funcionalidade de notificações fica pendente de integração real; não foi declarada como enviada.

## 3. Remoção de componentes legados

- `components/dashboard/ActionCard.tsx`, `SecondaryAction.tsx` e `TaskListSkeleton.tsx` não tinham consumidores em `src` exceto `dashboard/index.ts`. Os três ficheiros e respetivas reexportações foram removidos, preservando os restantes componentes ativos. Atualizada a documentação do Theme Switcher.

## 4. Consistência de filtros, contagens e paginação

- **Turmas (Admin e Secretaria)**: API já tinha RLS/RBAC e filtros por escola/ano, mas ignorava o parâmetro `busca`. Agora usa `parseTurmaSearch` (até 80 caracteres, sem operadores PostgREST), aplica `ilike` por nome/código/curso/classe/sala na view e por nome/código/sala no fallback; mantém a condição de escola e sessão. O filtro `ativos` agora envia `ativo` ao servidor.
- `TurmasListClient` interrompe respostas antigas ao mudar filtros/escola/ano, mostra erros com retry, preserva estado seguro ao carregar por cursor, evita duplicações de IDs e corrige selecionar-todas sem apagar seleções invisíveis por engano. **Contagem explicitamente parcial**: carregadas versus apresentadas. Filtros adicionais (vagas, professores, currículo, financeiro, espera e rascunhos curriculares) ainda operam sobre a parte carregada quando há `next_cursor`; a limitação é comunicada sem inventar total.
- **Classes**: a API devolve no máximo 50 por cursor. UI anterior mostrava só a primeira página como “todas as classes”. Agora oferece Carregar mais, abort em mudanças de escola, erro/retry, estado vazio e contagem apenas de classes carregadas.
- **Importações**: cursor de 30, fetch abortável, retry, prevenção de duplicados e cursor sem progresso; mostra número **carregado**, não global, e sinaliza contagens de linhas negativas/inconsistentes. Datas são apresentadas no horário de Angola.
- **Pagamentos**: API limita a 50 registos. O cartão de “Valor recebido” somava apenas esses resultados e parecia representar o período inteiro. Agora indica claramente **somatório parcial de até 50**, rejeita respostas antigas após troca de filtro/tenant, sem forçar uma agregação adicional em produção.
- **Matrículas**: endpoint já tem contagem `exact` filtrada no servidor; paginador próprio duplicado foi substituído por `OperationalTablePagination` com total global verdadeiro.

## Segurança / performance / limites de homologação

- Sem alterações de schema, migrações ou políticas RLS; nenhuma ação financeira ou académica adicional. Autorização e isolamento dos endpoints existentes preservados.
- Pesquisa de Turmas fica dentro de escola/ano e limitada a 100 itens por cursor; os padrões `ILIKE` podem exigir medição de latência por escola de maior dimensão.
- Verificação de esquema `public.vw_turmas_para_matricula` no Supabase confirmou os 8 campos do filtro/contexto e um `EXPLAIN` só de planeamento aceitou a expressão com as colunas utilizadas. Nenhum registo pessoal foi lido ou alterado nessa validação.
- QA autenticado real, zoom, teclado e dispositivos móveis ainda é necessário antes de certificação visual. CI verde não é validação completa dos fluxos em produção.
- Backlog separado: ligar notificações reais de encarregados; mapear/reconciliar `TaskList` apenas se houver consumidor que o exija; mover filtros locais complexos de Turmas para APIs indexadas antes de apresentar contagens escolares globais; criar uma agregação financeira autorizada (sem somar só 50 pagamentos); auditar outros botões sem handler existentes.

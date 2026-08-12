# Estado e backlog — Rematrícula, Balcão e mensalidades

**Data:** 2026-08-11
**Escola de validação:** Complexo Escolar Privado Adventista de Curtume  
**Ano em foco:** 2026/2027 (`ano_letivo = 2026`, 01/09/2026–31/08/2027)

## Resumo executivo

O fluxo de rematrícula e Balcão já possui contexto explícito de ano letivo, cobrança de dívidas no ano seleccionado e serviço próprio de rematrícula. A geração de mensalidades foi endurecida para respeitar matrícula activa, turma, calendário escolar, data de entrada financeira e regras de classes de exame.

O principal risco funcional identificado — mensalidades de 2025 aparecerem quando o Balcão estava em 2026/2027 — foi corrigido no consumo contextual do Balcão. O histórico não foi apagado: dívidas de anos anteriores continuam disponíveis quando o ano anterior é seleccionado.

Uma auditoria global no Curtume encontrou 334 alunos que poderiam ser afectados pela condição antiga do RPC. Foram preservadas 2.638 mensalidades legítimas associadas a 230 alunos matriculados em 2026/2027.

A auditoria de integridade financeira não encontrou correcções de dados necessárias: 0 mensalidades com ano divergente da matrícula, 0 mensalidades 2026 ligadas a matrículas de outro ano, 0 mensalidades fora do calendário e 0 mensalidades sem matrícula.

Também foi auditado o “Foco da Operação” da dashboard. No Curtume, os valores antigos misturavam o ano civil da competência com o ano letivo: os 334 pendentes eram matrículas 2025, e os 1.259 em atraso incluíam mensalidades históricas. A view e o cálculo da dashboard foram corrigidos para o ano activo. Para 2026/2027, a referência esperada é: 2.638 cobranças pendentes, 0 em atraso, 0 matrículas pendentes, 24 admissões pendentes e 22 turmas sem horário publicado.

## Trabalho concluído

### Contexto académico e Balcão

- Adicionado selector explícito de ano letivo no Balcão.
- O dossier do aluno usa o RPC contextual quando existe ano seleccionado.
- Mensalidades exibidas e total da dívida são filtrados pelo ano seleccionado.
- Pagamentos exigem `matricula_id` e validação da entidade no ano letivo.
- Rematrícula no Balcão usa aluno, matrícula, ano e turma de destino coerentes.
- Dívida com saldo aberto bloqueia a rematrícula em qualquer canal; a regularização é oferecida no próprio fluxo do Balcão.
- Pagamentos parciais são permitidos, aplicados às mensalidades mais antigas primeiro, mas não liberam a rematrícula antes do saldo zero.
- A rematrícula em massa via RPC e via API alternativa usa a mesma regra obrigatória do Balcão e não depende de `bloquear_inadimplentes`.
- O resultado da rematrícula em massa identifica aluno, motivo, quantidade de mensalidades e valor da dívida.
- O operador pode abrir “Regularizar no balcão” e retornar à confirmação com o aluno/contexto preservado.
- Após a quitação, o Balcão mostra a ação “Continuar”; a confirmação mostra “Contexto retomado” e o modal mantém o histórico dos pagamentos parciais da sessão.

### Rematrícula

- A janela 2026/2027 pode ser preparada antes do início do ano letivo.
- A exigência de candidaturas formais não bloqueia rematrículas de alunos já matriculados no ano anterior durante essa preparação pré-início.
- O serviço `SERV_REMATRICULA` foi adicionado ao catálogo padrão do código.
- O Curtume recebeu o serviço `SERV_REMATRICULA` no banco, activo, com valor base `0 Kz` até a escola definir o preço oficial.
- O Balcão evita duplicar pedidos de rematrícula em pagamento e mantém idempotência do fluxo.

### Geração de mensalidades

- As rotas de rematrícula passaram a gerar por matrícula activa real, incluindo `matricula_id`.
- A cobrança começa no maior entre o início do ano letivo e a data financeira/data de matrícula.
- O mês final só é gerado para classes de exame.
- Classes de exame são reconhecidas por flag, número da classe ou nome (`6ª Classe`/`9ª Classe`).
- Erros de insert de mensalidades deixam de ser silenciosamente ignorados nas rotas alteradas.
- Foi criada e aplicada a função/trigger `enforce_mensalidade_matricula_scope` / `trg_validate_mensalidade_matricula_scope`.
- A proteção verifica matrícula activa, escola, aluno, turma, ano letivo, calendário e início de cobrança.
- Geradores legados que não enviam `matricula_id` tentam resolvê-lo quando existe uma matrícula activa inequívoca.
- O RPC contextual foi corrigido globalmente para separar `ano_letivo` de `ano_referencia`; a correcção não é específica do Cheme.
- O Balcão mostra “Sem matrícula neste ano” quando não existe matrícula no ano seleccionado, em vez de “Em dia”.

### Curtume — estado confirmado

- Ano activo: 2026.
- Calendário: 01/09/2026–31/08/2027.
- Janela de rematrícula activa: 07/08/2026–06/09/2026.
- Tabelas de mensalidade 2026/2027 por classe/curso existem.
- Serviço de rematrícula existe e está activo.
- Não foram alterados preços nem eliminados registos financeiros históricos.

## Evidências de validação

- `pnpm --filter web exec tsc --noEmit`: passou após as alterações.
- `git diff --check`: passou nos ficheiros alterados.
- Migration SQL validada numa transação revertida antes da aplicação.
- Migration de escopo de mensalidades aplicada no PostgreSQL remoto.
- Trigger remoto confirmado como activo.
- Serviço de rematrícula do Curtume confirmado no banco.
- O build completo mais recente não foi concluído nesta sessão; deve ser executado antes do deploy.

## Backlog prioritário

### P0 — antes de produção

- [ ] Fazer commit/push das alterações ainda não commitadas, isolando-as dos ficheiros pessoais/artefactos não relacionados.
- [ ] Executar `pnpm --filter web run build` sem argumentos extra e resolver qualquer falha.
- [ ] Fazer smoke test no Curtume no Balcão com um aluno real: seleccionar 2026/2027, confirmar que só aparecem mensalidades daquele ano e testar pagamento de rematrícula.
- [ ] Fazer smoke test de dívida: pagamento parcial, retorno contextual e liberação somente após saldo zero.
- [ ] Confirmar que uma matrícula de classe normal não cria o mês final e que uma turma de 6ª/9ª cria o mês final.
- [ ] Definir com a escola o valor oficial de `SERV_REMATRICULA`; neste momento está deliberadamente em `0 Kz`.
- [x] Gerar relatório read-only de mensalidades fora da matrícula/calendário antes de qualquer correcção de dados.
- [ ] Aplicar correcções de dados apenas após revisão financeira/auditoria; não apagar histórico automaticamente.
- [ ] Executar build completo após as últimas alterações de filtros globais, Radar e Fluxo de Caixa.
- [ ] Fazer smoke test no browser em Balcão, Turmas & Mensalidades, Carteira, Radar e Fluxo de Caixa com 2025 e 2026/2027.

### P1 — robustez e consistência

- [x] Corrigir o RPC de dossier contextual para devolver apenas mensalidades do ano solicitado; o filtro de UI permanece como defesa adicional.
- [x] Corrigir a dashboard operacional para usar `matriculas.ano_letivo` e contar turmas/pendências apenas no ano activo.
- [ ] Unificar a geração em funções SQL/RPC, reduzindo a duplicação entre as duas rotas TypeScript e os geradores de banco.
- [ ] Remover fallback silencioso de valor mensal (`45000`) nos geradores; ausência de tabela de preço deve exigir configuração explícita.
- [ ] Garantir que a migration de seed de `SERV_REMATRICULA` seja aplicada a todas as escolas e que novas escolas recebam o serviço por defeito.
- [ ] Criar testes automatizados para: ano lectivo cruzado, data de matrícula tardia, classe normal, classe de exame e matrícula inactiva.
- [ ] Registar a migration aplicada remotamente no fluxo oficial de migrations/deploy, evitando drift entre banco remoto e repositório.
- [x] Criar auditoria de integridade de rematrícula, matrículas e mensalidades.
- [x] Fazer backfill conservador dos vínculos históricos com destino inequívoco.
- [x] Criar read model de Fluxo de Caixa por ano letivo.
- [x] Criar read models por ano para os agregados financeiros consumidos pelas telas escolares: KPIs mensais, pagamentos por status, inadimplência e dashboard.

### P2 — operação e produto

- [ ] Adicionar preview/dry-run da geração de mensalidades antes de confirmar lote.
- [ ] Mostrar no Balcão a origem da dívida: ano, matrícula, turma e competência.
- [x] Criar relatório de reconciliação para detectar mensalidades sem `matricula_id`, com ano divergente ou fora do calendário.
- [ ] Permitir configurar valores de rematrícula e emolumentos por escola/ano no ecrã financeiro.
- [ ] Documentar o procedimento de abertura, encerramento e reabertura da janela de rematrícula.
- [x] Alinhar bloqueio de dívida entre Balcão, rematrícula em massa via RPC e API alternativa.
- [x] Criar saída graciosa para regularização e retomada da confirmação sem perder o aluno em contexto.

## Decisões e limites actuais

- Dívida de ano anterior não é apagada nem escondida globalmente; aparece quando o operador consulta o ano correspondente.
- Rematrícula e matrícula inicial não têm exactamente a mesma regra: rematrícula de aluno existente pode ser preparada antes do início do ano; candidatura inicial continua dependente do fluxo formal definido pela escola.
- O sistema não deve criar mensalidades para candidatos ou matrículas inactivas.
- Toda rematrícula deve tratar dívida como pendência acionável, nunca como bloqueio silencioso: mostrar saldo, mensalidades, ação de regularização e retorno.
- A data oficial do calendário escolar é a fonte para o período cobrável; o mês extra de exame depende da regra da classe/turma.

## Actualização 2026-08-08 — filtros globais e reconciliação

O selector global de ano apenas alterava a URL; cada tela precisava ler e propagar
`ano_letivo_id` até à query. As telas que não faziam isso misturavam matrículas e
mensalidades de anos diferentes, sobretudo quando calculavam dívida apenas por `aluno_id`.

Foram corrigidos:

- **Turmas & Mensalidades:** turmas, alunos, dívidas e extratos respeitam o ano seleccionado.
- **Carteira de Cobranças:** usa a matrícula e mensalidades do ano seleccionado.
- **Radar Financeiro:** a lista principal e o widget de alertas usam o mesmo contexto.
- **Fluxo de Caixa:** usa `mv_financeiro_escola_dia_ano`, com chave por escola/ano/dia,
  wrapper público, índice único, refresh concorrente e cron.
- **Selector global:** o mapa de rotas agora inclui `/financeiro` e os seus
  descendentes, além das áreas de notas/financeiro da secretaria; ao navegar entre
  essas telas, `ano_letivo_id` é preservado automaticamente.
- **Dashboard financeiro:** resumo e pagamentos recentes recebem e aplicam o ano
  seleccionado; o resumo usa as datas reais do calendário letivo, não janeiro–dezembro.

Limite conhecido: alguns relatórios financeiros legados ainda consomem read models
agregados sem dimensão `ano_letivo` (por exemplo, status global de pagamentos). Eles
continuam reservados para a visão global/super-admin e não devem ser usados para
decisões financeiras de uma escola/ano. As telas escolares agora usam os wrappers
`*_ano`, com `ano_letivo_id` validado no servidor.

### Actualização 2026-08-09 — relatório e read models por ano

Foi aplicada a migration `20260809110000_financeiro_reconciliacao_e_read_models_ano.sql`.

- Relatório read-only: `/api/financeiro/relatorios/reconciliacao-mensalidades`.
- Interface: **Financeiro → Relatórios → Reconciliação de Mensalidades**.
- Problemas detectados: `SEM_MATRICULA`, `ANO_DIVERGENTE`, `SEM_DATA_VENCIMENTO`,
  `SEM_CALENDARIO`, `FORA_CALENDARIO` e divergência real de turma.
- No Curtume, 2026/2027 ficou sem inconsistências nestas categorias.
- Em todos os anos, existem 312 divergências históricas de turma já conhecidas,
  preservadas para revisão; não foram corrigidas automaticamente.
- Novos modelos: `vw_financeiro_kpis_mes_ano`, `vw_pagamentos_status_ano`,
  `vw_financeiro_inadimplencia_top_ano` e `vw_financeiro_dashboard_ano`.
- Refresh agendado a cada 10 minutos em `refresh_financeiro_read_models_ano`.

### Actualização 2026-08-09 — reconciliação assistida

O relatório deixou de ser apenas informativo. Cada linha pode ser aberta em **Rever**:

- `SEM_MATRICULA`: apresenta candidatas compatíveis e permite confirmar apenas o vínculo.
- `ANO_DIVERGENTE`: permite alinhar o ano ao da matrícula, com justificativa.
- `TURMA_DIVERGENTE`: permite alinhar a turma à matrícula, com justificativa.
- `SEM_DATA_VENCIMENTO`, `SEM_CALENDARIO` e `FORA_CALENDARIO`: não alteram datas; permitem apenas justificar/dispensar com evidência.

As ações exigem confirmação explícita, justificativa mínima e ficam em
`financeiro_reconciliacoes_mensalidades` e `audit_logs`. O relatório oculta apenas o
problema individual que foi resolvido/dispensado; outras inconsistências da mesma
mensalidade continuam visíveis.

### Estado académico e limites do calendário

Foi identificado e corrigido um desvio no painel operacional: a view usava o ano
letivo marcado como activo, mas classificava a fase apenas pelos eventos do dia.
Com isso, o Curtume podia mostrar `Fase: Aulas` antes de 01/09/2026. A view agora
considera `data_inicio` e `data_fim` do ano letivo e expõe `PRE_INICIO`, `REGULAR`,
`EXAMES` ou `POS_ENCERRAMENTO`; fora do intervalo, o Diário fica bloqueado.

### Copiloto orientado pelo calendário do MED

O briefing diário passou a consultar o calendário do ano letivo activo e a incluir:

- intervalo oficial e fase actual;
- período letivo em curso;
- próximo marco do calendário nos 45 dias seguintes;
- recomendação operacional ligada ao marco;
- atalhos para calendário escolar e lançamento de notas.

O fluxo de demonstração passa a ser: calendário oficial → marco → tarefa/alerta →
lançamento de notas → conselho → pauta. A IA explica e prioriza; a execução continua
nas telas oficiais e sob aprovação humana.

O alerta do calendário também pode ser gerado proactivamente pelo cron diário
`/api/cron/ai/calendar-alerts`, protegido por `CRON_SECRET`/`x-vercel-cron` e com
fingerprint diário por escola e próximo marco. O job usa service role apenas no
worker protegido, não altera notas nem pautas e regista falhas por escola para não
interromper o processamento das demais.

Auditoria aplicada no Curtume através de
`public.audit_rematricula_integrity(escola_id, ano_letivo_id)`:

- Ano 2026/2027: os 7 checks ficaram em `PASS`.
- Zero matrículas duplicadas, mensalidades órfãs, mensalidades fora do ano,
  duplicidades mensais ou transições quebradas.
- Foram preenchidos 230 vínculos históricos inequívocos origem→destino; não foram
  criadas nem removidas matrículas.
- Permanecem 312 diferenças históricas de `turma_id` em mensalidades de 2025,
  preservadas para revisão financeira; não afectam os checks operacionais de 2026/2027.

Na rematrícula progressiva, ausência de notas não é reprovação. O balcão permite
confirmar “Lançar notas depois e rematricular agora”, regista a decisão no pedido e
encaminha o lançamento para a tela oficial de Notas.

## Ficheiros principais

- `apps/web/src/components/secretaria/BalcaoAtendimento.tsx`
- `apps/web/src/app/api/secretaria/balcao/rematriculas/route.ts`
- `apps/web/src/app/api/secretaria/balcao/pagamentos/route.ts`
- `apps/web/src/app/api/secretaria/rematricula/route.ts`
- `apps/web/src/app/api/secretaria/rematricula/confirmar/route.ts`
- `apps/web/src/app/api/secretaria/rematricula/janelas/route.ts`
- `apps/web/src/lib/secretaria/servicos-catalogo-padrao.ts`
- `supabase/migrations/20260807150000_enforce_mensalidade_matricula_scope.sql`
- `supabase/migrations/20260807180000_finalize_balcao_rematricula_transaction.sql`
- `supabase/migrations/20260807190000_add_rematricula_integrity_audit.sql`
- `supabase/migrations/20260807200000_backfill_legacy_rematricula_links.sql`
- `supabase/migrations/20260808090000_financeiro_fluxo_caixa_por_ano.sql`

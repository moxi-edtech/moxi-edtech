# KLASSE Temporal Foundation V0.1 — acompanhamento do sprint

Data da atualização: **2026-08-04**
Escopo: código, migrations e verificação somente leitura da base Supabase configurada para o projeto.

> Não guardar credenciais de PostgreSQL neste documento. A senha usada na verificação deve ser rodada após esta sessão.

## Decisão

**APROVADO COM AJUSTES.**

O sprint passa a ser acompanhado internamente como `KLASSE Temporal Foundation V0.1`. O nome `Calendar Intelligence` fica reservado para a etapa posterior, quando existirem regras auditáveis, ações idempotentes e contexto central consumido por perfil.

## Veredito executivo

O sprint avançou, mas ainda não está concluído.

Já existem templates oficiais 2026/2027, um wizard de virada por escola e correções de visibilidade para administradores escolares. A escola Curtume foi confirmada como escola mista, com Pré-Escolar, Ensino Primário e I.º Ciclo do Secundário.

O risco arquitetural identificado permanece válido: uma escola não pode ser ligada a um único calendário. O wizard atual ainda prepara um ano letivo comum e exige a escolha explícita de um template; a seleção de calendário por oferta educativa ainda precisa ser integrada ao fluxo.

O princípio de implementação aprovado é:

`fonte confiável → calendário efetivo → contexto temporal determinístico → regras auditáveis → experiência por perfil`

Não ampliar o chatbot, widgets independentes ou notificações diretas antes de estabilizar esta sequência.

## Quatro camadas do domínio

### A. Source Registry

Documento oficial, versão, autoridade, vigência, extração, revisão, aprovação e evidência de origem.

### B. Effective Calendar

Resolve qual calendário vale para escola, oferta, turma ou utilizador numa data, combinando perfil regulatório, eventos locais, substituições, cancelamentos e precedência.

### C. Temporal Context Engine

Resolve o momento operacional: aulas, avaliação, conselho, matrículas, encerramento, preparação e outras fases simultâneas.

### D. Action Intelligence

Combina contexto temporal com dados reais para materializar tarefas, alertas, severidade, destinatários, prazo e evidências.

## Decisões de modelo

### Fases simultâneas

O contrato não deve reduzir a escola a uma única fase:

```json
{
  "primaryPhase": "ASSESSMENT_PREPARATION",
  "activePhases": [
    "INSTRUCTIONAL_PERIOD",
    "ASSESSMENT_PREPARATION",
    "ENROLLMENT_WINDOW"
  ]
}
```

`primaryPhase` é resolvida por precedência explícita; `activePhases` preserva os estados concorrentes.

### Natureza temporal

Cada item deve declarar `temporal_kind`:

- `MILESTONE` — marco pontual;
- `WINDOW` — janela operacional;
- `STATE` — condição contínua;
- `DEADLINE` — prazo limite.

### Estado editorial e operacional

Os estados são independentes:

- `review_status`: `EXTRACTED`, `IN_REVIEW`, `NEEDS_CLARIFICATION`, `APPROVED`, `REJECTED`, `SUPERSEDED`;
- `operational_status`: `INACTIVE`, `ACTIVE`, `BLOCKED`, `EXPIRED`.

Um item aprovado editorialmente não se torna automaticamente operacional antes da vigência e dos guardrails necessários.

### Proveniência mínima

Toda transformação deve preservar `source_template_id`, `source_item_id`, `source_version`, `source_page`, `source_excerpt`, `review_id`, `applied_at` e `applied_by`.

Overrides devem preservar `override_type`, `override_reason`, `override_author` e `override_created_at`, sem apagar a fonte oficial.

### Perfil temporal da escola

Além do subsistema e timezone, a escola precisa declarar:

- `academic_calendar_profile_id`;
- `academic_year_id`;
- `week_start_day`;
- `instruction_days`;
- `daily_cutoff_time`.

Esses campos resolvem ambiguidades de sábados letivos, turnos noturnos, eventos que atravessam meia-noite e calendários adaptados.

## Estado remoto verificado

### Catálogo 2026/2027

- 4 templates oficiais publicados para 2026/2027:
  - Pré-escolar;
  - Regular e Adultos;
  - Técnico-profissional;
  - Secundário pedagógico.
- Vigência dos templates: `2026-09-01` a `2027-08-31`.
- A existência dos templates foi confirmada na base remota; a aplicação dos dados às escolas continua a ser uma operação do wizard.

### Escolas

- Escolas no catálogo: `7`.
- Escolas com ano letivo ativo: `4`.
- Escolas com `needs_academic_setup = true`: `3`.
- A base possui `1` ano letivo `2026`, mas os restantes anos ativos verificados continuam em `2025`.

### Curtume

- Escola: `COMPLEXO ESCOLAR PRIVADO ADVETISTA DE CURTUME`.
- Slug: `complexo-escolar-privado-advetista-de-curtume`.
- Ano ativo: `2025`, de `2025-09-01` a `2026-07-31`.
- Estado: `needs_academic_setup = true`.
- Ofertas/cursos identificados:
  - `Pré-Escolar`;
  - `Ensino Primário`;
  - `Iº Ciclo do Secundário`.
- Administradores vinculados confirmados: `admin_escola` e `admin_financeiro`.
- URL direta do wizard:
  `/escola/complexo-escolar-privado-advetista-de-curtume/admin/operacoes-academicas/wizard`

## Alterações implementadas

### Visibilidade e autorização

- `admin_financeiro` passa a ter link direto para a virada no portal de operações.
- `admin_secretaria` é normalizado como papel administrativo escolar.
- O wizard aparece no menu de operações académicas e no menu administrativo.
- Escolas sem ano ativo passam a ser consideradas candidatas ao wizard.
- O redirect continua condicionado ao vínculo do utilizador à escola e ao estado do ano letivo.

Ficheiros principais:

- `apps/web/src/hooks/useUserRole.ts`
- `apps/web/src/lib/permissions.ts`
- `apps/web/src/lib/sidebarNav.ts`
- `apps/web/src/lib/operacoes-academicas/academic-year-rollover-gate.ts`
- `apps/web/src/components/secretaria/virada-ano/ConfigStep.tsx`

### Seleção de template

- O wizard deixou de escolher silenciosamente o primeiro template da lista.
- Quando existem vários perfis oficiais, o administrador precisa selecionar explicitamente o perfil regulatório.
- A mensagem do wizard já evita tratar o subsistema como atributo único da escola.

### Fundação multi-oferta

Foi criada a migration:

- `supabase/migrations/20260804120000_multi_offer_calendar_scoping.sql`

Ela adiciona:

- `school_education_offerings`;
- `calendar_profile_id` por oferta;
- níveis, ciclos, classes e cursos associados;
- escopo de eventos por subsistema, nível, ciclo, classe, tipo de curso e audiência;
- `offering_id` em eventos e períodos;
- RLS e índices básicos.

A migration é aditiva e ainda não deve ser considerada aplicada na base remota até passar pelo pipeline de migrations.

## Gaps atuais

| Entregável | Estado | Próxima ação |
|---|---|---|
| Templates oficiais 2026/2027 | Implementado no catálogo remoto | Validar migration aplicada no ambiente alvo |
| Wizard de virada por escola | Implementado | Testar Curtume com `admin_escola` e `admin_financeiro` |
| Visibilidade no menu | Corrigido no código | Fazer deploy da alteração |
| Perfil por oferta educativa | Migration criada | Aplicar migration e criar endpoint de gestão |
| Seleção de template por oferta | Não concluído | Evoluir o wizard para mapear cada oferta a um perfil |
| Eventos com escopo | Schema preparado | Copiar eventos preservando `offering_id` e proveniência |
| Proveniência de fonte | Parcial | Guardar `template_id`, item de origem, versão e revisão por evento |
| Revisão humana por item | Não concluído | Criar estados `EXTRAIDO`, `EM_REVISAO`, `APROVADO`, `REJEITADO` |
| API central de contexto | Protótipo interno | Publicar `/api/academic-context/today` com contrato versionado |
| Regras e alertas idempotentes | Não concluído | Criar regras versionadas, execuções e tarefas auditáveis |
| Widget Hoje na escola | Não concluído | Consumir o contexto por perfil e oferta |

## Caso Curtume — decisão recomendada

Não aplicar automaticamente um único template à escola inteira.

O mapeamento inicial recomendado é:

| Oferta | Perfil regulatório 2026/2027 |
|---|---|
| Pré-Escolar | `PRE_ESCOLAR` |
| Ensino Primário | `REGULAR_ADULTOS` |
| I.º Ciclo do Secundário | `REGULAR_ADULTOS` |

O calendário comum pode ser compartilhado, mas exames, provas, matrículas e encerramentos devem ser filtrados por oferta, nível, classe e curso quando aplicável.

## Bloqueadores antes de declarar o sprint concluído

1. Aplicar e validar `20260804120000_multi_offer_calendar_scoping.sql` num ambiente controlado.
2. Corrigir o wizard para configurar múltiplas ofertas antes de clonar eventos específicos.
3. Preservar a proveniência de cada evento aplicado.
4. Validar as migrations numa instalação limpa (`supabase db reset`) e corrigir qualquer dependência cronológica.
5. Testar acesso e execução com os papéis reais do Curtume.
6. Confirmar contagens remotas após a execução: ano `2026`, períodos, eventos, ofertas e auditoria.

## Critérios de aceite do sprint

- O Curtume vê o wizard pelo menu e pelo redirect de ano expirado.
- `admin_escola` e `admin_financeiro` conseguem abrir e executar apenas dentro do Curtume.
- Nenhum utilizador de outra escola consegue consultar ou executar a virada do Curtume.
- O wizard mostra explicitamente os perfis regulatórios disponíveis.
- Uma escola mista configura mais de uma oferta sem duplicar indevidamente feriados comuns.
- Cada evento específico mantém a oferta e a fonte regulatória de origem.
- Reexecuções são idempotentes e auditadas.
- O estado remoto é verificado depois do deploy; Git e migrations presentes não são tratados como prova de aplicação.

## Próxima sequência

1. Commitar as correções de visibilidade e a migration multi-oferta.
2. Aplicar a migration num ambiente de teste.
3. Criar/configurar as três ofertas do Curtume.
4. Evoluir o wizard para seleção por oferta.
5. Executar dry-run do Curtume.
6. Confirmar a virada e registrar as contagens remotas.

## Contrato recomendado da API

O contrato central futuro deve ser `GET /api/academic-context/today`, com autenticação, `resolveEscolaIdForUser`, `force-dynamic`, timezone da escola, data de referência controlada e filtragem por papel no servidor.

Resposta mínima:

```json
{
  "schemaVersion": "1.0",
  "generatedAt": "2026-08-04T12:00:00Z",
  "asOfDate": "2026-08-04",
  "timezone": "Africa/Luanda",
  "academicContext": {
    "academicYear": "2026/2027",
    "term": 3,
    "primaryPhase": "ENROLLMENT_PREPARATION",
    "activePhases": ["TEACHER_VACATION", "ENROLLMENT_PREPARATION"],
    "instructionalDay": false
  },
  "sourceProfile": {
    "templateId": "uuid",
    "version": "2026.1",
    "authority": "MINED",
    "reviewStatus": "APPROVED"
  },
  "upcomingEvents": [],
  "requiredActions": [],
  "riskSignals": [],
  "evidence": []
}
```

A API devolve factos estruturados, nunca linguagem persuasiva. Um sinal deve ser representado assim:

```json
{
  "key": "GRADES_INCOMPLETE_BEFORE_PUBLICATION",
  "severity": "HIGH",
  "value": 4,
  "deadline": "2027-07-16",
  "evidenceIds": ["ev_1", "ev_2"]
}
```

## Regras iniciais aprovadas

1. **Prova próxima:** evento aprovado começa dentro de `N` dias e a turma ainda possui calendário, sala, horário ou conteúdo pendente. Gera alerta para direção, tarefa para coordenação e aviso individual ao professor quando aplicável.
2. **Notas incompletas antes da pauta:** notas esperadas são maiores que notas lançadas antes de conselho/classificação/publicação. A evidência precisa conter turma, disciplina, professor, quantidade em falta e data limite.
3. **Reconfirmação com documentos incompletos:** janela próxima ou ativa, matrícula elegível e documentos obrigatórios incompletos. Gera fila da secretaria, contagem para direção e comunicação ao encarregado apenas quando autorizada.

Todas as regras devem ser versionadas, executadas de forma idempotente e materializar ações auditáveis; a leitura da API não deve disparar notificações diretamente.

## Fluxo obrigatório de migrations

Antes de consolidar ou corrigir migrations:

1. consultar o ledger remoto;
2. se a migration já foi aplicada, criar uma migration corretiva;
3. se ainda não foi aplicada, consolidar/reordenar apenas antes da partilha;
4. executar `supabase db reset`;
5. testar schema, seeds, RLS, RPC e consulta de contexto.

Não editar silenciosamente migrations potencialmente aplicadas.

## Definition of Done revisada

O `Temporal Foundation V0.1` só fica concluído quando:

1. `supabase db reset` executa do zero sem dependências fora de ordem.
2. Cada escola possui subsistema e timezone explícitos.
3. Cada evento operacional possui origem rastreável.
4. Itens ambíguos não são ativados automaticamente.
5. Overrides preservam a fonte oficial.
6. A precedência é única, determinística e testada.
7. A mesma entrada gera sempre a mesma saída.
8. A API filtra tenant e papel no servidor.
9. As três regras geram ações idempotentes.
10. Toda ação aponta para evidências estruturadas.
11. A UI apenas apresenta o contrato central.
12. O Data Copilot acessa o contexto por ferramenta read-only.

## Roadmap aprovado

```text
Temporal Foundation V0.1
        ↓
Calendar Intelligence V0.2
        ↓
Action Intelligence V0.3
        ↓
KLASSE Brain V1
```

## Implementação deste ciclo

- A rota do wizard continua protegida por tenant e `configurar_escola`; o Super Admin não executa a virada de uma escola.
- `admin_escola`, `admin_financeiro` e `admin_secretaria` podem entrar no fluxo conforme a autorização escolar existente.
- A navegação exibe `Virada 2026/2027` no portal administrativo.
- A migration `20260804120000_multi_offer_calendar_scoping.sql` cria `school_education_offerings`, faz backfill inicial a partir de `cursos` e preserva a proveniência dos eventos e períodos.
- O endpoint passa a devolver as ofertas ativas e aceita `offerings: [{ offering_id, template_id }]`.
- O wizard exige um perfil regulatório por oferta quando a escola possui múltiplas ofertas; escolas sem ofertas usam o fallback de template único.
- A tela `Configuração de Calendário` deixou de aplicar diretamente um template único e encaminha a aplicação oficial para o wizard por oferta; continua disponível para consulta e ajustes manuais.
- A tela `Fluxos de Trabalho` passou a expor o contexto operacional único e alerta quando admissões estão fixadas manualmente fora do ano letivo ativo.
- O pipeline de aprovação de notas deixou de ser apenas estado local da tela: passou a ser persistido em `school_workflow_configs`, associado ao ano letivo ativo e protegido por tenant/perfil administrativo.
- Corrigido o salvamento de admissões no modo automático: seleção vazia é enviada como `null`, e erros de validação passam a ser exibidos com mensagem legível em vez de `[object Object]`.
- A seleção de admissões passou a destacar anos letivos futuros já criados, como `2026/2027`, e a API rejeita referências a anos ainda inexistentes na escola.
- Corrigido o link `Configurar por oferta`: páginas no contexto `/operacoes` agora usam a rota canônica `/admin/operacoes-academicas/wizard`, evitando o 404 em `/operacoes/academico/wizard`.
- Adicionada rota de compatibilidade `/operacoes/academico/wizard` para links antigos ou sessões com bundle/cache anterior.
- Criado modo `retroactive_pending` como política geral de redução de fricção: qualquer escola autorizada pode arquivar o ano anterior com pendências académicas, preservar o preenchimento retroativo, promover alunos sem saldo devedor e manter devedores em pendência.
- O modo retroativo exige confirmação explícita no último passo, usa RPC separado, grava auditoria e não altera o comportamento padrão da virada.
- A migration `20260804170000_retroactive_academic_cutover.sql` foi aplicada remotamente e registrada no ledger; a RPC `cutover_ano_letivo_retroativo` está disponível.
- Criada e aplicada a promoção individual pós-pagamento: a secretaria pode promover um devedor após saldo zerado, com validação financeira, prevenção de duplicação e auditoria; migration `20260804180000_promote_student_after_payment.sql` está registrada no ledger remoto.
- Corrigida a ordem da preparação: a migration `20260804190000_prepare_curriculum_before_rollover.sql` prepara currículos publicados e copia a matriz do ano de origem antes de criar turmas no destino, removendo o bloqueio repetitivo de “turma sem currículo publicado”.
- Corrigida também a chave da RPC de clonagem: a tabela remota usa `curso_matriz_id`, não `disciplina_id`; migration `20260804200000_fix_clone_turma_disciplinas_conflict.sql` aplicada e registrada no ledger.
- Corrigida a idempotência da preparação curricular: currículos destino existentes são reutilizados/publicados e novas versões usam a próxima versão disponível; migration `20260804210000_idempotent_rollover_curricula.sql` aplicada remotamente.
- O resumo da preparação agora diferencia “novos registos” de “estrutura já existente”; zeros numa repetição idempotente não significam que o ano esteja vazio.
- O resumo do wizard passou a mostrar os totais reais do ano destino e o incremento desta execução, evitando que 2026/2027 apareça falsamente vazio após uma repetição.
- O primeiro passo do wizard agora permite ativar explicitamente a política retroativa; pendências académicas passam a ser acompanhadas, enquanto bloqueadores técnicos continuam impedindo a operação.
- A execução local foi validada com `npm run typecheck --workspace apps/web` e `git diff --check`.

## Pendências de aplicação

- A migration foi aplicada à base remota e registrada no ledger como `20260804120000`.
- A migration `20260804150000_school_workflow_configuration.sql` foi aplicada remotamente e registrada no ledger; a tabela está vazia até a primeira gravação de uma escola.
- O backfill remoto criou 14 ofertas ativas em 7 escolas; o Curtume ficou com 3 ofertas: Pré-Escolar, Ensino Primário e Iº Ciclo do Secundário.
- Ainda é necessário executar o dry-run funcional do Curtume e só então confirmar a preparação de 2026/2027.
- A resolução completa de escopos por nível, ciclo, classe, curso e overrides continua no backlog do `Effective Calendar`.

## Conclusão

O problema de descoberta do wizard foi corrigido e a unidade de decisão passou de escola isolada para oferta educativa. Curtume já tem caminho técnico para mapear Pré-Escolar, Primário e Iº Ciclo a perfis regulatórios distintos. A virada só deve ser declarada concluída depois da aplicação validada da migration e do dry-run remoto com contagens auditáveis.

## Backlog e próximos passos

### Concluído neste ciclo

- Wizard acessível no portal escolar e rota de compatibilidade para `/operacoes/academico/wizard`.
- Aplicação de calendário por oferta educativa, com proveniência e templates 2026/2027.
- Virada retroativa geral, com confirmação explícita, auditoria e preservação de pendências académicas.
- Promoção automática de alunos sem dívida e promoção individual pós-pagamento.
- Preparação idempotente de currículos, matrizes, turmas, períodos e preços.
- Resumo do wizard com totais reais do destino e novos registos da execução.
- Fluxos de admissões e notas vinculados ao ano letivo operacional.

### Backlog P0 — antes da operação em escala

- Executar dry-run autenticado em cada escola pendente, começando pelo Curtume.
- Confirmar que cada curso/classe possui currículo publicado e matriz com disciplinas ativas.
- Validar a promoção individual com pagamento real ou ambiente de teste controlado.
- Confirmar que devedores permanecem pendentes e não recebem matrícula no destino.
- Testar reexecução dos botões sem duplicar anos, currículos, turmas, preços ou matrículas.
- Executar testes de tenant e autorização para `admin_escola`, `admin_financeiro` e `admin_secretaria`.
- Confirmar contagens remotas após cada virada e anexar o `run_id` da auditoria.

### Backlog P1 — reduzir operação manual

- Criar painel de pendências retroativas por aluno, turma, disciplina e documento.
- Adicionar ação de promoção individual diretamente na ficha financeira do aluno.
- Permitir promoção em lote apenas para alunos cujo saldo esteja zerado.
- Exibir no dashboard a diferença entre ano ativo, ano de admissões e ano em preparação.
- Criar alerta para escolas com ano destino criado, mas ainda não ativado.
- Materializar snapshots e tarefas de preenchimento retroativo sem bloquear a operação.
- Expor histórico de cada tentativa da virada, incluindo itens reutilizados e novos.

### Backlog P2 — fundação temporal e inteligência

- Completar escopos de eventos por oferta, nível, ciclo, classe e curso.
- Implementar overrides locais sem apagar a fonte oficial.
- Publicar `/api/academic-context/today` com fases simultâneas, evidências e filtragem por papel.
- Implementar regras idempotentes de provas próximas, notas incompletas e documentos pendentes.
- Materializar `requiredActions` e `riskSignals` com evidências consultáveis.
- Integrar o contexto temporal ao Data Copilot em modo read-only.

### Ordem recomendada

```text
1. Dry-run e contagens remotas
2. Correção de currículos e turmas pendentes
3. Virada retroativa auditada
4. Regularização académica retroativa
5. Promoções individuais após pagamento
6. Contexto temporal central
7. Alertas e Data Copilot
```

### Critério de encerramento da operação

Uma escola só deve ser marcada como virada quando o ano destino estiver ativo, o ano origem estiver arquivado, as contagens de promovidos/devedores estiverem auditadas e existir uma fila explícita para os dados académicos que serão preenchidos retroativamente.

## Resultado do comité de engenharia — 2026-08-04

O comité foi executado após as alterações deste ciclo:

- `agents/outputs/REPORT_SCAN.md` e `agents/outputs/REPORT_SCAN.json` foram regenerados.
- `agents/outputs/PERF_GATE.md` e `agents/outputs/PERF_GATE.json` foram regenerados.
- O scan encontrou `0` achados críticos, `5` achados altos e `2` baixos.
- O gate de performance ficou `FAIL`, portanto este conjunto ainda não está aprovado para merge global.
- Os cinco bloqueios são sistémicos e não específicos da virada: `NO_STORE`, `F09_MV`, `F18_MV`, `P0_3_MV_DASHBOARDS` e `PLAN_GUARD`.
- O resultado não invalida o fluxo de virada 2026/2027; significa que o repositório ainda não satisfaz todos os gates gerais de performance e planos.

### Próximas ações do comité

1. Corrigir ou documentar as ocorrências reais de `NO_STORE`, separando exemplos em documentação de rotas operacionais.
2. Completar os artefactos das MVs de inadimplência, pagamentos e dashboards: índice único, refresh concorrente, cron e wrapper.
3. Fechar o guard de plano no entrypoint visual de recibos.
4. Reexecutar `pnpm agents:scan` e `pnpm agents:gate` após essas correções.
5. Só declarar `can_merge: true` quando `PERF_GATE.md` estiver em `PASS` e os WARNs tiverem registo no `WARN_REGISTRY.md`.

### Decisão operacional

O wizard e as migrations da virada continuam aptos para validação funcional controlada por escola, começando pelo Curtume. A execução em produção deve permanecer condicionada ao dry-run, à confirmação das contagens e ao registo de auditoria; o `FAIL` do gate geral impede apenas a declaração de merge global, não o acompanhamento funcional isolado.

## Correção dos gates — 2026-08-04

- O detector de `NO_STORE` foi alinhado à política do contrato: APIs operacionais continuam sem cache, enquanto exemplos/documentação e componentes clientes não são tratados como violação de rota.
- O detector das MVs foi corrigido para reconhecer o schema real `internal` e o wrapper público `vw_pagamentos_status`.
- `ReciboImprimivel` passou a consultar `usePlanFeature("fin_recibo_pdf")` e desabilita o botão quando o plano não permite emissão.
- A migration `20260804220000_restore_required_mv_refresh_crons.sql` normaliza os refreshes de radar, pagamentos, secretaria e admin sem duplicar jobs.
- A migration foi aplicada remotamente, registrada no ledger e confirmou `8` cron jobs obrigatórios.
- O scan final ficou com `0` críticos, `0` altos e `6` baixos; `PERF_GATE.md` ficou em `PASS` com `0` blockers.
- `npm run typecheck --workspace apps/web` passou e `git diff --check` passou.

### Resultado

Os gates gerais de performance estão fechados. Permanecem apenas findings baixos não bloqueantes para acompanhamento; a operação da virada continua sujeita ao dry-run e à auditoria por escola descritos no backlog P0.

## Comité final — 2026-08-04

- `pnpm agents:scan`: concluído com `0` críticos, `0` altos e `6` baixos.
- `pnpm agents:gate`: `PASS`, com `0` blockers.
- `git diff --check`: passou.
- Veredito: gates técnicos aprovados; permanecem apenas validações funcionais da virada por escola.

# KLASSE — Estado consolidado de implementação

Data: 13 de agosto de 2026  
Branch de trabalho: `codex/reabertura-notas`  
Último commit desta frente: `14c3a3dc` — Implementar reabertura graciosa de notas

Este documento registra o que foi alterado, o que foi aplicado no banco e o que permanece pendente. Ele complementa os documentos específicos de cada sprint.

## 1. Fluxo de notas fechadas

### Implementado

- Professor solicita reabertura para turma, disciplina, trimestre e ano letivo.
- Solicitação exige justificativa.
- API valida autenticação, escola ativa, professor e atribuição à turma/disciplina.
- Secretaria, admin escola e perfis administrativos autorizados podem aprovar ou rejeitar.
- Rejeição exige motivo separado da justificativa original.
- Aprovação libera a pauta por 24 horas.
- A autorização expira automaticamente.
- Trigger/RPC do banco continua sendo a barreira final contra lançamento indevido.
- Professor vê os estados pendente, rejeitado e aprovado, incluindo a data limite.
- Painel de operações atualiza a lista após cada decisão e mostra nomes legíveis de turma, disciplina e professor.
- Erros de bloqueio no lançamento de notas retornam status de conflito (`409`) e mensagem útil.

### Banco

Migração aplicada e verificada no PostgreSQL:

`supabase/migrations/20261213000000_fluxo_solicitacao_reabertura_notas.sql`

Confirmados:

- colunas `status`, `solicitado_por`, `aprovado_por`, `decidido_em`, `ano_letivo_id` e `decisao_motivo` em `excecoes_pauta`;
- índice `idx_excecoes_pauta_review`;
- função `public.can_bypass_pauta_lock(uuid, uuid, uuid, uuid)` atualizada;
- estados `PENDENTE`, `APROVADO`, `REJEITADO` e `EXPIRADO`.

## 2. Operação da aula e chamada

Código presente no workspace:

- aula possui ciclo operacional: agendada, aguardando confirmação, em andamento, finalizada, cancelada ou não realizada;
- professor inicia/confirma a aula;
- professor finaliza a ocorrência com resumo e observações;
- secretaria acompanha ocorrências operacionais;
- chamada e encerramento devem alimentar o relatório da escola;
- existem rotas de professor e secretaria para consultar, iniciar e finalizar aulas.

Arquivos centrais:

- `apps/web/src/app/api/professor/aulas/`
- `apps/web/src/app/api/secretaria/aulas/`
- `apps/web/src/components/layout/operacoes/AulasOperacionaisPanel.tsx`
- `supabase/migrations/20260813120000_professor_aula_operacional.sql`

## 3. Plano de aula

Código presente no workspace:

- professor cria, edita e submete plano de aula;
- plano suporta tema, objetivos, competências, conteúdos, metodologia, recursos, atividades, avaliação, tarefa de casa, observações e arquivo;
- secretaria revisa, aprova ou devolve para ajustes;
- plano pode ser associado à ocorrência da aula;
- atividades pedagógicas podem apontar para aula e plano de aula;
- portal do aluno pode consumir atividades vinculadas ao plano.

Arquivos centrais:

- `apps/web/src/app/professor/planos-aula/page.tsx`
- `apps/web/src/app/api/professor/planos-aula/`
- `apps/web/src/app/api/secretaria/planos-aula/`
- `apps/web/src/components/layout/operacoes/PlanosAulaReviewPanel.tsx`
- `supabase/migrations/20260813133000_planos_aula_professor.sql`
- `supabase/migrations/20260813140000_link_activities_to_lesson_plans.sql`

## 4. Fluxos acadêmicos já entregues nos commits recentes

- Login responsivo mobile sobre imagem de referência Integra+.
- Ajustes de contraste e redirecionamento seguro no login.
- Fluxos de aprendizagem contínua e recebimentos.
- Hardening de admissões, calendário, matrícula e acesso a notas após pagamento.
- Evolução do portal do aluno, incluindo atividades, simulador, drawer, PWA/offline e agenda.
- Promoção de alunos, emissão de recibos e controles de virada do ano letivo.
- Contexto obrigatório de ano letivo em notas e frequência.
- Feedback de salvamento de presença e notas.

Referência: `git log --oneline` no branch de trabalho.

## 5. Alterações ainda não consolidadas

O workspace contém alterações anteriores não relacionadas ao último commit. Elas não foram misturadas no commit `14c3a3dc`.

Principais grupos identificados:

- atividades professor/aluno;
- frequência e presença;
- quadro de horários;
- notificações da secretaria;
- componentes de notas;
- migrações de aula, plano e atividades;
- relatórios gerados por agentes em `agents/outputs/`;
- artefatos acadêmicos, UNESCO e materiais em `docs/`, `output/` e `portfolio/`.

Esses itens precisam de triagem individual antes de novo commit. Não devem ser adicionados com `git add -A` sem revisão.

## 6. Verificações executadas

- `npm run typecheck`: passou.
- ESLint dos arquivos da frente de reabertura: sem erros; existem avisos preexistentes de hooks e `any`.
- `git diff --check`: passou.
- Migração de reabertura: aplicada no banco e verificada por consulta de metadados.

## 7. Critério de pronto da frente

A frente é funcional quando o professor consegue solicitar, a secretaria consegue decidir e uma aprovação válida permite o lançamento de notas sem permitir bypass após expiração. A frente ainda precisa de teste manual com três perfis reais e evidência de auditoria da decisão.

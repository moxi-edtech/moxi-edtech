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
- a Dashboard de Operações lista as ocorrências do dia e abre um relatório dedicado por aula;
- o relatório detalhado reúne identificação, frequência, registo do professor, plano e atividades;
- a secretaria e os perfis administrativos autorizados podem exportar o relatório da ocorrência em PDF.
- o relatório oferece retry, atualização manual e atualização periódica, com feedback durante a geração do PDF;
- a frequência nominal é exibida no detalhe e incluída no PDF;
- a Dashboard permite busca por turma, disciplina ou professor e filtro por estado da aula.

Arquivos centrais:

- `apps/web/src/app/api/professor/aulas/`
- `apps/web/src/app/api/secretaria/aulas/`
- `apps/web/src/components/layout/operacoes/AulasOperacionaisPanel.tsx`
- `apps/web/src/app/escola/[id]/(portal)/operacoes/aulas/[aulaId]/page.tsx`
- `apps/web/src/app/api/secretaria/aulas/[aulaId]/relatorio/`
- `apps/web/src/lib/operacoes/renderAulaRelatorioPdf.tsx`
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
- Migração P0 de auditoria (`20261214000000_auditoria_excecoes_pauta_p0.sql`) aplicada e verificada no banco em 13 de agosto de 2026.
- Função `audit_excecao_pauta_changes` e trigger `trg_audit_excecoes_pauta_changes` estão ativos em `public.excecoes_pauta`.
- Edição inline de slots de horário: implementada na tela de estrutura de horários.
- Retorno de falha na chamada: agora oferece ação explícita de tentar novamente.
- Solicitações de reabertura de notas agora mostram histórico, atualizam o estado periodicamente e permitem nova tentativa após rejeição ou expiração.
- A home do professor agora oferece ações diretas por turma para presença, notas, plano de aula e horário compartilhado.
- O lançamento de notas diferencia ano letivo fechado, turma de outro ano e trimestre bloqueado, orientando a próxima ação.
- A configuração de tempos do horário mostra conflitos locais e bloqueia o salvamento enquanto houver sobreposição ou intervalo inválido.

## 7. Critério de pronto da frente

A frente é funcional quando o professor consegue solicitar, a secretaria consegue decidir e uma aprovação válida permite o lançamento de notas sem permitir bypass após expiração. A frente ainda precisa de teste manual com três perfis reais e evidência de auditoria da decisão.

## 8. Incremento atual — horários e frequência

- A tela de slots já permitia criação e remoção; agora permite editar nome, início e fim inline antes de salvar.
- A API existente valida intervalo início/fim, sobreposição temporal e conflitos persistidos.
- A frequência mantém os estados salvo, offline e falha, com tentativa novamente diretamente no retorno de erro.
- Ainda falta o teste integrado de edição de slot → distribuição no quadro → publicação → agenda compartilhada do professor.
- O professor agora pode abrir o quadro publicado completo de cada turma associada, incluindo disciplinas de outros professores.
- A publicação do quadro rejeita duplicidade de slot e conflito do mesmo professor ou sala dentro da própria edição, além dos conflitos já publicados.
- Auditoria de reabertura passou a ser garantida por trigger no banco, incluindo solicitação, aprovação, rejeição, expiração e before/after.
- Checklist P0 criado em `docs/P0_CHECKLIST_REABERTURA_NOTAS.md`.
- Relatório operacional da secretaria agora inclui resumo de presença por aula e plano de aula associado quando disponível.

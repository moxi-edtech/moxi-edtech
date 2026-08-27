# Aprovação necessária — RAA Sprint 4 / Indisciplina

run_id: RAA-SPRINT4-INDISCIPLINA-20260815
timestamp: 2026-08-15
estado: APPROVED — migration aplicada e validada em 2026-08-15

## Acção proposta

Criar `public.raa_indisciplina_eventos` como fonte persistida e auditável para eventos de indisciplina grave/muito grave que possam afetar a análise RAA. O modelo preserva escola, ano letivo, turma, matrícula e aluno no mesmo registo, aplica RLS por escola e evita que uma ocorrência solta seja usada fora do contexto académico correto.

## Diff

Migration proposta:

`supabase/migrations/20260815200000_raa_indisciplina_events.sql`

Inclui:

- tabela contextual com gravidade, categoria, descrição, estado e medida aplicada;
- vínculo obrigatório à escola, ano letivo, turma, matrícula e aluno, com validação de pertença escola/matrícula no endpoint transacional;
- índice operacional por escola/ano/turma/matrícula/estado;
- RLS através de `user_can_access_raa_school(escola_id)`;
- trilha de registo e resolução por utilizador.

## Risco

É uma alteração de schema que cria uma nova fonte oficial para eventos disciplinares. Não altera dados existentes, mas precisa de validação dos nomes das tabelas, da validação transacional de pertença escola/matrícula e da política de acesso antes de aplicação.

## Como aprovar

Commit com mensagem: `APPROVE: RAA-SPRINT4-INDISCIPLINA-20260815`

## Como rejeitar

Commit com mensagem: `REJECT: RAA-SPRINT4-INDISCIPLINA-20260815 [motivo]`

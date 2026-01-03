## Funil de Admissão

- **Cadastro (Lead)**: cria somente `public.alunos` com `numero_processo` automático (gatilho `trg_auto_numero_processo`) e registra intenção em `public.candidaturas` (`curso_id`, `ano_letivo`, `status pendente/pago`). Não gera `matriculas` nem `profiles` nesta fase.
- **Conversão**: endpoint `/api/secretaria/candidaturas/[id]/confirmar` lê a candidatura, valida turma, cria `public.matriculas` (gera `numero_matricula` e sincroniza `profiles.numero_login`), cria/reativa `profiles` + `escola_users` e marca a candidatura como `matriculado`.
- **UI**: `/secretaria/matriculas/nova` agora seleciona uma candidatura pendente/paga, mostra `numero_processo/curso`, aloca a turma e chama o endpoint de confirmação. Orçamentos (`/api/financeiro/orcamento/matricula`) usam `curso_id/ano_letivo` da candidatura.

### Tabelas e gatilhos
- `public.candidaturas`: guarda intenção pré-matrícula; RLS por escola.
- `public.alunos`: mantém `numero_processo` único por escola; trigger `trg_auto_numero_processo` sequencia por escola com `pg_advisory_xact_lock`.
- `public.matriculas`: gera `numero_matricula` via trigger existente no momento da conversão.

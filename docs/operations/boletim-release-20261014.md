# Boletim — liberação controlada 2026-10-14

## Banco de produção
As definições canónicas encontram-se em:
- `20271014110000_aluno_boletim_matricula_session.sql`
- `20271014120000_boletim_payment_transition_guards.sql`

Aplicadas via conector Supabase em 2026-10-14, antes de ativar a interface, com as versões automáticas:
- `20261014170233` (mesma definição da primeira migration)
- `20261014170259` (mesma definição da segunda migration)

As migrations correspondentes a essas versões automáticas no repositório são *no-op*: não devem reaplicar o DDL durante o replay de um banco limpo, porque as dependências de schema são definidas nas migrations canónicas de 2027. **Em produção, as duas versões canónicas devem ser marcadas como já aplicadas na tabela de histórico, sem executar novamente o DDL.** Isso mantém a linha do tempo de desenvolvimento alinhada.

## Validação
- Fluxo completo com fixtures sintéticas, PostgreSQL descartável e concorrência em CI.
- CI responsiva e zoom em 5 resoluções x 3 níveis.
- Monitorar Vercel READY, SHA e erros de runtime depois do deploy.
- Não modificar RLS, fiscal, outbox, ledger ou recibos históricos.
- Nunca incluir dados reais de menores em logs e evidências.

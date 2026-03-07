# Relatório — Normalização de slugs em `public.escolas`

## Resultado
- A migração `20260330000000_escolas_slug_constraints.sql` normaliza slugs inválidos e regista cada ajuste via `RAISE NOTICE` durante a execução.
- Validação remota (2026-03-09): `escolas_slug_format_check` e `escolas_slug_idx` criados; nenhuma normalização necessária.

## Como obter a lista real
- Executar a migração no ambiente alvo e capturar o output do `psql`/Supabase CLI.
- Procurar mensagens do tipo: `Normalizing escola slug <uuid>: <antigo> -> <novo>`.

## Execução remota
- Constraint `escolas_slug_format_check`: presente.
- Índice `escolas_slug_idx`: presente.
- Slugs inválidos detectados: 0.

## Imutabilidade do slug
- Migração aplicada: `20260328000001_escolas_slug_immutable.sql`.
- Trigger `trg_escolas_slug_immutable`: presente.
- Função privilegiada `update_escola_slug()`: presente.

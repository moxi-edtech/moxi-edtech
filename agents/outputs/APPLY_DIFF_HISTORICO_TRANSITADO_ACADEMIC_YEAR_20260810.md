# Apply diff — Histórico transitado por ano letivo académico

run_id: historico-transitado-academic-year-20260810
timestamp: 2026-08-10T00:00:00-03:00
reversibilidade: migration additive; rollback via git revert e migration inversa aprovada

## Escopo

- adicionar `historico_transitado_anos.ano_letivo_id` com FK para `anos_letivos.id`;
- associar registos antigos pelo par escola + ano, sem apagar dados;
- criar índice único canónico por sessão académica;
- sincronizar o campo inteiro legado para clientes antigos;
- apresentar e gravar `2025/2026`, `2026/2027`, etc. na API e no perfil do aluno.

## Segurança

- não há `DROP TABLE`, `DROP COLUMN`, `TRUNCATE` ou alteração de RLS;
- a migration falha se encontrar registos sem sessão correspondente;
- o POST valida que `ano_letivo_id` pertence à escola resolvida no servidor.

## Arquivos

- `supabase/migrations/20260810120000_historico_transitado_ano_letivo_id.sql`
- `apps/web/src/app/api/secretaria/alunos/[id]/historico-transitado/route.ts`
- `apps/web/src/components/aluno/DossierHistoricoTransitadoSection.tsx`
- `docs/STATUS_IMPLEMENTACAO_FLUXOS_SECRETARIA_2026-08-10.md`

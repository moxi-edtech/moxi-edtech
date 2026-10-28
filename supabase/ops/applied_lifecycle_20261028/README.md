# Auditoria das migrações SSOT aplicadas em 28/10/2026

Estes 11 ficheiros preservam **exatamente** o SQL aplicado e registado em `supabase_migrations.schema_migrations` na instância KLASSE. Cada versão continua representada em `supabase/migrations` como um *replay shim* (`SELECT 1 WHERE false`) para preservar o histórico remoto sem executar dependências prematuramente num banco vazio.

**Motivo:** os nomes das migrações KLASSE existentes incluem versões `202612...`, `202708...` e `202710...`, aplicadas antes das novas versões `20261028...`. Em replay lexical, a vista dependeria de `historico_snapshot_locks` (definida em `20261204...`) e as políticas dependeriam de `cc_security` (definida em `20271022...`). A instalação original não reprova porque tais objetos já estavam presentes.

**Fonte efetiva de replay:** `supabase/migrations/20271027120000_lifecycle_ssot_post_replay_guard.sql`, posterior à última migração existente `20271026123000`, recompõe as funções, constraints, trigger, vista, grants e RLS. Foi ensaiada numa transação revertida no banco remoto, sem alterações efetivas.

**Regra especial:** a conciliação de um único histórico órfão está preservada como script executado neste arquivo; **não** é reproduzida como backfill global na consolidação. Em qualquer nova instância, vínculos órfãos ficam pendentes de evidência e revisão escolar. O fechamento académico oficial e o RAA não são inferidos por estes scripts.

**Atenção:** a versão canónica do schema para ambientes novos exige replay completo em banco descartável. A passagem do SQL numa transação sobre o schema instalado não substitui esse ensaio. Não integrar esta PR sem CI e homologação.

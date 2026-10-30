# Reconciliação do histórico Supabase × GitHub — 30/10/2026

## Alcance confirmado e operação

Projeto: `wjtifcpxxxotsbmvbgoq`; branch: `feat/global-curriculum-med-inheritance-20261030`; PR: [#306](https://github.com/moxi-edtech/moxi-edtech/pull/306).

**19 migrações já executadas no Supabase foram reconciliadas com os identificadores de ficheiro do GitHub, sem executar SQL de aplicação.** O conteúdo `statements[1]` de cada registo foi comparado integralmente, byte a byte, ao conteúdo do ficheiro correspondente no HEAD da branch, e as diferenças foram **zero**. Cada alteração foi protegida por verificações de nome, checksum MD5, origem e destino, e aplicada atomicamente ao ledger `supabase_migrations.schema_migrations`. As colunas de conteúdo, histórico, autor, chave de idempotência e rollback não foram tocadas.

Scripts operacionais versionados **fora** de `supabase/migrations`:

- `scripts/ops/reconcile-med-lifecycle-migration-ledger-20261030.sql` — 13 entradas.
- `scripts/ops/reconcile-legacy-verified-migration-ledger-20261030.sql` — 3 entradas.
- `scripts/ops/reconcile-additional-exact-migrations-20261030.sql` — 3 entradas.

Todos foram executados duas vezes; a segunda execução não encontrou operações pendentes, confirmando idempotência.

### Versões antes → depois

| Histórico original | Versão canónica | Ficheiro |
|---|---|---|
| 20261030205800 | 20271029235900 | lifecycle_contextual_status_ssot_v2 |
| 20261030205657 | 20271029235910 | lifecycle_persisted_status_contract_v3 |
| 20261030205709 | 20271029235920 | raa_balcao_authoritative_permissions |
| 20261030205721 | 20271029235921 | guard_grade_period_source_and_window |
| 20261030101904 | 20271029235922 | canonical_med_calendar_offering_profiles |
| 20261030101925 | 20271029235923 | apply_canonical_med_calendar_atomic |
| 20261030205729 | 20271029235924 | guard_fechamento_academico_jobs_rls |
| 20261030103711 | 20271029235926 | global_curriculum_med_calendar_contract |
| 20261030105217 | 20271029235927 | med_annual_offering_profiles |
| 20261030105229 | 20271029235928 | med_year_activation_readiness |
| 20261030110307 | 20271029235929 | guard_med_initial_year |
| 20261030110318 | 20271029235930 | bootstrap_med_terms_on_new_school |
| 20261030111053 | 20271029235931 | cutover_activate_year_order |
| 20260928105542 | 20260928120000 | klasse_chatgpt_write_rpcs |
| 20261023120619 | 20271023100000 | command_center_internal_roles |
| 20261023120624 | 20271023101000 | command_center_internal_global_search |
| 20261024230025 | 20271015100001 | command_center_course_reused_classes |
| 20261024230032 | 20271015100002 | command_center_course_turmas_page |
| 20261026111331 | 20271026123000 | operational_receipt_outbox_worker |

## Validação pós-correção

- As 13 versões da cadeia MED/RAA estão todas presentes com os timestamps da branch; **0 origens antigas** restantes. As 6 migrações independentes estão alinhadas; **0 origens antigas** restantes.
- Nenhuma migração foi reaplicada ou desfeita e a contagem de linhas do ledger manteve-se em **696**.
- Indicadores académicos preservados: **1.115 matrículas, 949 notas, 7.167 avaliações, 14 históricos**.
- Calendário MED 2026/2027: Escola KLASSE **8/8** perfis anuais e Curtume **3/3**, preflight `READY`.
- O esquema fiscal, o ledger de pagamentos e AGT/SAF-T não foram tocados.

## Atenção: histórico global ainda NÃO totalmente alinhado

A árvore Git da branch contém **940** migrações e o histórico remoto contém **696** entradas. Após as 16 correções, ainda existem:

- **308 ficheiros Git** sem timestamp correspondente no ledger remoto; podem ser migrações não executadas, migrações executadas com outro nome/versão e/ou migrações destinadas a outros ambientes.
- **67 registos remotos** sem timestamp correspondente no conjunto local; podem ser aplicações históricas diretas, scripts operacionais sem ficheiro de migração ou outras versões.
- A migração remota **20261030102120** (`reconcile_klasse_2026_med_calendar_preserve_academic_ids`) foi uma reconciliação pontual de dados escolares sem ficheiro SQL equivalente no Git. **Não** atribuir um timestamp arbitrário a esse registo, não criar um ficheiro replayable fictício e não repetir essa correção na Escola KLASSE.
- Outros dois exemplos de aplicações diretas sem correspondência local: **20261028102053** e **20261028102450**.
- Foram calculados hashes Git blob SHA-1 de todos os registos remotos sem versão local com uma única instrução SQL: **não há mais correspondências byte a byte** entre esses registos e os ficheiros locais ainda pendentes. Para os 67 restantes, não há evidência suficiente para atualizar o ledger automaticamente.
- A cadeia PR #306 tem agora **0** ficheiros `202710292359xx` ausentes do ledger, mas isto **não prova** que todo o histórico passado esteja reconciliado.

**Bloqueio operacional:** Não executar `supabase db push`, em particular `--include-all`, nem marcar indiscriminadamente as 311 migrações como aplicadas. A reconciliação global exige analisar migrações pendentes e os efeitos reais no esquema. O Supabase CLI compara versões do Git com `supabase_migrations.schema_migrations`; marcar uma migração como aplicada sem executar a definição pode causar perda de funcionalidade ou falhas no próximo deploy.

## Próxima auditoria

1. Comparar `supabase migration list --linked` com os ficheiros locais da branch e classificar as 311/70 divergências individualmente.
2. Para cada par comprovadamente idêntico, reconciliar o timestamp do ledger preservando payloads; **não** mexer em migrações sem prova de equivalência.
3. Para migrações genuinamente pendentes, revisar ordem de dependências e segurança antes de qualquer aplicação.
4. Manter esta reparação exclusivamente operacional; não convertê-la em migration SQL de aplicação, para não criar uma nova divergência.

# KLASSE — contrato canónico MED por ano letivo

## Invariantes

- **Global**: `curriculum_presets.id` → `curriculum_preset_calendar_contract` define o subsistema e nível de ensino. Não há mapeamento hardcoded por escola.
- **Escola**: `cursos.curriculum_key` identifica o preset; `school_education_offerings` representa a oferta permanente.
- **Ano**: `school_offering_med_year_profiles` identifica exatamente um perfil publicado para cada `offering_id + ano_letivo_id`. Chaves estrangeiras compostas garantem que escola, oferta e ano pertencem ao mesmo tenant.
- **Compatibilidade**: `school_education_offerings.calendar_profile_id` continua a expor o perfil do ano **ativo**, sem ser a fonte de histórico.
- **Fonte**: `calendarios_oficiais_anos` e `calendario_templates.calendario_canonico_ano`; trimestres e eventos preservam `source_template_id` e `source_item_id`.
- **Imutabilidade**: vínculos anuais já atribuídos não podem mudar de ano, perfil ou escola, nem ser apagados. Reaplicação idêntica é idempotente; divergências exigem conciliação explícita.
- **Segurança**: RLS de leitura por função de papel escolar, sem INSERT/UPDATE/DELETE para clientes autenticados. A criação automática passa por RPC autorizada e triggers protegidos; nunca há substituição automática de um decreto ausente.

## Provisionamento de escola nova

1. A escola inicia com **zero cursos instalados**.
2. Na criação inicial de um ano >= 2026, o banco exige um calendário oficial publicado, substitui datas legadas do onboarding pelos limites oficiais e instala três trimestres conforme os itens do MED, dentro da mesma transação.
3. Ao instalar qualquer dos presets do catálogo global, `ensure_k12_course_offering` valida a escola, o curso, o preset e o ano ativo; a oferta fica vinculada ao perfil MED correspondente.
4. Se não existir decreto publicado para o ano solicitado, o provisionamento do ano falha explicitamente. Não se fabricam datas. A RPC comercial de onboarding, assinaturas e comissões não foi modificada.

## Preparação anual (exemplo: 2027/2028)

1. Publicar a nova fonte `calendarios_oficiais_anos(ano_base=2027)` **somente após validar o decreto MED** e os perfis por subsistema, com três trimestres compatíveis.
2. No Balcão → Virada, escolher o calendário do **ano seguinte**. `deriveCanonicalMedCourseSelections` associa todas as ofertas existentes ao perfil 2027 pelo subsistema global, nunca usando o ponteiro do ano anterior.
3. A RPC `aplicar_calendario_med_canonico_v1` grava ano, períodos, eventos e vínculos. O trigger `trg_stage_med_annual_profile` guarda `school_offering_med_year_profiles` de 2027, mas preserva `calendar_profile_id` de 2026 enquanto 2026 estiver ativo.
4. A pré-validação `med_year_cutover_preflight(escola_id,ano_letivo_id)` exige fonte oficial, três trimestres, todas as ofertas com perfil anual e eventos aplicados. Repetir é seguro quando os dados coincidem.
5. O cutover académico existente valida pautas, matrículas, snapshots e destinos. Ao ativar 2027, o trigger `trg_guard_med_year_activation` repete a verificação MED **na transação**; o trigger posterior atualiza o ponteiro de compatibilidade para 2027.
6. A RPC de cutover desativa primeiro o ano antigo e ativa depois o destino, na mesma transação, respeitando o índice único de ano ativo por escola.
7. Matrículas, notas, avaliações, IDs de períodos e eventos históricos de 2026 ficam associados ao seu ano de origem, sem serem reescritos pela troca de perfil.

## Homologação

- Confirmar `ready=true` nos dois anos/cursos antes de cutover, e que todas as ofertas ativas possuem vínculo anual para o destino.
- Verificar que 2026 mantém o perfil antigo após preparar 2027, e muda o ponteiro apenas após ativar 2027.
- Bloquear e mostrar ação de recuperação quando faltar decreto, trimestre, vínculo, evento, curso ou fecho académico.
- Exercitar testes autenticados por papel, idempotência, concorrência entre dois preparadores, rollback e isolamento entre escolas em ambiente de staging. **Não simular um decreto futuro em produção.**
- Cursos/presets novos sem classificação global ou sem perfil MED para o subsistema devem falhar com erro explícito.
- `SECUNDARIO_PEDAGOGICO` existe como subsistema normativo, mas não se deve atribuir automaticamente nenhum dos 34 presets atuais a ele sem classificação aprovada.

## Migrações e produção — atenção ao ledger

Os ficheiros de código deste contrato são:

- `20271029235926_global_curriculum_med_calendar_contract.sql`
- `20271029235927_med_annual_offering_profiles.sql`
- `20271029235928_med_year_activation_readiness.sql`
- `20271029235929_guard_med_initial_year.sql`
- `20271029235930_bootstrap_med_terms_on_new_school.sql`
- `20271029235931_cutover_activate_year_order.sql`

Estes seis contratos foram aplicados ao projeto Supabase `wjtifcpxxxotsbmvbgoq` em 2026-10-30 através do conector, que registou versões **20261030103711, 20261030105217, 20261030105229, 20261030110307, 20261030110318 e **20261030111053****. As versões no histórico remoto **não correspondem** aos nomes de migração deste branch. Não executar `supabase db push` sem reconciliar explicitamente o ledger (`supabase migration list` / `supabase migration repair` após inspeção), e sem validar a cadeia #296 → #298 → #302 → #303 → #304 → #305 em staging. O contrato MED anterior também contém versões históricas já aplicadas sob outros números.

### Estado conferido em 2026-10-30

- Escola KLASSE, 2026/2027: **8/8** ofertas com perfil anual, **3** trimestres oficiais e **92** eventos; preflight `READY`.
- Curtume, 2026/2027: **3/3** ofertas com perfil anual, **3** trimestres oficiais e **31** eventos; preflight `READY`.
- Catálogo global: **34/34** presets classificados.
- Fonte canónica publicada: apenas **2026/2027**; não criar nem ativar 2027/2028 sem o decreto e os perfis oficiais.
- Nenhum fluxo fiscal/AGT foi alterado.

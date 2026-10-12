# KLASSE — reconciliação do histórico de migrations, somente leitura

Referência: `main=8e881a69e730220c31102a0c7cf187997776ad00`.
Produção consultada **somente via SELECT** no projeto
`wjtifcpxxxotsbmvbgoq`. Nenhuma migration, `migration repair` ou
alteração de schema foi executada em produção.

## Inventário fechado

| Origem | Versões | Observações |
|---|---:|---|
| Histórico remoto | 624 | `supabase_migrations.schema_migrations` |
| Main original | 860 | **866 arquivos SQL**, 6 versões duplicadas, 1 nome inválido |
| Ambas | 563 | Coincidência de versão, não prova equivalência de SQL |
| Somente remoto | 61 | Todas restauradas **apenas nesta PR DRAFT**, sem aplicação |
| Somente main original | 297 | Evidências por migration em `local-only-297.csv` |

O catálogo remoto foi inventariado por `SELECT` sobre `pg_class`,
`pg_attribute`, `pg_proc`, `pg_trigger`, `pg_policies`,
`pg_indexes` e `pg_type`. O CSV das 297 versões contém classes
exclusivas e a lista de objetos esperados e encontrados:

- **9 JA_APLICADA_SEM_REGISTRO (candidatas):** objetos nomeados presentes;
  sem comprovação de que todos os comandos da migration foram executados.
- **3 NAO_APLICADA (por objetos):** nenhum objeto declarado foi localizado.
  SQL dinâmica/DML pode ter produzido efeito independente.
- **285 PARCIAL/INDETERMINADA:** mistura de objetos; ou função/corpo
  não verificável; ou migração de dados/DDL dinâmica. **Não presumir
  execução nem prescrever repair sem prova.**

Estes são **resultados do catálogo, não confirmação transacional do
histórico de migrations**. Não executar os arquivos "somente local"
novamente só porque não constam do histórico.

## Proveniência das 61 exclusivas do remoto

Encontradas **60** em branches fiscais existentes, muitas encadeadas por
PRs #118/#119/#120/#121/#122/#125/#131/#137. A versão
`20260928105542_klasse_chatgpt_write_rpcs` estava
`SEM_ARQUIVO_NO_REPO` entre todos os refs e tags examinados.

O histórico remoto contém o SQL aplicado em
`supabase_migrations.schema_migrations.statements[1]`. A comparação
criptográfica e semântica com os arquivos Git resultou:

- 34 migrations idênticas byte a byte.
- 22 migrations equivalentes **após normalização de whitespace**.
- 4 versões com **conteúdo semanticamente diferente** no Git
  (`20260927154626`, `20260927155157`, `20260927163407`,
  `20260927211445`).
- 1 versão sem arquivo em ref/branch pesquisado.

A PR restaura os 56 arquivos de Git com equivalência verificada; para
as outras cinco, restaura a transcrição original do histórico remoto,
não a variante Git conflitante. Os arquivos adicionados mantêm as
versões já registradas no remoto. **Nenhuma migration previamente
existente na main foi editada.** Ver `remote-only-61.csv` e
`remote-history-624.csv`.

## BILL-001..003/009 em produção

As 17 funções, triggers, tabelas e índices críticos enumerados em
`bill-guards-provenance.csv` **existem no catálogo de produção**.
Entre eles:

- `fiscal_block_document_delete`,
  `fiscal_block_item_mutation`, `fiscal_block_event_mutation`;
- triggers `trg_fiscal_documentos_no_delete`,
  `trg_fiscal_documento_itens_no_mutation` e
  `trg_fiscal_documentos_eventos_no_mutation`;
- `trg_fiscal_series_counter_guard`,
  `trg_fiscal_documentos_require_pending_insert`;
- `fiscal_tax_profiles` com RLS,
  `ux_fiscal_tax_profiles_open_code`,
  `idx_financeiro_itens_tax_profile` e
  `idx_financeiro_tabelas_tax_profile`.

O catálogo de privilégios confirmou que `anon`,
`authenticated` e `service_role` **não têm INSERT/UPDATE/DELETE/
TRUNCATE diretos** nas três tabelas fiscais imutáveis. Os papéis
`anon` e `authenticated` não executam
`fiscal_reservar_numero_serie(uuid)` ou
`fiscal_finalizar_assinatura(uuid,text,text,text)`.

Os guards principais foram originados nas migrations
`20260927135510`, `20260927135620`,
`20260927140841`, `20260927141627`;
os objetos tributários BILL-009 em `20260927181109` e
`20260927181334`. Esses arquivos **não existiam na main original**;
portanto a main original não possuía a proveniência necessária para
reproduzir esses guards num banco novo. Restaurar a fonte nesta PR
aproxima a possibilidade, mas **não prova replay integral**.

A migration adicional
`20270826132000_reconcile_fiscal_guard_catalog.sql` é um *backstop*
idempotente: cria somente cinco triggers comprovadamente ausentes,
mantendo funções existentes, valida privilégio/RLS/índices e **falha
fechada** quando dependências faltam. Em produção todos os objetos
verificados já estão presentes: essa migration foi preparada para
ser **no-op** nesse estado. **Não foi aplicada.** A fixture
PostgreSQL 17 executa a convergência duas vezes em dados sintéticos,
sem alterar qualquer tabela de produção.

## O que NÃO está provado

1. **Full replay.** Um PostgreSQL 17 limpo da imagem oficial falha
   imediatamente na primeira migration
   `20260127020139_remote_schema.sql`, pois requer a extensão
   Supabase `pg_cron`. A tentativa local de subir o runtime
   `public.ecr.aws/supabase/postgres:17.6.1.071` não completou:
   Docker Desktop perdeu o daemon durante o pull. O CI testa a
   convergência dos guards num PostgreSQL 17 descartável e registra
   a tentativa de replay como **bloqueada**, nunca como aprovada.
2. **pg_dump schema-only de produção.** O conector disponibiliza
   consultas `SELECT`, não uma conexão de `pg_dump` com privilégio
   estritamente read-only. Não é lícito alegar equivalência entre
   dumps inexistentes. O arquivo
   `DECLARATION-PROXY-NOT-PGDUMP.csv` compara apenas **nomes de
   objetos declarados no SQL original** com presença no catálogo,
   incluindo falsos positivos para colunas definidas dentro de
   `CREATE TABLE`, migrações sobrescritas ou objetos de extensão.
   É um indicador de triagem, **não** diff normalizado de schema.
3. **Duplicação de versões.** A main original contém seis versões
   com dois arquivos: `20260520004000`, `20260821120000`,
   `20260827170000`, `20260924010000`,
   `20261215012000`, `20261218100000`. Três dessas
   versões já aparecem no histórico de produção. Existe ainda
   `MIGRATION_ADMISSAO_P0.sql` sem timestamp. Não renomear
   versões aplicadas sem auditoria por arquivo.
4. **Histórico ≠ estado efetivo.** O catálogo presente não prova
   que SQL de UPDATE, grants, triggers, função substituída e dados
   foram aplicados na ordem original.

## Plano gated — nenhum comando abaixo foi executado

**Gate 1 — revisão de fontes e colisões.** Aprovar a proveniência
SQL das 61 migrations recolocadas, especialmente as cinco recuperadas
do histórico remoto; separar e dar novas versões somente aos arquivos
que forem comprovadamente não aplicados. Não alterar nem substituir
a versão de migration já aplicada. Aprovar a definição de schema
esperado antes de qualquer deploy.

**Gate 2 — replay efetivo.** Utilizar uma instância **Supabase PostgreSQL
17** descartável com `pg_cron`, `auth`, `storage` e extensões,
aplicar todas as migrations em ordem e resolver os erros de replay.
Produzir `pg_dump --schema-only --no-owner --no-privileges` nessa
instância. Sem replay 100% verde, **não é seguro executar db push**.

**Gate 3 — comparação read-only.** Provisionar conexão PostgreSQL
de **somente leitura** de produção, com `default_transaction_read_only=on`,
guardar a URL como segredo de CI (nunca em commit/log). Executar
`pg_dump --schema-only` com as mesmas opções, normalizar versões
extensões, ownership, comentários, OIDs e grants conforme o escopo,
e comparar por objeto/tipo/DDL. Validar especialmente funções
SECURITY DEFINER, triggers, RLS, políticas e grants.

**Gate 4 — repair somente após prova.** As nove versões em
`gated-repair-candidates.csv` têm comandos exatos **candidatos**:
`supabase migration repair --status applied <version>`. Cada comando
exige revisão de corpo/efeito, snapshot de histórico e aprovação DBA.
**Não executar nenhuma ainda.** As outras 288 versões locais
(285 PARCIAL + 3 NAO_APLICADA) ficam sem repair proposto até confirmação
específica. As 61 restauradas já constam no histórico de produção e
não precisam de repair; não reaplicá-las. Os seis números duplicados
precisam de conciliação independente.

**Gate 5 — aprovação humana:** Só após Gates 1–4 concluídos reavaliar
o merge desta DRAFT e eventual aplicação. **Neste trabalho: nenhum
merge, repair, DDL ou alteração em produção.**

## Auditoria amostral das tags archive

Ambas as tags foram resolvidas pelo SHA original:
`archive/gracefulness/rematricula-strict-eligibility` →
`cceffe3f7e9a4d2eab089ecb322c502e20d4e6e3`;
`archive/gracefulness/balcao-hardening` →
`ac7aa539fd701b534a493783424195a2599b522e`.

`archived-gracefulness-hunks.csv` cobre individualmente **144 hunks**
das duas branches, usando `git apply --check -R`, linhas
resultantes na main, arquivo/commit e âncora da implementação sucessora:

- Rematrícula estrita: **90 hunks**, 71 presentes no código atual
  e 19 substituídos pela evolução RAA/fluxo académico.
- Balcão: **54 hunks**, 50 presentes e 4 substituídos pelo fluxo
  `document_pending` + `academic_history_pending`.

O hunk mais sensível é o bloqueio financeiro: a branch antiga barrava
**todo saldo aberto**, mas a main aplica explicitamente
`summarizeOverdueRematriculaDebt`, bloqueando **saldo vencido**
da matrícula de origem e permitindo mensalidades futuras. Essa
mudança está comentada no código atual e é uma **decisão funcional
posterior**, não um hunk inadvertidamente perdido. Não foi
reintroduzida uma política financeira mais rígida sem decisão de
produto. Os demais 19 casos têm sucessores verificáveis no código
atual (RAA, decisão condicional, código dos estados, banner, modal
e hook). Nenhum hunk material não incorporado foi identificado
nessa amostra; logo não foi aberto outro Draft para esses hunks.

## Divergência encontrada na suíte fiscal de #137

A suíte de cinco testes da PR fiscal #137 foi trazida para a main
**com preservação das cinco categorias**. O quarto teste original
referenciava `20260930174453_recover_fiscal_hardening_current_contract.sql`,
arquivo **que não existe na main nem no histórico das 61 versões
remotas**. Esse teste exigia o trigger
`trg_fin_ledger_immutable_truncate`, **não encontrado no catálogo
de produção**. A produção protege UPDATE/DELETE por
`trg_fin_ledger_immutable` e nega TRUNCATE aos três papéis
`anon`, `authenticated` e `service_role`. O teste permanente
passa a exigir essa proteção comprovada pela migration
`20260927153607_bill_007_payment_allocations_and_ledger_hardening.sql`,
sem diminuir qualquer privilégio ou trigger existente.
O reforço contra TRUNCATE por proprietário privilegiado da branch
#137 **não foi tratado como já aplicado**; depende de avaliação
fiscal em PR própria, sem aplicar agora.


### Instrumentação de comparação futura

O script `scripts/compare-schema-only-gated.sh` executa dois
`pg_dump --schema-only --no-owner --no-privileges --schema=public`
e produz comparação normalizada **somente se** o replay integral tiver
gravado `/tmp/klasse-full-replay-green` e se houver uma credencial
`KLASSE_PROD_READONLY_DB_URL` com privilégios estritamente read-only.
O CI não imprime URL nem SQL do diff; os nomes de objetos divergentes
são registrados separadamente. Enquanto os pré-requisitos estiverem
ausentes, o CI marca **BLOCKED** e não simula equivalência.

## Addendum — resolução das seis colisões no DRAFT (12/10/2026)

Este commit **não altera qualquer arquivo cuja versão já estivesse registrada
em produção**. As seis colisões foram resolvidas no diretório ativo:

| Versão originalmente duplicada | Versão no remoto | Tratamento |
|---|---|---|
| `20260520004000` | ausente | `create_afiliados_portal` preservado; `create_marketing_assets` passa a `20260520004001`, com guards para policies |
| `20260821120000` | ausente | versão principal preservada; `dedupe_professor_assignments` passa a `20260821120001`, com CREATE de função somente se ausente |
| `20260827170000` | presente, mas sem SQL registrado | `aluno_emitir_documentos_operacionais` preservada; a função conflitante antiga vai a `supabase/ops/historical_version_collisions` e há nova `20260827170001` que não substitui função existente |
| `20260924010000` | ausente | `.rollback.sql` movido para `supabase/ops/historical_version_collisions`, sem execução no replay |
| `20261215012000` | presente (`add_finalizar_matricula_blindada`) | arquivo registrado preservado; antiga constraint arquivada, nova `20261215012001` condicional preserva sem alteração a constraint efetiva de produção que inclui `transferido` |
| `20261218100000` | presente (`refine_mapa_aproveitamento_consolidation`) | arquivo registrado preservado; seed antigo arquivado, nova `20261218100001` cria função/trigger apenas se ausentes |

O arquivo não versionado `MIGRATION_ADMISSAO_P0.sql` foi retirado do
diretório executável e preservado em `supabase/ops/historical_version_collisions`.
Ele possuía grants e SQL de negócio não homologados para replay automático.
Não foi aplicado ou descartado.

O gate `scripts/check-migration-inventory.py` passa a **falhar** com
duplicações e nomes inválidos. Resultado atual da branch Draft:
**926 versões locais únicas, 624 registradas em produção, 302 somente locais,
0 versões remotas sem arquivo, 0 colisões, 0 nomes inválidos**.
O inventário de **860/624, 61 remoto exclusivo, 297 local exclusivo** nas
seções anteriores permanece como **snapshot da main inicial**, não do DRAFT.
A presença dos novos números não autoriza `db push` nem `repair`.

As funções conflitantes originalmente eram `CREATE OR REPLACE`; a nova
versão só instala uma função se ela não existir. Isso é conservador, mas
não comprova que a função já existente tenha a lógica desejada: revisar
suas definições efetivas por separado. Não aplicar automaticamente até
o replay e schema-only parity gates passarem.

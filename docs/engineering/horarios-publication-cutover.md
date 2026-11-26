# Horários — cutover da protecção transaccional

Estado: bloqueado para produção, 2026-11-24.

- PR #464 integrada; merge bbed42e8cb93e8e35ad95131bc160536b8c13099.
- app.klasse.ao serve e724f038a7bf3696d50f740f1b1655cd850c72b1 (PR #461). O consumidor antigo ainda grava versões publicadas; não instalar a regra draft-only antes de trocar a API e homologar.
- PostgreSQL 17.6: proposta isolada aprovada em fixtures sintéticas, não em todo o schema/RLS real.
- Auditoria de leitura: 573 aulas publicadas, 266 em turmas activas/anos activos, zero pares de conflitos activos, oito aulas com slot inválido (não currículo) em ESG-9-M-A (3), ESG-8-M-A (3), ENF-10ª Classe-M-A (2). Nenhuma pertence à escola Curtume. Não corrigir por inferência.
- Ledger remoto mais recente observado: 20271203005200_fecho_diario_rejeicao_responsaveis. O ficheiro com este nome não foi localizado na main; não reconciliar o ledger por suposição nem reutilizar versões. CLI indisponível no ambiente actual.
- Antes de versionar: confirmar ledger/repositório, gerar migration com CLI, alinhar permissões das RPCs com os papéis administrativos/secretaria e a autorização exacta do tenant, proteger log de eventos, rever chamadas directas a ensure/publish e escritores de atribuição docente. Cobrir alteração de tempos partilhados, ordem de locks e concorrência. Não transformar a proposta existente em migration executável sem estes testes.
- Sequência de release: API compatível em produção -> smoke autenticado de criação/edição/publicação sem mutar versões oficiais indevidamente -> diagnosticar e regularizar oito slots com aprovação escolar -> CI PG17 com RLS e concorrência dos escritores -> aplicação apenas da migration validada, verificação do ledger e contagens.
- Importação XLSX não faz parte do escopo. Sem alteração de produção nesta auditoria.


## Reauditoria de 26/11/2026 — main `f85931ba`

- A API em main resolve a versão de origem e envia apenas um rascunho a `upsert_quadro_horarios_versao_atomic`; não foi homologado o consumidor em produção nesta ronda.
- Auditoria de leitura no PostgreSQL 17: **573** aulas publicadas, **266** activas, **8** slots incompatíveis em **3** turmas, **0** pares de sobreposição activa. Os oito slots continuam por regularizar; preservar horários existentes. A consulta não valida todo o currículo.
- O trigger `trg_horario_publication_guard` não está instalado. O upsert remoto tem referência a advisory lock mas não ao erro HORARIO_STALE da proposta. O trigger de conflitos existente não tem referência a advisory lock. Estes marcadores são diagnósticos, não prova de segurança.
- `ensure_horario_versao` e `publish_horario_versao` ainda concedem EXECUTE a anon (SECURITY INVOKER); avaliar acessibilidade efectiva sob RLS e revogar concessão desnecessária no cutover. `log_horario_event` é SECURITY DEFINER, executável por authenticated: testar autorização e integridade do registo. Nenhuma exploração foi executada.
- Ledger remoto mais recente observado: `20271204030000_provas_pedagogicas`, presente na main. Isto não comprova reconciliação de todo o ledger; CLI indisponível. Não reutilizar versões nem instalar proposta.
- Auditoria reproduzível em `supabase/ops/tests/horarios_publication_readiness_audit.sql` (somente leitura). A proposta fica isolada; não activar sem cobertura dos escritores directos, slots partilhados, ordem dos locks, sessões concorrentes e homologação do consumidor. Sem alterações em produção.

## Implementação candidata — 26/11/2026
- Reauditoria: 8/8 slots com equivalentes exactos, 0 destinos ocupados, 0 duplicados, 0 desvios curriculares entre as 266 aulas activas. A correcção proposta só troca a FK do slot, mantém dia/horas/identidades, aborta em ambiguidade e grava auditoria. Nenhuma alteração em produção.
- Os três escritores de bootstrap/onboarding passam pela RPC atómica. Remoção de rascunho usa FK cascade em uma só operação.
- A proposta fecha RPCs directas de publicação e de log, retira TRUNCATE das tabelas, verifica actor/tenant/papel, protege snapshots e tempos partilhados. RPCs adquirem lock por escola antes de linhas; triggers usam try-lock e falham com 40001 em concorrência ou isolamento não suportado. Reatribuição docente continua independente de horário.
- CI sintético ainda necessário; a migração continua candidata, não versionada. Não aplicar nem retirar draft sem comprovar o contrato real de onboarding, compatibilidade do consumidor Vercel, execução PG17 e versão livre no ledger.

## Versionamento e gate de release
- SQL candidato aprovado em 12/12 checks no commit `2b759b3f`, execução `45878174111`. Artefacto CLI `20271204031100_horarios_publication_guard.sql`, SHA-256 `40c42b1eca6b16fa831e440583a769fc335ecf56d2b27f73b907b3913dda3fb7`.
- A migração versionada é a fonte única; o CI testa exactamente este ficheiro e verifica o hash. Reconciliado com main `762159d0`; sem sobreposição de ficheiros. Ledger remoto observado em 26/11: `20271204030100`, versão candidata livre. Main contém ainda `20271204031000_academic_grade_rls_p0.sql`; a sua aplicação é independente e fora desta PR.
- Vercel: alias app.klasse.ao aponta para `3959efd4` (READY), anterior aos escritores corrigidos neste PR. **Não executar DDL restritiva antes de publicar o consumidor compatível e validar fluxo autenticado**. Não promover a branch de rascunho sem CI integral. Aplicação e homologação ainda não executadas.

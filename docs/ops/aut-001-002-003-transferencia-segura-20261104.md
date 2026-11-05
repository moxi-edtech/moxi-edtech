# KLASSE — AUT-001, AUT-002 e AUT-003 (04/11/2026)

## Estado de entrega

| Frente | Implementado nesta PR #320 | Não homologado / pendência |
| --- | --- | --- |
| AUT-001 (histórico académico) | Defesa fail-closed em **qualquer** atualização de `matriculas.turma_id`, incluindo RPC individual; locking de notas, exames, frequência e presenças; erro `P1050` | **Ainda não existe transferência com evidência académica lançada**. Requer contrato temporal de matrícula/disciplinas/pautas e atualização dos leitores do aluno, professor, RAA e documentação oficial |
| AUT-002 (homologação) | Fixture PostgreSQL efémera, regressão negativa e concorrência em duas sessões com auditoria/lotação | **Executado**: GitHub Actions com PostgreSQL 16 descartável, incluindo concorrência/RLS sintético, 11/11 workflows verdes. Ainda falta E2E autenticado via Data API do Supabase real |
| AUT-003 (migrations) | Migração de transferência pós-último versionamento remoto, guard de CI e inventário de divergências no Git | Migração `20271031003000` aplicada e alinhada no ledger remoto; **divergências globais de migrações ainda não reconciliadas** |

## Fontes e verificação na produção

- A migração `20271031003000_bulk_turma_transfer_atomic.sql` foi aplicada no projeto Supabase `wjtifcpxxxotsbmvbgoq` em 04/11/2026. O conector atribuiu inicialmente a versão automática `20261104165009`; a entrada única foi normalizada de modo condicional e auditável para `20271031003000`, preservando o SQL aplicado (18.188 caracteres) e sem replay de outras migrações.
- Snapshot: `supabase/ops/reports/aut003_transfer_migration_ledger_snapshot_20261104.json`.
- Snapshot anterior à aplicação: 944 ficheiros SQL locais, 705 versões no histórico remoto. Diferenças por **versão**: 307 locais sem versão remota, 68 remotas sem ficheiro local. Há uma diferença nominal material e 58 versões remotas com nome ausente.
- Estas diferenças **não são prova** de que 375 migrações estejam por executar; vários efeitos SQL podem existir no catálogo. Compare assinaturas, corpos, permissões, triggers e hashes antes de qualquer repair.
- 536 matrículas ativas; 14 têm notas registadas. Existem 949 notas históricas e 7.167 avaliações. `notas.avaliacao_id` aponta para `avaliacoes.turma_disciplina_id`, que aponta para a turma original; `guard_grade_period_source_and_window` exige coincidência da turma e da matrícula.
- O financeiro mantém `mensalidades.turma_id` independente: 316 de 9.434 mensalidades com turma explícita já divergiam da matrícula na auditoria. A transferência não deve reescrever recebimentos, recibos nem histórico de cobranças sem o contrato financeiro próprio.

## Garantias reforçadas na migração

1. `transferir_turma_em_lote` conserva a identidade das matrículas; locks de turmas em ordem determinística, matrículas `FOR UPDATE`, valida tenant, escola, role, estado aberto, ano ativo via trigger, curso, classe, lotação e motivo. A auditoria por matrícula é inserida na mesma transação.
2. `trg_guard_turma_transfer_academic_evidence` impede que a RPC individual (`transferir_aluno_turma`) ou um writer administrativo mova uma matrícula com notas, exames ou frequência sem reconciliar a fonte do histórico.
3. `a_00_lock_matricula_academic_evidence` impõe `FOR SHARE` antes dos triggers de gravação de evidências, serializando com mudanças `FOR UPDATE`. `public.presencas` é uma **view** sobre `frequencias` e `matriculas`; não suporta triggers de linha. O lock é aplicado na tabela particionada `frequencias`, incluindo as partições existentes.
4. `SECURITY DEFINER` usa `search_path = ''` e funções com nomes de schema. `anon` e `PUBLIC` não podem executar a RPC nem as funções auxiliares de trigger.
5. Um erro no lote reverte **todas** as alterações, incluindo as entradas de auditoria; não se cria segunda matrícula e os vínculos académicos/financeiros não são reatribuídos.

## Executar homologação isolada (não na produção)

Pré-requisitos: PostgreSQL de teste local e `psql` disponível; ligação ao repositório. Criar **uma base vazia chamada** `klasse_transfer_test` (sem informação real).

```bash
PGURL=postgresql://localhost:5432/klasse_transfer_test \
  bash supabase/ops/tests/bulk_turma_transfer_isolated_verify.sh
```

O script recusa hosts que não sejam `localhost`/`127.0.0.1`, verifica o nome da base e a ausência de tabelas pré-existentes. Executa o bootstrap sintético, a migração, cenários negativos (tenant, role, curso, classe, ano, vagas, motivo e evidências), sucesso com rollback e concorrência. O sucesso deste fixture **não substitui** E2E no Supabase de staging com as políticas e triggers reais.

Após aplicação, confirmou-se por consultas ao catálogo: ambas as RPCs instaladas, `anon` sem EXECUTE, `authenticated` com EXECUTE, triggers ativos em `matriculas`, `notas`, `exame_resultados`, `frequencias` (partições) e `frequencia_status_periodo`, sem trigger inválido na view `presencas`. O E2E HTTP autenticado, validação de pautas e cobrança com casos reais continuam pendentes; nenhuma matrícula real foi movida na homologação.

## Release gate AUT-003

1. Não executar `supabase db push`, `--include-all` nem `migration repair` indiscriminadamente neste projeto.
2. Classificar as 307/68 diferenças por versão e efeito, usando o snapshot e os relatórios de 30/10/2026. Preservar os SQL fiscais, sem ativá-los.
3. Homologar a nova migração num projeto efémero; comparar `pg_get_functiondef`, `pg_get_triggerdef`, `has_function_privilege` e comportamento real contra o plano.
4. **Executado em 04/11/2026 por solicitação explícita**: aplicada apenas a migração de transferência, sem branch Supabase, sem `db push` e sem replay do histórico divergente; aplicação concluída e versão reconciliada para `20271031003000`. A disponibilidade de backup/PITR não foi certificada nesta intervenção.
5. **Verificado**: 11/11 workflows no código testado, incluindo integração Postgres 16. A validação autenticada via Data API e observação de efeitos operacionais reais permanecem como gate de release da aplicação web.

## Próxima implementação obrigatória de AUT-001

**Transferência com notas não se resolve alterando apenas `matriculas.turma_id`.** Exige um modelo temporal imutável de turmas por matrícula, associação de notas/avaliações ao período e disciplina original, apresentação correcta de pautas históricas e atuais, e reconciliação da decisão final do RAA. Até existir este contrato e homologação, o caminho seguro é recusar a movimentação (código `P1050`) e mostrar uma ação contextual de resolução.

Status: **RPCs individual e em lote aplicadas no Supabase, integração isolada e catálogo pós-deploy aprovados; transferência com notas continua bloqueada, E2E HTTP autenticado e reconciliação global do ledger ainda pendentes. A PR segue draft e sem merge na main.**


## Auditoria complementar — 04/11/2026

**Descoberta crítica**: a RPC legada `public.transferir_matricula(uuid,uuid,uuid)` ainda era executável por `authenticated`. Esta RPC cria outra matrícula com o estado obsoleto `ativa`, deriva o ano com `LIMIT 1` e marca a origem como transferida, sem o contrato atómico das RPCs seguras. Não foi encontrado consumidor ativo no código pesquisado (apenas SQL de migração e tipos legados), mas a superfície de chamada direta permanecia exposta.

**Correção aplicada à base real, sem branch Supabase:** migração `20271031004000_disable_legacy_transferir_matricula.sql`. A execução removeu `EXECUTE` de `PUBLIC`, `anon` e `authenticated` somente da RPC legada. As RPCs `transferir_aluno_turma` e `transferir_turma_em_lote` continuam executáveis por `authenticated`, com autorização interna e bloqueio `P1050`. A entrada única de histórico remoto foi reconciliada de `20261104182632` para `20271031004000` sob validação de privilégios e do SQL aplicado. Nenhuma matrícula, nota, frequência ou cobrança foi alterada.

**Integridade dos dados verificada em leitura:** 949 notas; zero divergências entre turma da avaliação e turma da matrícula, zero divergências de escola; zero resultados de exames e zero linhas de `frequencia_status_periodo` na consulta. `supabase/ops/tests/aut001_003_transfer_integrity_readonly.sql` repete a verificação de forma somente-leitura e falha se encontrar divergências ou reexposição da RPC legada.

**AUT-002 continua NÃO encerrado**: transferir um aluno que já tenha notas exigiria histórico temporal de vínculos a turmas e consumidores de pautas/RAA/portais conscientes da origem. Sem esse contrato, as RPCs devem continuar a devolver `P1050` (sem atualização parcial). Não autorizar transferência com notas com base apenas na ausência de divergências no snapshot.

**AUT-003**: integração sintética PostgreSQL 16 previamente aprovada; auditoria de catálogo e integridade em produção aprovada em leitura. E2E autenticado em ambiente representativo continua obrigatório antes de certificar fluxos com evidência académica. A reconciliação global do ledger de migrações permanece independente.


## Reforço AUT-001/002/003 — evidências secundárias e pré-validação canónica

A migração aditiva `20271031005000_guard_secondary_academic_transfer_evidence.sql` protege evidências académicas historicamente omitidas pelo guard principal: `notas_avaliacoes` (legado), `lancamentos` académicos, `historico_anos`, `historico_snapshot_locks`, `reapreciacao_pedidos`, `raa_indisciplina_eventos`, `aluno_falta_justificacoes`, `pautas_oficiais`, `pautas_lote_itens`, `excecoes_pauta` e `presencas_deprecated`. Um vínculo académico ou uma pauta oficial da turma de origem impede a mudança com `P1050`, sem afetar a matrícula, a cobrança ou as notas.

**Condição de segurança:** `presencas` é uma *view* derivada da `matriculas.turma_id` atual. Ainda não há fonte temporal imutável capaz de provar a turma do aluno à data da aula/avaliação. Logo, **continuar a negar transferências com histórico e não tratar uma confirmação manual como conciliação**. O desenho de reconciliação definitiva exigirá histórico temporal de alocação, fonte de dados por semestre/trimestre e adaptação de pautas, RAA, aluno e professor.

- `turma_transfer_has_secondary_evidence_v1`: predicado comum (helper privado, sem `EXECUTE` para `authenticated` ou `anon`).
- `turma_transfer_academic_evidence_v1(uuid)`: pré-validação autenticada que confere `auth.uid()`, escola e papel em servidor; retorna **só booleanos** e nega consulta fora do tenant. Os endpoints do Balcão consomem este RPC em vez de presumirem ausência por consultas RLS incompletas.
- O trigger `trg_guard_turma_transfer_secondary_evidence` protege inclusive `UPDATE` direto; os escritores de evidências obtêm `FOR SHARE` na matrícula ou na turma antes de alterar notas, decisões ou artefactos. Uma inserção de pauta concorrente impede a transferência, sem escrita parcial.
- A rota de pré-validação foi corrigida para ler `public.turmas` com `session_id` e `ano_letivo_id` explícitos. A RPC individual foi corrigida para consumir a resposta UUID escalar sem `.single()`. As permissões de API estão alinhadas com as da própria RPC.

**Testes sintéticos:** o workflow `KLASSE Atomic Turma Transfer Integration` executa a migração duas vezes na base PostgreSQL 16 descartável, inclui 12 fontes de histórico, compara o RPC de pré-validação ao trigger, verifica isolamento por escola/papel e uma corrida entre publicação de pauta e transferência em lote. Os testes não usam registos de escolas reais e verificam matrícula, lotação e auditoria sem alterações após `P1050`.

**Release gate:** aplicar **apenas** a migração `20271031005000` no projeto Supabase depois de CI verde, consultar o catálogo/grants/triggers, comparar ledger e executar smoke *read-only*. Não fazer `db push` geral nem reexecutar migrações `03000`/`04000`. Não permitir o bypass com histórico até à homologação do contrato temporal.

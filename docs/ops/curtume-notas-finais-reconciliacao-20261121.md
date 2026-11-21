# Curtume · Reconciliação das notas finais 2025/2026 (21/11/2026)

**Natureza:** evidência read-only da base de produção; não constitui uma autorização para
repetir SQL, reabrir históricos, aplicar migrations ou assumir dados históricos como
notas trimestrais. A PR histórica #376 não é uma migração nova.

## Estado observado (fonte: SQL PostgreSQL e RPC já instalada)

| Métrica | Quantidade |
| --- | ---: |
| Notas finais documentais em `historico_disciplinas` (ano 2025) | 4.480 |
| Histórico com snapshot legalmente fechado | 4.298 |
| Notas já espelhadas em `notas` como `HIST_FINAL` | 3.834 |
| Pendências por ano divergente na pauta (sem regularização) | 464 |
| Notas com histórico ainda aberto | 182 |
| Registos ainda elegíveis para espelhamento imediato | **0** |
| Correções documentais específicas já confirmadas e espelhadas | 4 |

Fonte das seis últimas contagens funcionais: `public.curtume_2025_prever_espelhamento_notas(escola_id)` no Supabase (chamada de leitura). A soma das categorias é 4.480.

### Integridade dos 3.834 registos `HIST_FINAL`

Verificação de `notas` ↔ `avaliacoes` ↔ `historico_disciplinas` ↔
`historico_anos` ↔ `historico_snapshot_locks`:

- 0 fontes documentais inexistentes.
- 0 divergências de `escola_id` ou matrícula.
- 0 diferenças entre `notas.valor` e `historico_disciplinas.nota_final`.
- 0 avaliações com tipo, peso, trimestre técnico ou ano incorreto;
  `HIST_FINAL` é **nota final histórica**, jamais MAC/NPP/NPT/MT3.
- 0 históricos sem snapshot/lock de fecho válido.
- 0 referências documentais incoerentes nos metadados.
- 0 duplicações por `historico_disciplina_id`.

Esta inspeção não prova, por si só, que o documento físico é autêntico;
a conferência documental continua a ser decisão auditada da escola.

## Divergência de schema/migration — NÃO REAPLICAR #376

As sete versões `20271119110000`…`20271119110600` do ramo #376 não
constam em `supabase_migrations.schema_migrations`. Contudo, seis funções
canónicas do espelhamento **já existem na base**.

Comparação do `pg_proc.prosrc` instalado contra o último `CREATE OR
REPLACE FUNCTION` de cada função ao percorrer as sete migrations na ordem
proposta: **1 corpo coincide exatamente e 5 não coincidem**.

| Função instalada | Igual ao SQL final da #376? |
| --- | --- |
| `curtume_2025_pode_espelhar_nota` | Sim |
| `curtume_2025_mfd_mirror_valid` | **Não** |
| `curtume_2025_pode_criar_avaliacao_final` | **Não** |
| `curtume_2025_prever_espelhamento_notas` | **Não** |
| `curtume_2025_espelhar_notas_finais` | **Não** |
| `curtume_2025_espelhar_notas_finais_manutencao` | **Não** |

O delta corresponde a uma exceção documental posterior de **uma fonte
específica**, cuja origem foi confirmada para 2025/2026, apesar do
nome do ficheiro conter 2023/2024. A exceção exige correspondência
exata de histórico/matrícula/arquivo original, referência corrigida
e tipo de correção; não autoriza outras pautas divergentes.

As seis funções têm `SECURITY DEFINER` e `anon EXECUTE=false`.
A RPC interna de manutenção tem também `authenticated EXECUTE=false`.
As demais são executáveis por `authenticated` e exigem revisão
permanente de autorização de escola/papel e controlo de entradas.

**Consequência:** repetir o SQL antigo substituiria a exceção já conferida
por lógica antiga, com risco de divergência entre dados e funções.
Também não é correto inserir artificialmente versões no ledger sem uma
verificação reproduzível do corpo e das dependências.

## Recuperação funcional segura

A recuperação de interface deve limitar-se ao **GET** do preview
canónico já instalado, com `auth.getUser()`, resolução explícita da
escola solicitada, pertença e papel autorizado, `Cache-Control: no-store`
e sem `service_role`. Não expor uma ação de replay enquanto o catálogo de
funções e migrations não tiver sido reconciliado.

Os **464** casos de ano divergente e os **182** históricos abertos
devem permanecer na Reconciliação Histórica existente, exigindo
comprovação escolar e fecho auditado antes de passarem a elegíveis.
Não copiar as notas novamente e não abrir uma via paralela de dados.

## Gates restantes antes de encerrar a PR #376

1. Baseline Git correspondente aos seis corpos instalados, inclusive
   exceção documental posterior; diffs de ACL, dependências, triggers
   e decisões de `search_path` revisados.
2. Migrations reconciliadas com histórico verificável sem replay; testar
   aplicação idempotente em PostgreSQL 17 descartável.
3. Teste autenticado de papel e escola distintos com RLS real e
   locks/concorrência; `EXPLAIN ANALYZE`/WAL de lote antes de escritas.
4. Confirmar ciclo de conferência documental e reconsultar preview após
   regularizações; nenhuma atualização automática de 464 ou 182 casos.
5. Regressão dos percursos RAA e da imutabilidade dos históricos.

O GET de consulta é independente desses gates de escrita e pode ser
integrado separadamente. **Nenhuma DDL, nota ou matrícula foi alterada
durante esta auditoria.**

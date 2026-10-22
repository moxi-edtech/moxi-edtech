# Command Center — PR 4: desempenho, erros e evidência (22/10/2026)

> Esta PR está empilhada sobre #238 → #237 → #236 → #234. Nenhum merge, deploy ou migração de produção foi efectuado. Dados e contas dos testes são fictícios.

## Alterações

- A Classe deixa de descarregar até 3.000 matrículas em lotes de 500 para deduplicar e calcular contagens no Node. Uma RPC SECURITY INVOKER, com escola, ano letivo, classe e RLS, produz contagens por turma e apenas uma página de 20 alunos. Substitui os lotes no **mesmo pedido HTTP contextual**, sem adicionar fetches de UI.
- A migração nova é `20271022131500_command_center_class_roster_summary.sql`. Índice sobre `matriculas(escola_id,session_id,turma_id,status,ativo,aluno_id)`. Não se editou nenhuma migração anterior.
- Cinco rotas de contexto devolvem `X-Correlation-ID` para todos os estados e `code` + `requestId` nos erros, com logs que incluem apenas rota, código, estado HTTP e UUID novo. Sem termos, nomes, alunos, BI, processo, documentos ou quantias.
- Memória do histórico recente: seis resultados por contexto; máximo doze contextos; cache global de busca limitado a cinquenta entradas e retorno ao Balcão com expiração em dez minutos.
- Evidência de browser: componente **real** de Turma com intercepção de endpoints e **apenas fixtures**; cinco viewports × três escalas × nove estados. O “Balcão sintético” prova só o remontar da vista; **não** substitui E2E com o Balcão real e utilizadores autenticados.

## Orçamento de requisições — modelo reproduzível, não telemetria

```bash
node apps/web/scripts/performance/command-center-request-budget.mjs --enrollments=3000 --views=20 --searches=20
```

Exemplo matemático de cenário, **não resultado real**: 20 consultas de Classe com 3.000 matrículas e 20 pesquisas/hora = até 120 pedidos PostgREST de lotes de matrícula antes, versus 20 RPCs compactas + 20 pesquisas = 40 depois. Outras consultas existentes são comuns às duas versões. Não se infere daqui que qualquer carga real tenha reduzido; em pequenas classes e com pesquisas adicionais, o tráfego pode aumentar. **A meta “nenhum aumento de requisições/hora” ainda carece de medição real com dados anonimizados de Vercel/Supabase, sem expor PII.**

### PostgreSQL descartável e plano

```bash
# Ambiente local DESCARTÁVEL, sem URL de produção.
docker run --rm -d --name cc-pg-fixture -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:17
PGURL=postgresql://postgres:postgres@127.0.0.1:55432/postgres
psql "$PGURL" -v ON_ERROR_STOP=1 -f supabase/ops/tests/regression_command_center_class_roster_summary.sql
docker stop cc-pg-fixture
```

GitHub Actions `Command Center Performance and Observability` executa o mesmo SQL em PostgreSQL 17 descartável e anexa o EXPLAIN. Contém 55 estudantes de fixture, turma com capacidade 50 e uma segunda escola. Verifica paginação 20/20/15 e negação na RPC por outra escola. **As RLS neste teste são políticas de fixture**, não substituem a réplica estrutural fiel com todas as migrations ou sessões GoTrue verdadeiras.

### Medições exigidas antes do merge

| Métrica | Antes | Depois | Estado |
| --- | --- | --- | --- |
| Pedidos PostgREST de matrículas por leitura de Classe de 3.000 registos | Até 6 (lotes de 500) | 1 RPC | Derivado do código, confirmar em execução |
| Bytes da resposta da API para 55/3000 matrículas | Não medido | Não medido | Capturar via script autenticado em réplica |
| Latência p50/p95 da rota | Não medida | Não medida | Medir com dados sintéticos no mesmo ambiente |
| EXPLAIN ANALYZE/BUFFERS | Rota anterior sem plano guardado | Fixture CI | Não comparar fixture com produção |
| Solicitações por hora reais | Não medido | Não medido | Gate bloqueante (plano Supabase gratuito) |

Não publicar regressões como “optimizadas” apenas por mudar o código. As medições têm de ser comparáveis.

## Limites, riscos e decisões

- A leitura continua sujeita às RLS **existentes** e à guarda de papel na rota. Nenhuma operação de pagamento, fiscalidade, nota ou matrícula foi alterada.
- A RPC é dependência de migração gated. O frontend não poderá ser integrado ou promovido antes de aprovação da aplicação das migrations, sob pena de falha 500 controlada.
- O percurso de polos **não possui fonte de vinculação canónica comprovada** no modelo inspeccionado. A pesquisa por polo em PR #237 recusa, em vez de devolver informação de outros polos.
- A exportação segue desactivada por padrão e exige decisão de negócio expressa, autenticação, RLS e auditoria persistida.
- Revisões de acessibilidade com leitor de ecrã real, contraste AA automatizado e E2E autenticado com três atendimentos reais continuam pendentes; o artefacto Playwright apenas cobre a fixture.
- As cinco rotas não incluem o endpoint adicional de pesquisa de disciplinas; este tem tratamento próprio e deverá adoptar a mesma correlação antes da homologação completa.

## Gates estritamente humanos

1. Decidir papéis, finalidade, limites e retenção da exportação por escola.
2. Aprovar a estratégia de scoping de polos e as permissões RLS reais. Não alargar acesso para fazer o teste passar.
3. Após homologação, autorizar a migração versionada num pipeline separado. **Nenhuma aplicação nesta PR.**
4. Autorizar merge e deploy explicitamente, somente depois de testes reais e métricas.


## Actualização de acompanhamento (22/10/2026)

O **backlog oficial de aceite do Command Center** está em
[estado e backlog das PRs #234–#239](../command-center/estado-backlog-20261022.md).
Este documento de desempenho permanece como evidência técnica da PR #239, **não** como declaração de produto concluído.

- Na revisão, a PR #239 em `26b3c4b` apresentou **12/12 workflows aprovados**; a suite visual com fixture entregou as capturas em cinco resoluções e três escalas. Ver [workflow visual](https://github.com/moxi-edtech/moxi-edtech/actions/runs/39812303330) e [SQL de fixture](https://github.com/moxi-edtech/moxi-edtech/actions/runs/39812302860). Novos commits exclusivamente documentais exigem conferência posterior de HEAD/checks.
- A PR #236 apresentou **6/7 checks aprovados**, mas [replay histórico falhou](https://github.com/moxi-edtech/moxi-edtech/actions/runs/39811867508) em `20260202011000_backfill_pagamentos_aluno_id.sql` (coluna `pagamentos.aluno_id` inexistente naquele ponto). Não se concluiu a validação da sequência integral com RLS real.
- Os indicadores de tempo/bytes medidos em PostgreSQL de **fixture** são evidência local; o orçamento de requisições/hora continua um **modelo**, sem equivalência com telemetria autenticada de Supabase/Next.js.
- **Bloqueios críticos antes de integração:** restaurar a baseline fiel e executar replay; Auth/E2E/RLS com 3 atendimentos, 2 escolas, 2 polos, perfis e sessão expirada; reconciliar branches empilhadas; medir carga real comparável; resolver decisões de filtros/exportação.
- Nenhuma destas validações autoriza por si só `supabase db push`, `supabase migration up`, merge ou deploy.


# P0.3 — Rotas obrigatórias para Materialized Views

## Regra de decisão

Uma rota **deve** virar MV se responder **SIM** a 2 ou mais critérios:

| Critério | Sim/Não |
| --- | --- |
| É chamada em dashboard | ✅ |
| Usa COUNT / SUM / GROUP BY | ✅ |
| Lê muitas linhas | ✅ |
| Não precisa de dado em tempo real | ✅ |
| É igual para todos usuários do papel | ✅ |
| Pode atrasar 1–5 min | ✅ |

## Rotas que já devem ser MV (P0.3)

### Financeiro (prioridade máxima)

- `/financeiro/radar` — agregado + dashboard
- `/financeiro/sidebar-badges` — renderiza sempre
- `/financeiro/aberto-por-mes` — série temporal
- `/financeiro/cobrancas/resumo` — KPI
- `/financeiro/graficos/mensal` — chart
- `/financeiro/relatorios/propinas` — relatório pesado

### Secretaria / Admin

- `/secretaria/dashboard/*` — KPI
- `/secretaria/turmas/ocupacao` — COUNT
- `/secretaria/matriculas/preview-numero` — derivado
- `/admin/dashboard/pending-turmas-count` — badge
- `/admin/insights/quick` — snapshot

### Escola (nível macro)

- `/escolas/[id]/insights/quick` — visão geral
- `/escolas/[id]/cursos/stats` — estatísticas
- `/escolas/[id]/plano` — não muda sempre
- `/escolas/[id]/nome` — lookup simples

## Padrão oficial de implementação

1. MV (pesada)

```sql
CREATE MATERIALIZED VIEW mv_secretaria_dashboard_counts AS
SELECT escola_id,
       COUNT(*) FILTER (WHERE status = 'pendente') AS pendentes,
       COUNT(*) FILTER (WHERE status = 'ativa') AS ativas
FROM turmas
GROUP BY escola_id;
```

2. Índice obrigatório

```sql
CREATE UNIQUE INDEX ux_mv_secretaria_dashboard_counts
ON mv_secretaria_dashboard_counts (escola_id);
```

3. View wrapper (RLS-friendly)

```sql
CREATE OR REPLACE VIEW vw_secretaria_dashboard_counts AS
SELECT *
FROM mv_secretaria_dashboard_counts;
```

4. Refresh controlado

```sql
SELECT cron.schedule(
  'refresh_mv_secretaria_dashboard_counts',
  '*/5 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_secretaria_dashboard_counts$$
);
```

## Regra de ouro

UI nunca fala com tabela bruta para dashboard.
UI só fala com VIEW.
VIEW aponta para MV.

## Nunca vai para MV

- criação de matrícula
- gerar pagamento
- aprovar turma
- liberar acesso
- qualquer POST / PUT / DELETE
- qualquer dado que precisa ser correto no segundo

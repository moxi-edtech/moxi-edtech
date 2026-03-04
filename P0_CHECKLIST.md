# P0 — Checklist Pedagógico

## Documentação
- [x] Fluxo Pedagógico documentado (UI → API → DB)
- [x] Owners definidos por tela/endpoint
- [x] SLAs de performance por tela (p95)
  - Dashboards <200ms (MV)
  - Grids/pauta <300ms com skeleton
  - Mutations feedback <50ms

## Dados e Segurança
- [x] Origem de disciplinas padronizada (tdp → td → curso_matriz)
- [x] RLS documentada ou service role explicitado nos endpoints críticos
- [x] Auditoria mínima aplicada quando houver mutação

## Qualidade Operacional
- [x] Turmas sem disciplinas tratadas
- [x] Disciplinas sem professor tratadas
- [x] Syllabus ausente tratado

## Performance
- [x] Nada de cálculo ao vivo em dashboard (usar derivados/MVs)
- [x] Listagens p95 ≤ 500 ms
- [x] Busca global p95 ≤ 300 ms

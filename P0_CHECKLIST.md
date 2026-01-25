# P0 — Checklist Pedagógico

## Documentação
- [ ] Fluxo Pedagógico documentado (UI → API → DB)
- [ ] Owners definidos por tela/endpoint
- [ ] SLAs de performance por tela (p95)
  - Dashboards <200ms (MV)
  - Grids/pauta <300ms com skeleton
  - Mutations feedback <50ms

## Dados e Segurança
- [ ] Origem de disciplinas padronizada (tdp → td → curso_matriz)
- [ ] RLS documentada ou service role explicitado nos endpoints críticos
- [ ] Auditoria mínima aplicada quando houver mutação

## Qualidade Operacional
- [ ] Turmas sem disciplinas tratadas
- [ ] Disciplinas sem professor tratadas
- [ ] Syllabus ausente tratado

## Performance
- [ ] Nada de cálculo ao vivo em dashboard (usar derivados/MVs)
- [ ] Listagens p95 ≤ 500 ms
- [ ] Busca global p95 ≤ 300 ms

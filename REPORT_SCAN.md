# REPORT_SCAN.md

## Análise de Fundação e Features (SCAN)

Este relatório documenta a validação da base de código do KLASSE em relação às prioridades definidas em `FEATURES_PRIORITY.json`.

---

## P0: Fundação Obrigatória

### GF1: PWA Offline-First
- **Status:** PARCIAL
- **Evidências:**
  - `apps/web/src/components/system/ServiceWorkerRegister.tsx`: Componente que registra o Service Worker.
  - `apps/web/public/sw.js`: Implementação do Service Worker.
  - **Estratégia de Cache:** "Stale-while-revalidate" para recursos estáticos e navegações.
  - **Offline Fallback:** Sim, para navegação, com retorno para `/offline.html`.
- **Alertas:**
  - **AUSENTE:** Nenhuma evidência de "Sync seguro quando online". O Service Worker é read-only (só cacheia GETs). Operações de escrita (POST, PUT, DELETE) feitas offline não são sincronizadas quando a conexão é restaurada. Isso é um requisito crítico da feature.

### GF4: Audit Trail Forense
- **Status:** IMPLEMENTADO
- **Evidências:**
  - `supabase/migrations/*_audit_*.sql`: Múltiplas migrations configuram a fundação de auditoria.
  - **Tabela Imutável:** A tabela `public.audit_logs` tem `DELETE` e `UPDATE` revogados para o role `authenticated`, garantindo a imutabilidade dos logs.
  - **Captura Completa:** A função de trigger `audit_dml_trigger` captura:
    - **Ação:** `CREATE`, `UPDATE`, `DELETE`.
    - **Ator:** `user_id` e `role`.
    - **Contexto:** Endereço de IP (`x-forwarded-for`) e User Agent.
    - **Estado:** `before` e `after` da operação são salvos como `jsonb`.
  - **Cobertura:** Triggers estão aplicados em tabelas críticas como `cursos`, `turmas`, `matriculas`, e múltiplas tabelas financeiras.
- **Alertas:**
  - Nenhum alerta crítico. A implementação parece robusta e completa.

### PERF_BASE: Base de Performance
- **Status:** PARCIAL
- **Evidências:**
  - **`pg_trgm` e `GIN` indexes:** `IMPLEMENTADO`. Migrations confirmam a criação da extensão `pg_trgm` e o uso de índices GIN/TRGM para busca em texto em tabelas como `alunos` e `cursos`, e para o JSONB de `audit_logs`.
  - **`Debounce frontend`:** `IMPLEMENTADO`. Um hook `useDebounce` customizado existe e é usado corretamente no `useGlobalSearch` para evitar buscas excessivas.
  - **`Virtualização de listas`:** `IMPLEMENTADO`. A biblioteca `@tanstack/react-virtual` está instalada e é usada para virtualizar listas de dados pesados como `Alunos`, `Matriculas` e `Turmas`.
  - **`Bundle split`:** `IMPLEMENTADO`. O uso de `next/dynamic` é confirmado para componentes pesados como gráficos (`react-chartjs-2`), adiando o carregamento de bibliotecas grandes.
- **Alertas:**
  - **`LIMIT + paginação`:** A implementação é **PARCIAL** e **INCONSISTENTE**.
    - **PONTO FRACO:** Várias rotas de API que listam dados não usam paginação (`.range()`), em vez disso usam um `.limit()` com valor fixo e alto (ex: 200, 500, 5000).
    - **RISCO:** Rotas de exportação carregam milhares de registros diretamente na memória, criando um risco de performance e timeout.
    - **PONTO FORTE:** Paginação server-side (`.range()`) está implementada corretamente para algumas das entidades mais críticas (`alunos`, `matriculas`, `professores`), mostrando que o padrão existe mas não foi aplicado globalmente.

---

## P1: Diferenciais Ativos e UX de Velocidade

### KF2: Pesquisa Global (Command Palette)
- **Status:** IMPLEMENTADO_E_VALIDADO
- **Evidências:**
  - **Frontend:**
    - `components/GlobalSearch.tsx`: Componente de UI da pesquisa.
    - `hooks/useGlobalSearch.ts`: Lógica do frontend, que inclui **debounce** de 300ms para as queries.
  - **Backend (RPC):**
    - A busca é delegada para a função PostgreSQL `search_alunos_global_min`.
    - A query no frontend tem um `limit(8)` explícito, prevenindo sobrecarga.
  - **Database Function (`search_alunos_global_min`):**
    - A função utiliza uma combinação de `ts_vector` (Full-Text Search) e `similarity` (`pg_trgm`).
    - As buscas são feitas em colunas com índices GIN/TRGM, garantindo alta performance.
    - O ranking de resultados é feito por um `score` que combina os dois métodos.
- **Alertas:**
  - Nenhum. A implementação é um exemplo a ser seguido: segura, performante e bem estruturada.

### F09: Radar de Inadimplência
- **Status:** IMPLEMENTADO_E_VALIDADO
- **Evidências:**
  - **Materialized View:** A view `public.mv_radar_inadimplencia` é criada na migration `20260109_000001_mv_financeiro_dashboards.sql`.
  - **Performance:**
    - A MV faz a agregação pesada de dados de mensalidades e status dos alunos.
    - Possui um **UNIQUE INDEX** (`ux_mv_radar_inadimplencia`), permitindo o `REFRESH CONCURRENTLY`.
    - Uma função `refresh_mv_radar_inadimplencia()` foi criada para agendamento.
  - **Abstração:** Uma view `vw_radar_inadimplencia` atua como um wrapper sobre a MV, aplicando o filtro de tenant. O código da aplicação interage com esta view, e não diretamente com a MV.
- **Alertas:**
  - Nenhum. Implementação segue as melhores práticas para MVs.

### F18: Relatório de Caixa/Propinas
- **Status:** IMPLEMENTADO_E_VALIDADO
- **Evidências:**
  - **Materialized View:** A view `public.mv_pagamentos_status` é criada na migration `20260109_000001_mv_financeiro_dashboards.sql` para agregar os status de pagamentos.
  - **Performance:**
    - Possui um **UNIQUE INDEX** (`ux_mv_pagamentos_status`) para `REFRESH CONCURRENTLY`.
    - Uma função `refresh_mv_pagamentos_status()` foi criada para agendamento.
  - **Abstração:** Uma view wrapper `pagamentos_status` é usada pela aplicação para acessar os dados da MV com o filtro de tenant correto.
- **Alertas:**
  - Nenhum. A implementação é robusta.

---
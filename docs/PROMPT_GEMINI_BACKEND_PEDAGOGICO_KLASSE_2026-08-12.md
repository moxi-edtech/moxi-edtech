# Handoff para Gemini — Backend pedagógico KLASSE

O backend foi preparado para a próxima camada de experiência. Implementa a UI e os workers sobre estes contratos; não inventes tabelas paralelas.

## Migração

`supabase/migrations/20270812160000_learning_activities_backend.sql`
`supabase/migrations/20270812170000_learning_platform_contracts.sql`
`supabase/migrations/20260812130000_guardian_learning_visibility.sql`

Estas migrações já foram aplicadas no PostgreSQL remoto e registadas no
histórico do Supabase. Não recriar tabelas, políticas ou contratos paralelos.

## Contratos disponíveis

### IA pedagógica e fontes MED

- `fontes_pedagogicas`: fontes versionadas, com `tipo = programa_med | material_professor`, classe, disciplina, ano letivo e estado de publicação.
- `pedagogical_ai_requests`: pedidos de geração sempre iniciados em `aguarda_revisao`.
- `GET/POST /api/professor/pedagogia/ai-requests`

O endpoint regista o pedido e valida as fontes publicadas. Ele ainda não gera texto por si só. A geração deve ser implementada num worker/serviço seguro, gravando `resultado_rascunho`; nunca publicar automaticamente.

### Radar e intervenções

- `intervencoes_pedagogicas`: fila auditável para `enviar_alerta`, `atribuir_ficha`, `contactar_familia` e `acompanhar_aluno`.
- `GET/POST /api/professor/pedagogia/interventions`

Criar UI de fila e acções. A acção de envio deve exigir confirmação humana e usar o canal oficial de comunicação.

### Badges

- `conquistas_catalogo`
- `aluno_conquistas`
- `GET /api/aluno/pedagogia/badges`

O motor de regras ainda precisa de ser criado. Não atribuir badges apenas no frontend.

### Diário familiar

- `diario_familiar_entries`
- `POST /api/professor/pedagogia/diario`
- `GET /api/aluno/pedagogia/diario`

Elogios e observações devem aparecer na timeline familiar sem expor dados financeiros ou notas indevidas.

O acesso do encarregado usa os vínculos `encarregados → aluno_encarregados →
alunos`, limitado por escola e email autenticado. O professor só pode publicar
para alunos matriculados numa turma atribuída ao seu perfil.

## Capacidades já existentes a reutilizar

- Fila offline e idempotência para notas/presenças: `apps/web/src/lib/offline` e `idempotency_keys`.
- Risco pedagógico: `mv_risco_pedagogico_aluno`, `vw_risco_pedagogico_aluno` e `ai_insights`.
- Simulador actual: `SimuladorNotasModal`; ainda precisa de RPC oficial para deixar de depender apenas do frontend.
- Actividades contínuas: APIs em `/api/professor/atividades` e `/api/aluno/atividades`.

## Regras obrigatórias

- Toda rota humana deve resolver `escola_id` e validar papel.
- Toda query deve estar limitada à escola.
- O ano letivo deve vir do contexto académico, nunca de inferência do frontend.
- IA só cria rascunhos; revisão humana é obrigatória antes de publicar.
- Não alterar notas oficiais, pautas, frequência ou status académico automaticamente.
- O aluno/encarregado só pode ver conquistas e diário dos alunos autorizados pelo vínculo escolar.
- Entregas offline precisam de idempotency key, retry, conflito explícito e feedback de sincronização.
- Toda falha deve apresentar `next_action` executável.
- Preferir modais/drawers para manter o contexto de navegação.

## Próximas implementações do Gemini

1. Worker de geração pedagógica que leia `fontes_pedagogicas` e grave `resultado_rascunho` com evidências das fontes.
2. RPC oficial do simulador usando o modelo de avaliação da escola.
3. Motor de badges baseado em eventos oficiais de presença e actividades corrigidas.
4. Dashboard de risco com intervenção e confirmação humana.
5. UI do diário familiar para professor e encarregado.
6. Reconciliação offline específica do `GradeEntryGrid`.

## Estado de implementação

Já implementado:

- contratos SQL e RLS aplicados;
- contexto multi-aluno para encarregados;
- autorização pedagógica do diário por turma atribuída;
- activity feed administrativo com prioridade, acção e Realtime.

Ainda pendente:

- worker que preenche `resultado_rascunho`;
- motor idempotente de badges;
- RPC oficial do simulador;
- reconciliação offline com conflitos apresentados ao utilizador.

## Validação obrigatória

```bash
pnpm -C apps/web typecheck
git diff --check
```

Testar 401/403/200, isolamento entre escolas, aluno de outra turma, fonte não publicada, geração sem aprovação, retry offline, conflito de idempotência e diário de outro aluno.

Não declarar a funcionalidade concluída apenas porque a página renderiza. A validação posterior confrontará banco, RLS, API, workers e fluxo ponta a ponta.

# Estado — Aprendizagem contínua e comunicação operacional

**Data:** 2026-08-12  
**Escopo:** portal do professor, portal do aluno/encarregado e `admin_financeiro`

## Migrações aplicadas

| Migração | Resultado |
|---|---|
| `20260812130000_guardian_learning_visibility` | Aplicada |
| `20270812150000_enable_admin_activity_realtime` | Aplicada |
| `20270812160000_learning_activities_backend` | Aplicada |
| `20270812170000_learning_platform_contracts` | Aplicada |

Verificações no banco remoto:

- 11 tabelas do fluxo presentes;
- 2 políticas RLS específicas para encarregados presentes;
- quatro versões registadas em `supabase_migrations.schema_migrations`;
- `admin_activity_events` publicado no canal `supabase_realtime`.

## Fluxos actualmente suportados

### Professor

- criar materiais e actividades;
- guardar rascunhos;
- publicar por turma;
- configurar questões, prazo, tentativas e nota máxima;
- acompanhar entregas;
- publicar elogio/observação no diário apenas para aluno das suas turmas.

### Aluno e encarregado

- consultar actividades publicadas;
- guardar e retomar entrega;
- submeter tentativa;
- consultar diário e conquistas dos alunos autorizados pelo vínculo escolar.

### Administração/financeiro

- receber eventos operacionais com prioridade;
- receber acção e URL contextual;
- acompanhar eventos em tempo real via Realtime, com fallback HTTP existente.

## Pendências honestas

Estas capacidades ainda não devem ser apresentadas como prontas:

1. Geração de provas pelo programa MED: o pedido é registado como rascunho, mas falta o worker de geração.
2. Badges automáticos: existem catálogo e consulta, mas falta o motor de atribuição por eventos oficiais.
3. Simulador de notas oficial: o componente ainda contém regras locais e precisa de RPC parametrizado pelo modelo da escola.
4. Offline-first completo: há fila e retry, mas falta reconciliação de conflitos e confirmação agregada de sincronização.
5. Radar pedagógico automático: recomendações existem, mas a criação de intervenção continua dependente de confirmação humana.

## Regra de comunicação

O produto pode ser apresentado como base integrada de actividades contínuas,
materiais, entregas, diário familiar e fila operacional. Não deve ser apresentado
como NotebookLM pedagógico completo, plataforma adaptativa ou motor automático de
avaliação até as pendências acima serem fechadas e validadas ponta a ponta.

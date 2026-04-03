# CHANGELOG - POP Admin da Escola

## 2026-04-03 - v1.10.0

### Alterado
- `p0-turmas-curriculo.md` atualizado com:
  - install-preset preferencialmente transacional via RPC `curriculo_install_orchestrated`
  - ajuste de erro operacional para `step=orchestrator`
  - alinhamento com rollback total (sem `partial_failed` no caminho principal)

## 2026-04-03 - v1.9.0

### Alterado
- `p0-turmas-curriculo.md` atualizado com:
  - `sync_mode` (`additive|reconcile`) e confirmação de reconcile no publish
  - tratamento operacional de `partial_failed` no install-preset

## 2026-04-03 - v1.8.0

### Alterado
- `p1-professores-atribuicoes.md` atualizado com guardrail diario de consistencia docente.
- `matriz-sop-rota-endpoint.md` atualizado com o endpoint:
  - `/api/escola/{id}/admin/academico/consistencia-professores`

## 2026-04-03 - v1.7.0

### Alterado
- `p3-operacoes-academicas-monitor.md` atualizado com checklist operacional dos endpoints criticos.
- Referencia tecnica atualizada com os novos eventos operacionais emitidos no backend:
  - `academico.horario_quadro_post`
  - `academico.professor_create`
  - `academico.atribuir_professor_turma`

## 2026-04-03 - v1.6.0

### Adicionado
- Novo SOP P1:
- `p1-professores-atribuicoes.md`

### Alterado
- `index.md` atualizado com o SOP de professores.
- `matriz-sop-rota-endpoint.md` atualizado com rastreabilidade de professores/atribuicoes.
- `p0-turmas-curriculo.md` aprofundado com tratamento de cursos e efeito domino operacional.

## 2026-04-03 - v1.5.0

### Adicionado
- Novo SOP P0:
- `p0-avaliacao-quadro-horario.md`

### Alterado
- `index.md` atualizado para incluir o novo SOP P0 e nova ordem de leitura.
- `matriz-sop-rota-endpoint.md` atualizado com rotas/endpoints/fonte de codigo de avaliacao + horarios.

## 2026-04-03 - v1.4.0

### Adicionado
- Pacote de governanca:
- `controle-revisoes.md`
- `matriz-sop-rota-endpoint.md`
- Inclusao de referencias de governanca no `index.md`.

### Mantido (sem alteracao de conteudo)
- Baseline:
- `_template-pop.md`
- `_glossario.md`
- `_rbac-operacional.md`
- SOPs P0:
- `p0-dashboard-admin.md`
- `p0-alunos-admin.md`
- `p0-turmas-curriculo.md`
- SOPs P1:
- `p1-setup-configuracoes.md`
- `p1-fechamento-periodo-pauta-oficial.md`
- SOPs P2:
- `p2-configuracoes-financeiras.md`
- `p2-mensalidades-emolumentos.md`
- `p2-relatorios-auditoria-admin.md`
- SOPs P3:
- `p3-funcionarios-acessos.md`
- `p3-migracao-matriculas-em-massa.md`
- `p3-documentos-oficiais-lote.md`
- `p3-operacoes-academicas-monitor.md`

## 2026-04-03 - v1.3.0

### Adicionado
- SOPs P3:
- `p3-funcionarios-acessos.md`
- `p3-migracao-matriculas-em-massa.md`
- `p3-documentos-oficiais-lote.md`
- `p3-operacoes-academicas-monitor.md`

### Alterado
- `index.md` atualizado para incluir P3 e ordem 1..13.

## 2026-04-03 - v1.2.0

### Adicionado
- SOPs P2:
- `p2-configuracoes-financeiras.md`
- `p2-mensalidades-emolumentos.md`
- `p2-relatorios-auditoria-admin.md`

### Alterado
- `index.md` atualizado para incluir P2.

## 2026-04-03 - v1.1.0

### Adicionado
- Baseline inicial:
- `_template-pop.md`
- `_glossario.md`
- `_rbac-operacional.md`
- SOPs P0 e P1 iniciais.

### Alterado
- `index.md` inicial do pacote.

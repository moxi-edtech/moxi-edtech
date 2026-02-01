# Roadmap — Implementação com Dados Reais (Admin Setup)

## Objetivo
Evoluir os wireframes da "Dona Maria" para operações reais (SSOT), conectando UI → API → RPC/DB com validações P0 e idempotência.

## O que já foi entregue
- Dashboard conceitual e navegação de configuração (`SettingsHub`, `StructureMarketplace`).
- Páginas conceituais do setup admin (`/admin/configuracoes/*`).
- RPCs SSOT (`get_setup_state`, `get_config_impact`, `preview_apply_changes`, `config_commit`) com base.
- Modelo de avaliação e disciplina com schema/RPCs e bloqueio de currículo publicado.
- Idempotência em gerar turmas (`Idempotency-Key` + audit).
- Conexões iniciais com dados reais nas páginas conceituais (setup, calendário, avaliação, turmas, fluxos e sandbox).
- Novas rotas API para setup real: `setup/state`, `setup/impact`, `setup/preview`, `periodos-letivos`, `audit/recent`.

## Plano de Implementação (Dados Reais)

### Fase 1 — Dashboard e Barra de Impacto
**Meta:** sair do placeholder e usar `get_setup_state` + `get_config_impact`.
- [x] Chamar `get_setup_state` na página `sistema` e mostrar blockers.
- [x] Integrar `SettingsHub` ao `get_setup_state` com badges reais.
- [x] Barra de status usa `get_config_impact`.
- [x] CTA “Próximo passo” usa `next_action` do RPC.

### Fase 2 — Calendário (Períodos Letivos)
**Meta:** leitura/escrita real em `periodos_letivos`.
- [x] Listar períodos reais com `peso` e `trava_notas_em`.
- [x] Validar overlap/pesos = 100 (via `get_setup_state`).
- [x] Persistir via `/admin/periodos-letivos/upsert-bulk`.

### Fase 3 — Avaliação (Modelos)
**Meta:** usar `modelos_avaliacao` real.
- [x] Listar modelos reais e fórmula padrão na página de avaliação.
- [x] CRUD completo dos modelos com UI visual (sem JSON).
- [ ] Preview de pauta (simulado) com dados reais do modelo.
- [x] Vincular disciplina ao `modelo_avaliacao_id`.

### Fase 4 — Currículo e Turmas
**Meta:** garantir currículo publicado + geração de turmas atômica.
- [x] Impacto real de turmas via `get_config_impact`.
- [x] Exibir status de currículo (draft/published) por curso.
- [x] Botão “Publicar currículo” usando `curriculo_publish`.
- [x] Gerar turmas via `gerar_turmas_from_curriculo` (idempotente).

### Fase 5 — Fluxos e Sandbox
**Meta:** sandbox real usando `preview_apply_changes`.
- [x] Testar configurações sem tocar dados reais (`preview_apply_changes`).
- [x] Audit status real em Fluxos (`audit_logs`).
- [x] Simular relatório (conflitos/impacto) completo.
- [x] Export/Apply com `config_commit`.

## Pendências / Backlog
- **RLS + Endpoints:** revisar rotas ainda usando `service_role`.
- **Padrão Idempotency-Key:** aplicar em todas ações críticas.
- **Controle de permissões por role:** alinhar com regras de admin/secretaria.
- **Paginação global:** listas grandes de disciplinas/turmas/alunos.
- **Auditoria:** garantir `audit_logs` com `escola_id` em toda ação crítica.

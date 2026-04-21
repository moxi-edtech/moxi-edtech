# Changelog

Todas as mudanças notáveis neste repositório serão documentadas aqui.

## 2026-04-11 - Ecossistema de Vendas e Admissões (Formação)

### Adicionado
- **Funil de Vendas Web**: Landing Page dinâmica (`/[slug]`) adaptável por Centro de Formação.
- **Checkout Inteligente**: Modal de matrícula em 2 passos com upload de comprovativo/talão.
- **Inbox Operacional**: Dashboard da secretaria para aprovação de inscrições via **React Server Actions**.
- **Motor de Navegação**: Sistema centralizado de menu com filtragem por **TenantType** e **RBAC**.
- **Lançamento de Mentoria**: Formulário **100% Mobile-First** para criação atómica de cursos e turmas por Solo Creators.
- **Link Mágico Corporativo**: Arquitetura de patrocínio B2B com bypass de pagamento e controlo de quotas.
- **Automação de Matrícula**: Postgres Trigger para promoção automática de alunos (Staging -> Oficial).
- **Portal do Formando Premium**: Dashboard com acesso rápido, gamificação de progresso e envio direto de talões de pagamento (Self-Service).
- **Dashboard do Mentor**: Área dedicada para o formador gerir a sua agenda de turmas e registar honorários via telemóvel.
- **Identidade Digital**: Geração automática de credenciais e e-mails via Resend.
- **Documentos**: Emissão de Comprovativos de Inscrição em PDF.
- **Marketing**: Partilha rápida via WhatsApp e Copiar Link no catálogo.

### Melhorado
- **Polimento UI/UX**: Interfaces recalibradas para fluxos operacionais específicos (Mobile para Mentores, Desktop para Secretaria).
- **Conversão B2C**: Adicionados gatilhos de escassez e badges de lotação na Landing Page.
- **Micro-copy Dinâmico**: Adaptação de nomes de menus conforme o perfil (ex: "Mentorias" para Solo Creators).
- **Design Adaptativo**: Dashboard Admin focada em Mobile; Inbox focada em Desktop/Tablet.
- **Dashboards Reais**: Métricas reais de faturamento e inscritos integradas ao Supabase.
- **Segurança**: Validação de inputs com Zod e isolamento de tenants via RLS.

## 2026-03-03

- Secretaria / Compatibilidade de API:

- Documentos oficiais (decisão de produto):
  - **Substituição oficial**: `declaracao_notas` passa a ser `boletim_trimestral` no catálogo público (não coexistência como tipo ativo para novas emissões).
  - Mapeamento revisado de rotas/templates:
    - emissão central: `POST /api/secretaria/documentos/emitir` aceita `boletim_trimestral`
    - impressão: `/secretaria/documentos/[docId]/boletim-trimestral/print` (rota `/notas/print` mantida apenas como compat proxy)
    - batch: `tipo=boletim_trimestral` no ciclo de vida de lote oficial
  - Padronização de labels/metadados: UI e payloads passam a usar “Boletim Trimestral” de forma explícita.
  - Compatibilidade histórica: migration converte documentos antigos `declaracao_notas` para `boletim_trimestral` com marcação `legacy_tipo_documento`.
  - `GET /api/secretaria/matriculas/[matriculaId]/declaracao` deixou de responder `501` e passou a operar em **compat layer temporária** com proxy interno para o endpoint canônico `POST /api/secretaria/documentos/emitir` (tipo `declaracao_frequencia`).
  - O endpoint legado agora retorna payload e cabeçalhos de depreciação (`deprecated`, `sunset_date`, `replacement_endpoint`, `Deprecation`, `Sunset`, `Link`, `Warning`) para orientar a migração de clientes.
  - Uso do endpoint legado passa a ser auditado por escola via `audit_logs` (ação `LEGACY_ENDPOINT_USED`) para apoiar o plano de desligamento.

### Cronograma técnico de remoção (endpoint legado de declaração por matrícula)

- **Fase 1 — Atual (iniciada em 2026-03-03):** endpoint legado ativo com compat layer e aviso de depreciação.
- **Fase 2 — Comunicação e migração (até 2026-09-30):** todos os consumidores devem migrar para `POST /api/secretaria/documentos/emitir`.
- **Fase 3 — Congelamento (2026-10-01 a 2027-03-30):** sem novas integrações no endpoint legado; monitoramento via auditoria.
- **Fase 4 — Sunset/remoção (a partir de 2027-03-31):** endpoint legado elegível para remoção definitiva.

## 2025-11-23

Principais alterações já mescladas no branch `main`:

- API/Backend (Next.js routes):
  - Escola Admin: alunos (listar, detalhes, arquivar/restaurar), professores, turmas, notas.
  - Secretaria: alunos (CRUD e restore/hard-delete), turmas (atribuir professor, disciplinas), rematrícula (confirmar/sugestões).
  - Professor: presenças, notas, atribuições.
  - Financeiro: dashboards e aberto por mês.

- Frontend (páginas):
  - Painéis de Escola Admin (alunos, professores, turmas, notas).
  - Portal do Professor (layout, frequências, notas).
  - Portal da Secretaria (detalhe/edição de aluno, matrículas melhorias).

- Banco (Supabase):
  - Várias migrações para relacionamentos, RLS, gatilhos de sincronização e normalização de status (alunos/matrículas), índices e views financeiras/acadêmicas.

- Infra/Dev:
  - Adição de `docker-compose.yml`, `Dockerfile` do app web e scripts utilitários (dump/restore/pull do banco).
  - Documentação: sincronização de alunos e instruções de `supabase remote pull`.
  - `.gitignore`: ignorado `.pnpm-store/` para evitar arquivos grandes no repositório.
  - Removido `package-lock.json` em favor de `pnpm`.

Observação: as mudanças acima já foram aplicadas diretamente em `main`. Se desejarmos revisão via PR para documentação/ajustes futuros, podemos abrir PRs incrementais.


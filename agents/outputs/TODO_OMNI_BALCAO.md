# TODO — Omni-Balcão (SSOT Atendimento Secretaria)

## Escopo confirmado (existente)
- `apps/web/src/app/secretaria/(portal-secretaria)/Dashboard.tsx`
- `apps/web/src/app/secretaria/(portal-secretaria)/DashboardSkeleton.tsx`
- `apps/web/src/app/secretaria/balcao/page.tsx`
- `apps/web/src/lib/sidebarNav.ts`
- `apps/web/src/components/secretaria/BalcaoAtendimento.tsx`
- `apps/web/src/components/secretaria/BuscaBalcaoRapido.tsx`
- `apps/web/src/components/secretaria/FilaAtendimentoModal.tsx`
- `apps/web/src/components/secretaria/PagamentoModal.tsx`
- `apps/web/src/components/secretaria/ModalPagamentoRapido.tsx`
- `apps/web/src/components/secretaria/AcoesRapidasBalcao.tsx`

## Objetivo
Consolidar todo atendimento na Dashboard da Secretaria (SSOT), eliminando fluxos paralelos de cobrança/documentos e mantendo o “Balcão” como componente canônico dentro do dashboard.

## TODO (sem inventar nada novo)
### 1) Depreciação e limpeza
- [ ] `sidebarNav.ts`: remover item “Balcão de Atendimento” ou redirecionar para `/escola/[escolaId]/secretaria`.
- [ ] `Dashboard.tsx` + `DashboardSkeleton.tsx`: remover cards duplicados de “Cobrar Propina”/fluxos isolados.
- [ ] `app/secretaria/balcao/page.tsx`: trocar por redirect server-side para a dashboard (ou manter mas renderizar o mesmo widget canônico da dashboard).

### 2) Widget canônico na Dashboard (reaproveitar o que existe)
- [ ] Criar `BalcaoAtendimentoWidget` como composição do `BalcaoAtendimento.tsx` (ou extrair a UI principal para um componente reaproveitável dentro do dashboard).
- [ ] Reusar a busca já existente:
  - `BalcaoAtendimento.tsx` (busca com debounce 400ms via `/api/secretaria/balcao/alunos/search`).
  - `BuscaBalcaoRapido.tsx` (busca com debounce 300ms via `/api/secretaria/alunos`).
  - Decidir SSOT e manter apenas uma delas no widget.
- [ ] Estado zero: “Pesquise um estudante para iniciar atendimento”.
- [ ] Estado ativo: mostrar dossiê resumido (foto + dados básicos + badge financeiro) usando o dossiê já carregado por `get_aluno_dossier`.

### 3) Carrinho unificado (apenas o que já existe)
- [ ] Manter carrinho de mensalidades já implementado em `BalcaoAtendimento.tsx`.
- [ ] Reusar fluxo de serviços existente (`BalcaoServicoModal` + `PagamentoModal`) sem criar novo fluxo paralelo.
- [ ] Botão único de checkout (“Finalizar Atendimento”) chamando `/api/secretaria/balcao/pagamentos`.

### 4) Ações rápidas (sem inventar novas telas)
- [ ] Mapear ações rápidas existentes (`AcoesRapidasBalcao.tsx`) para as ações do widget.
- [ ] Ações “Emitir Declaração” e “Vender Serviço” devem abrir o fluxo já existente em `DocumentosEmissaoHubClient` e `BalcaoServicoModal`.
- [ ] Evitar abrir `ModalPagamentoRapido` ou `BuscaBalcaoRapido` fora do widget (remover duplicidade na dashboard).

### 5) Performance e padrão KLASSE
- [ ] Manter debounce entre 250–400ms (hoje: 300/400ms). Não aumentar `limit` > 50.
- [ ] `fetch` sempre com `cache: "no-store"` em rotas críticas do balcão.

## Backlog ativo (evidente)
- [ ] Mapeamento determinístico `DOC_*` para documentos no catálogo.
- [ ] CRUD completo de `servicos_escola` (com validações de código/ativo/preço) no Admin Escola.
- [ ] Checkout leve em emissão de documentos com preço (sem modal extra).
- [ ] Sem `COUNT/SUM/GROUP BY` ao vivo na dashboard (usar dados já prontos do backend).

## Notas de validação
- Sem validação no DB remoto por enquanto. Se for necessário validar schema/indices, solicitar permissão antes de usar o `DB_URL`.

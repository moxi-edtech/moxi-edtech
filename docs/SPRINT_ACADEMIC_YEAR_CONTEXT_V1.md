# KLASSE — Sprint Academic Year Context V1

Estado: **RELEASE CANDIDATE — guards e contratos principais implementados; E2E e rotas legadas finais pendentes**  
Escopo: contexto académico por escola, URL, leitura histórica e primeiro conjunto de módulos operacionais.  
Data de atualização: **2026-08-06**

## Atualização de hardening — 2026-08-06

Este ciclo fechou a maior parte da superfície operacional identificada na auditoria:

- transferências individuais e em massa validam origem/destino contra o ano;
- pautas anual, geral e trimestral validam `turma_id` contra o contexto;
- certificados e boletins batch filtram matrículas pela sessão académica;
- boletim individual e PDF deixaram de escolher implicitamente a matrícula mais recente;
- cockpit de conselho, calendário, mapa de aproveitamento e exportações devolvem contexto;
- emissão de documentos finais exige `ano_letivo_id`;
- comprovante de matrícula e declaração legada exigem contexto explícito;
- chamadores frontend críticos foram actualizados para propagar `ano_letivo_id`.

Validação local deste ciclo:

- `pnpm --filter web exec tsc --noEmit`: PASS;
- testes académicos Node: 11/11 PASS;
- `git diff --check`: PASS;
- ESLint dos ficheiros alterados: PASS.

Não foi executada qualquer escrita na base Supabase remota.

## Objetivo

Garantir que o KLASSE:

- abre no ano letivo ativo por padrão;
- respeita um ano histórico quando selecionado explicitamente;
- preserva o contexto entre módulos compatíveis;
- não faz mutações com ano académico implícito;
- mantém cada aba do navegador independente.

Regra central:

```text
URL explícita e válida → ano ativo → erro
```

## Veredito do ciclo

A fundação do contexto académico está implementada e validada. O piloto cobre Radar Financeiro, Turmas e Alunos, incluindo resolução de contexto, navegação, leitura histórica e algumas mutações.

O sprint ainda não deve ser declarado concluído globalmente porque existem mutações e módulos académicos que ainda não usam o resolver central.

Estado desta implementação: o alinhamento P0 de notas e do registo de pagamentos foi iniciado, mas ainda não cobre todas as rotas de escrita do produto.

## Contrato implementado

Localização: `apps/web/src/lib/academic-year/context.ts`

Parâmetro único:

```ts
export const ACADEMIC_YEAR_PARAM = "ano_letivo_id";
```

Tipos:

```ts
AcademicYearStatus = "PLANNED" | "ACTIVE" | "CLOSED"
AcademicWorkspaceMode = "CURRENT" | "HISTORICAL_READ"
```

O contexto devolvido inclui:

- `escolaId`;
- `anoLetivoId`;
- `anoLetivoLabel`;
- `status`;
- `mode`;
- `timezone`;
- `resolvedFrom`;
- warnings de configuração, quando aplicável.

## O que está concluído

### P0 — Fundação

- [x] Resolver central `resolveAcademicYearContext()`.
- [x] Resolução de tenant antes da consulta ao ano letivo.
- [x] Leitura sem parâmetro resolve o ano ativo.
- [x] Leitura com `ano_letivo_id` valida pertença à escola.
- [x] Ano de outro tenant devolve o mesmo erro genérico `404 ACADEMIC_YEAR_NOT_FOUND`.
- [x] Escrita sem `ano_letivo_id` devolve `400 ACADEMIC_YEAR_REQUIRED`.
- [x] Escrita em ano `CLOSED` ou `PLANNED` devolve `409 ACADEMIC_YEAR_CLOSED`.
- [x] Ausência de ano ativo devolve `409 ACTIVE_ACADEMIC_YEAR_NOT_CONFIGURED`.
- [x] Timeout de 5 segundos devolve `503 ACADEMIC_CONTEXT_TIMEOUT`.
- [x] Múltiplos anos ativos usam o de `data_inicio` mais recente.
- [x] Múltiplos anos ativos geram `MULTIPLE_ACTIVE_ACADEMIC_YEARS` e warning em logs.

### P0 — API e URL

- [x] Endpoint `GET /api/academic-context`.
- [x] Canonicalização automática de rotas compatíveis.
- [x] Redirecionamentos automáticos usam `router.replace()`.
- [x] O parâmetro oficial é preservado sem cookie ou estado global.
- [x] Cada aba mantém o contexto pela própria URL.

### P1 — Experiência global

- [x] `AcademicYearSelector` integrado no `AppShell`.
- [x] Banner de histórico com `role="alert"` e `aria-live="polite"`.
- [x] Banner específico para ano `PLANNED`.
- [x] Botão “Voltar ao ano atual”.
- [x] Aviso visual para múltiplos anos ativos.
- [x] `AcademicContextLink` criado.
- [x] Sidebar preserva o ano entre módulos compatíveis.
- [x] Filtros seguros preservados: `page`, `sort`, `order`, `search`, `view`, `tab`.
- [x] Filtros dependentes removidos ao trocar de ano: `turma_id`, `matricula_id`, `disciplina_id`, `aluno_id`, `periodo_id`.

### P1 — Módulos piloto

#### Radar Financeiro

- [x] API usa o resolver central.
- [x] API filtra o período pelo ano selecionado.
- [x] API restringe mensalidades por `matriculas.session_id` antes de consultar a view financeira.
- [x] API valida matrículas no mesmo ano.
- [x] Resposta inclui `context`.
- [x] Frontend envia `ano_letivo_id` nas consultas.
- [x] UI bloqueia selecção, contacto e criação de campanhas em modo histórico.
- [x] Entrada `/financeiro/radar` redireciona para URL canónica.
- [x] Criação de campanha exige ano explícito e bloqueia destinatários de outro ano.

#### Turmas

- [x] API `/api/secretaria/turmas` filtra por `session_id`.
- [x] API canónica `/api/escolas/[id]/turmas` filtra por `session_id`.
- [x] Frontend de Turmas envia `ano_letivo_id`.
- [x] Criação de turma exige ano explícito.
- [x] Criação usa o `session_id` resolvido no servidor.

#### Alunos

- [x] API resolve contexto antes de listar alunos.
- [x] Listagem usa o ano académico resolvido na RPC.
- [x] Enriquecimento financeiro filtra matrículas pelo ano.
- [x] `turma_id` é validado contra o ano selecionado.
- [x] Frontend envia `ano_letivo_id`.
- [x] Resposta inclui `context`.

### Testes e qualidade

- [x] Testes unitários no mesmo conjunto da implementação do resolver.
- [x] Leitura sem ano ativo.
- [x] Leitura histórica explícita.
- [x] Escrita sem ano.
- [x] Escrita em ano encerrado.
- [x] Classificação `ACTIVE`, `PLANNED` e `CLOSED`.
- [x] Typecheck do workspace `apps/web` passou.
- [x] ESLint dos ficheiros do contexto passou sem erros.
- [x] `git diff --check` passou.

### Mutações alinhadas (P0 WRITE)

- [x] `POST /api/secretaria/notas` exige ano explícito através do resolver `WRITE`.
- [x] Lançamento de notas valida `turma_id` contra o `session_id` do ano selecionado.
- [x] Clientes de notas propagam `ano_letivo_id` da URL.
- [x] `POST /api/financeiro/pagamentos/registrar` exige ano explícito e valida matrícula/turma.
- [x] `POST /api/secretaria/balcao/pagamentos` exige ano explícito, valida a matrícula da mensalidade e audita o contexto.
- [x] `POST /api/professor/presencas` (Frequências) exige ano explícito e valida o contexto `WRITE`.
- [x] `POST /api/escolas/[id]/matriculas/novo` (Matrículas) exige ano explícito e valida o contexto `WRITE`.
- [x] `POST /api/secretaria/operacoes-academicas/virada/gerar-pautas-lote` (Pautas) exige ano explícito e valida o contexto `WRITE`.
- [x] Frequências, matrículas novas e geração de pautas registam `ano_letivo_id` nos detalhes da auditoria da mutação.

## Backlog P0 — em progresso para fechar o V1

- [x] Aplicar `resolveAcademicYearContext(..., "WRITE")` às mutações críticas:
  - [x] frequências (`/api/professor/presencas`);
  - [x] pagamentos (`/api/financeiro/pagamentos/registrar` e `/api/secretaria/balcao/pagamentos`);
  - [x] matrículas (`/api/escolas/[id]/matriculas/novo`);
  - [x] geração de pautas em lote (`/api/secretaria/operacoes-academicas/virada/gerar-pautas-lote`);
  - [x] encerramento de período (`/api/escola/[id]/admin/frequencias/fechar-periodo`), incluindo validação do período contra o ano;
  - [x] documentos oficiais em lote (`/api/secretaria/documentos-oficiais/lote`);
- [ ] conselhos de turma.
- [x] transferências individuais e em massa de matrícula/turma;
- [x] pautas oficiais anual, geral e trimestral;
- [x] certificados e boletins batch;
- [x] cockpit de conselho de turma em modo leitura;
- [x] comprovante de matrícula e declaração legada;
- [ ] Garantir que cada mutação persiste ou audita `ano_letivo_id` — já coberto nas rotas P0 listadas acima; restantes mutações pendentes.
- [ ] Validar `entity_id + ano_letivo_id` em todos os endpoints de escrita.
- [ ] Uniformizar `409 CROSS_YEAR_ENTITY_MISMATCH` para entidades de outro ano.
- [ ] Registar auditoria das mutações com `actor_id`, `escola_id`, `ano_letivo_id`, `entity`, `entity_id`, `action`, `request_id` e `occurred_at`.
- [ ] Registar tentativas bloqueadas com `ACADEMIC_YEAR_REQUIRED`, `HISTORICAL_WRITE_BLOCKED` e `CROSS_YEAR_ENTITY_MISMATCH`.
- [ ] Criar teste de tenant cruzado com ano de outra escola.
- [ ] Criar teste de duas abas com contextos 2025 e 2026.
- [ ] Criar teste de entidade de 2025 enviada com contexto 2026.
- [ ] Validar o comportamento com duas linhas `ativo = true` na base remota.

## Backlog P1 — cobertura funcional

- [x] Integrar contexto em Notas — incluindo `/api/professor/notas`, pauta e propagação do cliente legado.
- [x] Integrar contexto em Frequências — endpoint e página operacional alinhados; histórico de relatórios ainda pendente.
- [x] Integrar contexto em Pautas — geração em lote alinhada; conselhos e restantes emissões ainda pendentes.
- [x] Integrar contexto em Calendário e Períodos principais — professor e administração.
- [x] Integrar contexto em agenda/horários do professor — leitura, publicação e remoção validam a turma no ano.
- [x] Filtrar atribuições e pendências do professor pelo ano seleccionado.
- [x] Integrar contexto em Documentos Oficiais em lote — criação valida ano e todas as turmas contra o mesmo `session_id`; emissões individuais e reprocessamentos continuam pendentes.
- [x] Integrar contexto em cockpit, mapa de aproveitamento e exportações principais.
- [x] Integrar contexto em pagamentos e mensalidades fora do Radar — registo financeiro e balcão alinhados; recibos e fluxos fiscais adicionais continuam pendentes.
- [x] Atualizar páginas de detalhe de turma e chamadas de pautas oficiais para enviar `ano_letivo_id`.
- [ ] Atualizar páginas de detalhe de aluno para distinguir cadastro mestre de matrícula no ano.
- [ ] Incluir o ano em todas as query keys de React Query/SWR existentes.
- [ ] Configurar `staleTime: 0` em queries académicas quando forem migradas para React Query.
- [ ] Cancelar requests antigos ao trocar rapidamente de ano.
- [ ] Impedir atualizações otimistas no contexto anterior.

### P1 — próximos módulos

- [ ] Rotas antigas de professor ainda não cobertas: detalhes adicionais, frequência legada e exportações.
- [ ] Currículos e configurações académicas — mutações administrativas restantes.
- [ ] Fluxos legados de virada de ano e reprocessamentos.
- [ ] Declarações/documentos individuais restantes e relatórios académicos secundários.
- [ ] Recibos e fluxos fiscais além do registo de pagamento.

## Backlog P2 — robustez e evolução

- [ ] Substituir o warning de múltiplos anos ativos por alerta operacional persistente para administradores.
- [ ] Criar constraint ou rotina de saneamento que impeça múltiplos anos ativos por escola.
- [ ] Resolver timezone da escola a partir da configuração persistida, em vez do default `Africa/Luanda`.
- [ ] Atualizar automaticamente o seletor entre abas com `BroadcastChannel` ou SSE.
- [ ] Invalidar caches do contexto quando um ano for criado, ativado ou encerrado.
- [ ] Criar métricas para timeout, ano ausente, tenant cruzado e entidade incompatível.
- [ ] Criar testes E2E autenticados para o Curtume.
- [ ] Validar `supabase db reset` e execução em instalação limpa.
- [ ] Validar o fluxo com múltiplas ofertas educativas e anos históricos do Curtume.

## Limitações conhecidas do V1

1. O seletor de ano não se atualiza automaticamente entre abas quando um novo ano é criado. É necessário recarregar a página.
2. O V1 não cobre ainda todas as mutações do produto.
3. O V1 usa `fetch(..., { cache: "no-store" })`; `staleTime: 0` está preparado como constante para futuras integrações com React Query.
4. O timezone ainda usa `Africa/Luanda` como default.
5. A UI alerta múltiplos anos ativos, mas a correção definitiva da configuração deve ser feita no domínio/base de dados.

## Definition of Done do sprint

O sprint só fica concluído quando:

- [ ] todos os módulos académicos compatíveis usam o resolver;
- [ ] todas as mutações críticas exigem ano explícito;
- [ ] todas as entidades são validadas contra o ano;
- [ ] auditoria cobre mutações e bloqueios;
- [ ] testes cobrem prioridade, histórico, duas abas, tenant cruzado e cache;
- [ ] o Curtume é validado num fluxo autenticado ponta a ponta;
- [ ] a base remota não possui ambiguidade de anos ativos sem alerta operacional.

## Limitação cross-tab prevista para V2

O V1 mantém corretamente contextos diferentes em abas diferentes, mas não sincroniza a criação de novos anos entre abas. O V2 deverá usar `BroadcastChannel` ou SSE para atualizar o catálogo sem sobrescrever o contexto selecionado em cada aba.

## Verificação remota read-only — 2026-08-06

Base Supabase remota configurada para o projeto. Nenhuma escrita, migration ou alteração de dados foi executada durante a revisão.

### Estado do Curtume

- Escola: `COMPLEXO ESCOLAR PRIVADO ADVETISTA DE CURTUME`.
- Ano `2026`: ativo, `2026-09-01` a `2027-08-31`.
- Ano `2025`: encerrado/inativo, `2025-09-01` a `2026-07-31`.
- Anos ativos duplicados na base: `0`.
- Turmas: `22` em 2025 e `22` em 2026.
- Matrículas 2026: `230` com status `ativo`.
- Registos 2025: `334` `pendente` e `230` `transferido`.
- Turmas com `session_id` nulo: `0`.
- Turmas com divergência entre `session_id` e `ano_letivo`: `0`.
- Matrículas com `session_id` nulo: `0`.
- Matrículas com divergência entre `session_id` e `ano_letivo`: `0`.

### Ofertas educativas

As três ofertas do Curtume estão presentes e ativas:

| Oferta | Perfil | Calendar profile | Estado |
|---|---|---|---|
| Pré-Escolar | `PRE_ESCOLAR` / `PRE_SCHOOL` | `202620270002` | active |
| Ensino Primário | `REGULAR_ADULTOS` / `PRIMARY` | `202620270001` | active |
| I.º Ciclo do Secundário | `REGULAR_ADULTOS` / `SECONDARY` | `202620270001` | active |

### Integridade e segurança

- `anos_letivos` possui índice único parcial para um ano ativo por escola: `uq_anos_letivos_ativo_por_escola`.
- `anos_letivos`, `school_education_offerings`, `turmas` e `matriculas` têm RLS ativo.
- `turmas` e `matriculas` têm RLS forçado.
- As migrations `20260804120000`, `20260804150000` e `20260805000000` estão registadas no ledger remoto.
- O alinhamento remoto confirma que `session_id` pode ser usado como escopo canónico no Curtume.

### Gaps confirmados pela revisão remota

- A base protege a unicidade do ano ativo, mas a aplicação mantém o warning defensivo para bases antigas ou estados transitórios.
- O RLS garante tenant e papel, mas a validação de compatibilidade entre entidade e ano continua a depender dos endpoints de escrita até todas as mutações adotarem o resolver V1.
- Não existe uma tabela remota genérica de `academic_workspace_context`; o contexto continua corretamente derivado por request a partir de escola e `anos_letivos`.

# Blueprint Operacional — Ciclo de Vida de Tenant (Escola) no KLASSE

## Diagrama crítico (Mermaid)

```mermaid
flowchart TD
  A[Lead inicia onboarding público<br/>/onboarding] --> B[INSERT onboarding_requests status=pendente]
  B --> C[Super Admin cria escola<br/>POST /api/escolas/create]
  C --> D[RPC create_escola_with_admin + vínculo admin<br/>profiles/escola_users/escola_administradores]
  D --> E[Onboarding académico<br/>POST /api/escolas/:id/onboarding/core/session]
  E --> F[RPC setup_active_ano_letivo + upsert_bulk_periodos_letivos]
  F --> G[Aplicar matriz curricular<br/>POST /api/escolas/:id/onboarding/curriculum/apply-matrix]
  G --> H[RPC onboard_academic_structure_from_matrix<br/>cursos/classes/disciplinas/turmas]
  H --> I[Finalizar onboarding<br/>POST /api/escolas/:id/onboarding/core/finalize]

  I --> J[Configuração financeira<br/>/api/financeiro/tabelas-mensalidade (+apply)]
  I --> K[Configuração avaliação<br/>modelos_avaliacao + configuracoes_escola]

  J --> L[Importação alunos<br/>upload -> validar -> importar]
  K --> L

  L --> M[Pre-flight na staging_alunos<br/>ano_letivo/turma_codigo/curso/classe]
  M --> N[RPC importar_alunos_v4]
  N --> O[Cria/atualiza alunos + matrículas + turmas]
  O --> P[Contexto financeiro pós-import<br/>pendências + isenções + notificações]

  O --> Q[Professor lança notas<br/>POST /api/professor/notas]
  Q --> R[RPC lancar_notas_batch -> notas/avaliacoes]
  R --> S[MV boletim/GradeEngine cascade<br/>mv_boletim_por_matricula -> vw_boletim_por_matricula]

  P --> T[Confirmação de pagamento<br/>POST /api/financeiro/pagamentos/confirmar]
  T --> U[RPC finance_confirm_payment<br/>pagamentos + mensalidades + audit + outbox]

  S --> V[Fechamento académico<br/>POST /api/secretaria/fechamento-academico]
  U --> V
  V --> W[fechar_periodo_academico + finalizar_matricula_blindada + gerar_historico_anual]
  W --> X[Promoção/Rematrícula em massa<br/>/api/secretaria/rematricula* + RPC rematricula_em_massa]
  X --> Y[Abertura próximo período/sessão + novas mensalidades]
```

---

## 1) Setup Inicial & Onboarding (Dia 0)

### 1.1 Formulário de onboarding
- O formulário público está em `/onboarding` e grava diretamente em `public.onboarding_requests` com status inicial `pendente`.
- Tabela relacionada: `onboarding_requests` (RLS: insert público, leitura/update apenas super_admin).
- **Observação crítica:** não encontrei no fluxo atual validação de `Invite Code` para este onboarding público; o fluxo é por submissão direta e posterior triagem do super-admin.

**Endpoints/RPCs**
- UI client-side: `apps/web/src/app/onboarding/page.tsx` (insert direto em `onboarding_requests`).
- Backoffice para triagem/uso do pedido: páginas de super-admin (`/super-admin/onboarding` e `/super-admin/escolas/nova`).

### 1.2 Criação do Tenant (Escola)
- O tenant é criado por `POST /api/escolas/create`.
- Fluxo chama RPC `create_escola_with_admin` e, em seguida, garante usuário admin (Auth), `profiles`, `escola_users` e `escola_administradores`.
- Também pode definir plano (`escolas.plano_atual`) e disparar email de onboarding.

**Tabelas impactadas**
- `escolas`
- `profiles`
- `escola_users`
- `escola_administradores`

**Endpoints/RPCs**
- `POST /api/escolas/create`
- `rpc('create_escola_with_admin')`
- Job auth-admin (`findUserByEmail`, `createUser`, `updateUserById`)

### 1.3 Ano letivo inicial + períodos
- `POST /api/escolas/:id/onboarding/core/session` cria/ativa ano letivo e períodos.
- Usa RPCs seguras:
  - `setup_active_ano_letivo`
  - `upsert_bulk_periodos_letivos`
- Após isso, faz `upsert` em `configuracoes_escola` e limpa `onboarding_drafts`.

**Tabelas impactadas**
- `anos_letivos`
- `periodos_letivos`
- `configuracoes_escola`
- `onboarding_drafts`

### 1.4 Cursos + matriz curricular + admin principal/secretaria
- `POST /api/escolas/:id/onboarding/curriculum/apply-matrix` chama RPC `onboard_academic_structure_from_matrix` para materializar estrutura acadêmica.
- `POST /api/escolas/:id/onboarding/core/finalize` marca onboarding como concluído, pode criar cursos legados e vincular convites de professor/secretaria em `escola_users`.

**Tabelas impactadas**
- `cursos`, `classes`, `disciplinas`, `turmas` (via RPC de matriz)
- `escolas` (`onboarding_finalizado`, flags de setup)
- `escola_users`, `profiles` (convites/vínculos)

---

## 2) Configuração Financeira e Académica

### 2.1 Preços/propinas por curso/classe
- A API principal é `GET/POST/DELETE /api/financeiro/tabelas-mensalidade` sobre `financeiro_tabelas`.
- Escopo de regra por escola/ano/curso/classe com upsert por chave composta.
- `POST /api/financeiro/tabelas-mensalidade/apply` propaga para `mensalidades` pendentes (scope `future`/`all`).

**Tabelas impactadas**
- `financeiro_tabelas`
- `mensalidades`
- `vw_turmas_para_matricula` (lookup de target)

### 2.2 Motor de avaliação (herança em cascata)
- O pipeline de boletim usa cascata real em SQL (via `COALESCE`) para fórmula e pesos.
- Ordem observada na migração da view/materialização:
  - Exceção por disciplina (`ma_excecao`)
  - Modelo por curso (`ma_curso`)
  - Modelo global (`ma_global` via `configuracoes_escola.modelo_avaliacao`)
  - fallback hardcoded
- Professor lança notas via RPC `lancar_notas_batch`, e o consumo consolidado ocorre por `vw_boletim_por_matricula` (wrapper de `internal.mv_boletim_por_matricula`).

**Tabelas/views impactadas**
- `notas`, `avaliacoes`, `turma_disciplinas`, `modelos_avaliacao`, `configuracoes_escola`
- `internal.mv_boletim_por_matricula`, `public.vw_boletim_por_matricula`

---

## 3) Ingestão de Dados (Importação)

### 3.1 Pipeline de importação
1. Upload: `/api/migracao/upload` grava ficheiro e cria `import_migrations`.
2. Validação: `POST /api/migracao/alunos/validar` parse CSV, mapeia colunas, grava `staging_alunos`, limpa `import_errors`, marca status `validado`.
3. Importação: `POST /api/migracao/alunos/importar` chama RPC `importar_alunos_v4`.
4. Pós-processo financeiro: identifica pendências, grava `import_financeiro_pendencias`, notifica papéis.

### 3.2 Pre-flight check efetivo
Na prática, o pre-flight acontece em duas camadas:
- API de validação (`/validar`): coerência estrutural do arquivo e staging.
- RPC `importar_alunos_v4`: validação de negócio por linha:
  - parsing estrito de `turma_codigo` (regex)
  - resolução de `curso` por `course_code`
  - resolução de `classe`
  - currículo publicado para curso/classe/ano
  - preço financeiro configurado em `financeiro_tabelas`

### 3.3 Matrículas e financeiro disparados na importação
- Em modo `migracao`, RPC cria `matriculas` ativas (`status='ativo'`, `ativo=true`) quando turma válida.
- Turma pode ser auto-criada (`status_validacao='ativo'`) se não existir.
- Endpoint `/importar` aplica contexto financeiro posterior (pendências, isenções retroativas, notificações), mas **não gera automaticamente novas mensalidades mês-a-mês nessa rota**; ele saneia contexto e depende dos fluxos de geração já existentes.

**Tabelas impactadas**
- `import_migrations`, `staging_alunos`, `import_errors`, `import_financeiro_pendencias`
- `alunos`, `turmas`, `matriculas`
- `mensalidades`, `financeiro_lancamentos`, `notifications`

---

## 4) Ciclo de Vida Operacional

### 4.1 Lançamento de notas e GradeEngine
- Endpoint: `POST /api/professor/notas`.
- Chama RPC transacional `lancar_notas_batch`.
- Consolidação acadêmica é lida por `vw_boletim_por_matricula` (baseada na MV interna), com refresh concorrente agendado na migração da MV.

**Tabelas impactadas**
- `avaliacoes`, `notas`
- `internal.mv_boletim_por_matricula` / `vw_boletim_por_matricula`

### 4.2 Pagamento de propinas e status financeiro
- Endpoint: `POST /api/financeiro/pagamentos/confirmar` exige `Idempotency-Key`.
- RPC `finance_confirm_payment`:
  - confirma `finance_payment_intents`
  - upsert/insert em `pagamentos`
  - recalcula `mensalidades.valor_pago_total` e `mensalidades.status` (`pago`/`pago_parcial`)
  - grava `audit_logs` (via helper de auditoria)
  - publica `outbox_events`

**Tabelas impactadas**
- `finance_payment_intents`
- `pagamentos`
- `mensalidades`
- `outbox_events`
- `audit_logs` (indiretamente)

---

## 5) Fim de Ano e Transição

### 5.1 Fechamento formal do ano/período
- Endpoint orquestrador: `POST /api/secretaria/fechamento-academico`.
- Etapas observadas:
  1. validações de preflight
  2. `fechar_periodo_academico` (quando trimestral)
  3. `finalizar_matricula_blindada`
  4. `gerar_historico_anual`
  5. `historico_set_snapshot_state` (freeze legal)
  6. abertura do próximo período (destrava)

**Tabelas impactadas**
- `fechamento_academico_jobs`
- `fechamento_academico_job_steps`
- `audit_logs`
- `periodos_letivos`
- `matriculas` / snapshots históricos

### 5.2 Promoção em massa / rematrícula inteligente
- Endpoints:
  - `GET /api/secretaria/rematricula/sugestoes` (sugestões por regra de classe)
  - `POST /api/secretaria/rematricula`
  - `POST /api/secretaria/rematricula/confirmar`
- RPC central: `rematricula_em_massa`.
- Atualiza matrícula antiga para `transferido`, cria nova `ativo` na sessão destino; pode gerar novas `mensalidades` no pós-processo.

### 5.3 Bloqueio por dívida (`atrasado`) ou reprovação
- **Gap relevante:** no fluxo atual de `rematricula_em_massa` não há verificação explícita de bloqueio por inadimplência (`mensalidades.status='atrasado'`) nem por reprovação acadêmica antes de inserir matrícula no destino.
- A transição depende hoje de deduplicação por sessão e status ativo na origem/destino, mas não aplica regra de elegibilidade financeira/académica no mesmo ponto transacional.

---

## Gargalos e Riscos (quebras lógicas observáveis no código atual)

1. **Invite Code no onboarding de escola não existe no fluxo público atual.**
   - O pedido público insere diretamente `onboarding_requests` sem token/código.
   - Risco: perda de rastreabilidade de campanhas/parcerias e ausência de gate comercial.

2. **Promoção/rematrícula sem bloqueio transacional por dívida/reprovação.**
   - `rematricula_em_massa` não consulta `mensalidades`/resultado final para bloquear elegibilidade.
   - Risco: aluno inadimplente/reprovado ser promovido por operação em massa.

3. **Importação depende de pré-condições fortes (currículo publicado + preço definido) e falha por linha.**
   - Bom para integridade, mas operacionalmente pode travar lotes grandes por configuração parcial.
   - Risco: alto volume de `import_errors` e necessidade de retrabalho manual antes de go-live.

4. **Onboarding/finalização ainda mistura caminhos legados e novos.**
   - `core/finalize` mantém partes legadas (ex.: criação opcional de cursos por `subjects`) em paralelo ao onboarding matricial.
   - Risco: divergência de estrutura curricular entre escolas novas e antigas.

5. **Geração financeira pós-importação não é “end-to-end automático” em todos os cenários.**
   - Fluxo atual aplica contexto financeiro e pendências, mas a geração contínua das mensalidades depende dos processos específicos (gatilhos/rotas de geração).
   - Risco: percepção de “importei e não faturou tudo” sem runbook operacional claro.

---

## Veredito arquitetural (estado atual)

- **O ciclo completo existe**, mas com **três pontos frágeis** para operação B2B em escala:
  1. gate comercial de onboarding (invite code);
  2. bloqueio de elegibilidade acadêmico-financeira na rematrícula;
  3. padronização final do onboarding (eliminar bifurcação legado vs matriz).

Se você quiser, no próximo passo eu transformo este blueprint em **checklist de hardening por sprint** (P0/P1/P2), com ordem de implementação e critérios de aceite mensuráveis.

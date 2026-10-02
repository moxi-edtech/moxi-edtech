# KLASSE — Status Técnico para Escolas Públicas

**Data da revisão:** 2026-10-01  
**Repositório:** `moxi-edtech/moxi-edtech`  
**Branch de referência:** `main`  
**Status consolidado:** **Sprint de hardening implementado em branch — aguardando CI/merge; operação pública E2E completa ainda depende dos módulos budget/emolumentos e homologação.**

---

## 1. Objetivo

Este documento é o SSOT técnico para a capacidade do KLASSE operar escolas públicas.

Ele responde a uma pergunta específica:

> O mesmo produto multi-tenant consegue atender uma escola pública sem herdar automaticamente as regras financeiras, académicas e documentais de uma escola privada?

A resposta actual é: **a arquitetura-base existe, mas o fluxo completo ainda não está fechado**.

Este documento não substitui:

- `docs/klasse-network-med-strategy.md` — estratégia institucional/dados para o MED;
- `plan_crm_execution_backlog.md` — backlog comercial/onboarding;
- documentação normativa RAA/MED — fonte das regras académicas.

---

## 2. Implementação já existente

### 2.1 Perfil institucional

A base está em:

- `supabase/migrations/20260821140000_school_operating_profile_foundation.sql`
- `supabase/migrations/20260821150000_school_profile_audit_logs.sql`
- `supabase/migrations/20260821160000_school_operating_profile_admin_rpc.sql`
- `apps/web/src/lib/school-profile/types.ts`
- `apps/web/src/lib/school-profile/resolve-school-profile.ts`
- `apps/web/src/components/super-admin/SchoolOperatingProfileSettings.tsx`

Contrato actual:

```ts
schoolSector: "private" | "public"

financeModel:
  | "tuition"
  | "budget"
  | "emoluments_only"
  | "mixed"

assessmentPolicy:
  | "custom"
  | "med_angola_pending"
  | "med_angola_primary_pending"
  | "med_angola_secondary_pending"

regulatoryProfile: string
documentProfile: string
```

### 2.2 Segurança e governança

Implementado:

- RLS no perfil institucional;
- leitura pelo tenant da escola ou Super Admin;
- mutação administrativa restrita;
- motivo obrigatório;
- confirmação explícita;
- versionamento por vigência;
- histórico append-only em `school_profile_audit_logs`;
- resolver server-side com fallback privado apenas para rollout de relação ainda não deployada;
- falhas de banco diferentes de `42P01` falham fechadas, evitando ativar comportamento privado por erro silencioso.

### 2.3 Enforcement financeiro já aplicado

Os commits-base foram:

- `1d14611686923d85a9edd91f9f7f4ab3109b9a3b` — perfil operacional;
- `afc3e648ee3291f06feea2c8278bcc755e173544` — aplicação dos guards financeiros.

Capabilities actuais:

```ts
canUseRecurringTuition()
canUseFinancialSuspension()
canUseFinanceChargeMessages()
canUseBudgetModule()
canUseEmoluments()
```

Já existem guards em fluxos relevantes de:

- geração de mensalidades;
- cobranças;
- campanhas de cobrança;
- mensagens financeiras;
- WhatsApp `finance_charge`;
- configuração de bloqueio por inadimplência;
- enriquecimento de gestão de acessos;
- KLASSE IA / Data Copilot / actions financeiras.

---

## 2.4 Estado dos portais do aluno e do professor

### Portal do aluno — ALINHADO NO SPRINT (aguarda CI/merge)

A revisão de 2026-10-01 encontrou dependências financeiras privadas que ainda ignoram o perfil operacional da escola.

Evidências:

- `apps/web/src/app/(portal-aluno)/aluno/AlunoLayoutClient.tsx`
  - inclui `/aluno/financeiro` de forma fixa nos itens de navegação;
  - pré-carrega endpoints financeiros independentemente do `finance_model`.
- `apps/web/src/components/aluno/layout/AlunoBottomNav.tsx`
  - assume “Financeiro” entre os quatro itens principais.
- `apps/web/src/app/(portal-aluno)/aluno/layout.tsx`
  - lê `configuracoes_financeiro.bloquear_inadimplentes`;
  - consulta `mensalidades` vencidas;
  - pode redirecionar o aluno para `/aluno/desabilitado`;
  - não resolve `SchoolOperatingProfile` antes de aplicar esse bloqueio.
- `apps/web/src/app/api/aluno/home/finance-alert/route.ts`
  - consulta `mensalidades` directamente;
  - não aplica capability guard.
- `apps/web/src/app/api/aluno/financeiro/route.ts`
  - expõe mensalidades, ledger, pagamentos/serviços e resumo financeiro;
  - não deriva o comportamento do `finance_model`.
- `apps/web/src/components/aluno/tabs/TabFinanceiro.tsx`
  - é desenhado em torno de mensalidades, saldos, pagamento e comprovativo;
  - não diferencia `tuition`, `budget` e `emoluments_only`.

Risco concreto:

> Uma escola `public + budget` pode continuar mostrando “Financeiro”, consultar mensalidades e até bloquear o portal por inadimplência histórica/configurada, apesar de o modelo institucional não suportar propina recorrente.

No sprint `feat/public-schools-readiness-sprint`, esses pontos foram corrigidos por capability: navegação, alertas, bloqueio por inadimplência, financeiro e rematrícula passam a respeitar o perfil institucional. A liberação permanece condicionada ao CI e à aplicação das migrations.

Comportamento alvo:

| Capability | `tuition` | `budget` | `emoluments_only` | `mixed` |
|---|---:|---:|---:|---:|
| Mostrar mensalidades | sim | não | não | definir contrato |
| Alertas de propina | sim | não | não | definir contrato |
| Bloqueio por inadimplência de propina | sim, se política habilitada | não | não | definir contrato |
| Mostrar serviços/emolumentos | quando aplicável | quando aplicável | sim | sim |
| Mostrar recibos/histórico permitido | sim | conforme operação | sim | sim |
| Entrada “Financeiro” | sim | somente se houver capability útil | sim | sim |

A decisão de navegação deve vir das mesmas capabilities do backend; não de `school_sector` isoladamente.

### Portal do professor — PARCIALMENTE ALINHADO

O portal do professor não carrega módulos de propina/cobrança e, por isso, não herda o principal problema financeiro do portal do aluno.

Entretanto, a camada académica ainda não está derivada do perfil operacional da escola.

Evidências:

- `apps/web/src/lib/professorNav.ts`
  - navegação é académica e neutra: Início, Frequências, Notas, Materiais, Calendário e Perfil.
- `apps/web/src/app/api/professor/pauta/route.ts`
  - resolve o modelo de avaliação através da configuração académica existente;
  - não resolve `SchoolOperatingProfile` nem `assessment_policy`.
- `apps/web/src/app/api/professor/notas/route.ts`
  - grava via `lancar_notas_batch`;
  - não há evidência de enforcement por `school_operating_profiles`/`assessment_policy` nesse boundary.
- `canUseAutomaticLegalAssessment()`
  - permanece deliberadamente `false`;
  - não está ligado ao runtime do portal do professor.

Consequência:

> Uma escola pública pode usar o portal do professor com o modelo académico configurado manualmente, mas o KLASSE ainda não deve afirmar que o comportamento de avaliação está automaticamente alinhado ao MED apenas porque o perfil da escola é `public` ou possui uma policy `med_angola_*`.

Comportamento alvo:

1. frequência, materiais, calendário e atribuições continuam comuns entre escolas públicas e privadas;
2. lançamento de notas continua permitido quando o professor possui atribuição válida;
3. fórmula, componentes, escalas e progressão só podem ser alterados automaticamente por `assessment_policy` quando existir policy registry versionado e aprovado;
4. até esse gate existir, `custom`/configuração académica explícita continua sendo a fonte operacional;
5. o portal deve expor o regime efetivo de avaliação quando houver mais de um regime suportado, sem inferir regra legal pelo setor.

---

## 3. Blockers antes de um piloto público

### PUB-001 — Invariantes institucionais — IMPLEMENTADO NO SPRINT

Hoje o domínio permite representar:

```text
school_sector = public
finance_model = tuition
```

Se a regra oficial do produto for “escola pública não cobra propina recorrente”, essa combinação precisa ser recusada no banco/RPC.

Matriz a formalizar:

| Setor | Modelo | Estado esperado |
|---|---|---|
| private | tuition | permitido |
| private | mixed | definir contrato |
| private | emoluments_only | permitido |
| public | budget | permitido |
| public | emoluments_only | permitido quando aplicável |
| public | tuition | proibido se a política KLASSE for sem propina recorrente |

Também é necessário formalizar `mixed`: actualmente ele habilita emolumentos, mas `canUseRecurringTuition()` só aceita `tuition`.

### PUB-002 — Hard gate em todos os writers financeiros — IMPLEMENTADO NO SPRINT

O enforcement não pode depender apenas de:

- esconder menu;
- esconder botão;
- não gerar mensalidade;
- bloquear campanha de cobrança.

O boundary de escrita precisa rejeitar operações incompatíveis.

Caminhos identificados para revisão/fecho:

- `/api/secretaria/balcao/pagamentos`
- `/api/secretaria/pagamentos/processar`
- `/api/financeiro/pagamentos/registrar`
- `/api/escolas/[id]/financeiro/pagamentos/novo`
- `/api/escolas/[id]/financeiro/vendas/avulsa`
- `/api/financeiro/conciliacao/settle`
- `/api/secretaria/admissoes/convert`

Writers/RPCs canónicos relacionados:

- `financeiro_registrar_pagamento_secretaria(...)`
- `financeiro_registrar_pagamentos_secretaria_batch(...)`
- `registrar_pagamento(...)`

**Critério:** um endpoint alternativo ou chamada RPC autenticada nunca pode contornar o perfil institucional.

### PUB-003 — Orçamento

`canUseBudgetModule()` existe, mas a capability ainda não representa um fluxo operacional completo.

Antes do piloto, definir:

- origem do orçamento;
- dotações/rubricas;
- execução;
- autorizações;
- relatórios;
- auditoria;
- que partes do financeiro privado desaparecem;
- integração fiscal quando aplicável.

### PUB-004 — Emolumentos

`emoluments_only` existe no domínio, mas precisa de contrato E2E.

Definir:

- catálogo permitido;
- cobrança pontual;
- recibo/documento;
- relação com matrícula;
- relação com fiscal;
- regras de isenção;
- permissões.

### PUB-005 — Académico/regulatório

As policies `med_angola_*` existem como **pending**.

`canUseAutomaticLegalAssessment()` devolve deliberadamente `false`.

Não activar uma regra académica automática apenas porque `regulatoryProfile` contém um nome.

Para ativação é necessário:

1. fonte normativa identificada;
2. regra versionada;
3. data de vigência;
4. população/nível de ensino;
5. testes com casos-limite;
6. evidência de aprovação;
7. rollback/versionamento.

### PUB-006 — Documentos oficiais

`documentProfile` e `canUseOfficialDocumentProfile()` existem como scaffold.

Falta ligar o perfil aos emissores/documentos apropriados e impedir a emissão de um template incompatível com a instituição.

### PUB-007 — Navegação e UX dos portais — IMPLEMENTADO PARA FINANCEIRO/REMATRÍCULA

A UI deve derivar capacidades do perfil, sem duplicar regras de negócio.

#### Portal administrativo/operacional

Uma escola sem propina recorrente não deve receber:

- Radar de inadimplência de propinas;
- geração de mensalidades;
- campanhas de cobrança de propina;
- ações IA de cobrança;
- suspensão académica por dívida de mensalidade.

#### Portal do aluno

Antes do piloto público:

- remover/transformar “Financeiro” por capability;
- impedir `finance-alert` para modelos sem propina;
- impedir bloqueio do portal por inadimplência quando `canUseFinancialSuspension(profile) === false`;
- fazer `/api/aluno/financeiro` retornar apenas capacidades compatíveis;
- separar mensalidade recorrente de serviço/emolumento;
- garantir que uma dívida histórica de um modelo anterior não bloqueie uma escola que mudou de perfil sem regra explícita de transição.

#### Portal do professor

Antes de declarar suporte MED automático:

- manter navegação académica independente do setor;
- não inferir fórmula legal a partir de `school_sector`;
- ligar `assessment_policy` ao runtime somente após registry normativo aprovado;
- testar lançamento/pauta/frequência numa fixture pública.

O backend continua sendo a autoridade; a UI é apenas a representação.

### PUB-008 — E2E público — PARCIAL (CI dedicado adicionado)

Criar fixture de teste:

```text
school_sector = public
finance_model = budget
assessment_policy = custom
```

Provar:

1. login e isolamento multi-tenant;
2. matrícula sem dependência de propina;
3. turmas/currículo;
4. notas/frequência;
5. documentos permitidos;
6. comunicação;
7. writers de propina recusados;
8. mensagens financeiras recusadas;
9. suspensão por inadimplência não aplicada;
10. nenhuma fuga de dados entre escolas.

---

## 4. Níveis de prontidão

### Nível 1 — Fundação de domínio — FEITO

- `private/public`;
- modelos financeiros;
- RLS;
- versionamento;
- auditoria;
- Super Admin;
- resolver central.

### Nível 2 — Enforcement financeiro — IMPLEMENTADO NO SPRINT / AGUARDA HOMOLOGAÇÃO

Feito:

- geração de mensalidades;
- cobranças;
- campanhas;
- mensagens financeiras;
- WhatsApp de cobrança;
- parte do KLASSE IA;
- suspensão por inadimplência.

Implementado no sprint:

- hard gate de `mensalidades` e `pagamentos` no Postgres;
- resolução de `escola_id` para writers legados de mensalidade;
- MCX bloqueado antes do side effect externo;
- comprovativo do aluno bloqueado antes do upload;
- rematrícula condicionada às capabilities financeiras.

### Nível 3 — Operação pública E2E — FALTA

Faltam:

- orçamento operacional;
- emolumentos E2E;
- académico/regulatório aprovado;
- perfil documental;
- navegação completa por capability.

### Nível 4 — Pilot-ready — FALTA

Só considerar atingido quando:

- PUB-001..PUB-008 estiverem fechados;
- testes autenticados passarem;
- RLS entre tenants for comprovado;
- writers proibidos falharem também no boundary SQL;
- houver smoke test numa escola pública fixture.

---

## 5. Regra de segurança

> **O perfil institucional deve ser aplicado no boundary que produz o efeito, não apenas na superfície que oferece a ação.**

Exemplos:

- esconder “Gerar mensalidades” não substitui bloquear a RPC;
- esconder “Cobrar” não substitui bloquear o writer;
- remover uma action da IA não substitui autorização server-side;
- identificar uma escola como pública não deve ativar automaticamente uma interpretação legal ainda não aprovada.

---

## 6. Próximo bloco de execução

Ordem recomendada:

1. **PUB-001** — matriz/invariantes de perfil;
2. **PUB-002** — hard gate em writers financeiros;
3. **PUB-008 (parte 1)** — testes negativos dos writers;
4. **PUB-003/PUB-004** — orçamento e emolumentos;
5. **PUB-007** — navegação por capability;
6. **PUB-005/PUB-006** — académico/regulatório/documentos;
7. **PUB-008 (final)** — E2E autenticado e gate pilot-ready.

---

## 7. Relação com a estratégia MED

A estratégia de agregação de dados e relacionamento institucional continua documentada em:

- `docs/klasse-network-med-strategy.md`

A existência dessa estratégia **não implica** que o produto esteja tecnicamente liberado para operar uma escola pública.

O gate técnico é este documento.


---

## 8. Sprint de hardening — 2026-10-02

Branch: `feat/public-schools-readiness-sprint`

Implementado:

- matriz central de capabilities financeiras;
- `public + tuition` recusado na API, UI e banco;
- `mixed` não infere propina recorrente;
- triggers canónicos em `mensalidades` e `pagamentos`;
- proteção de writers legados que omitem `escola_id`;
- portal do aluno deriva Financeiro e alertas do perfil;
- `budget` não expõe mensalidades nem bloqueio por inadimplência;
- `emoluments_only/mixed` mantêm pagamentos pontuais sem propina recorrente;
- MCX é bloqueado antes de chamar o gateway quando a operação não é suportada;
- comprovativo de propina é bloqueado antes do upload;
- rematrícula do aluno, balcão e lote deixa de exigir dívida zero quando `financial_suspension=false`;
- `budget` pode iniciar/concluir rematrícula académica sem intent de pagamento;
- geração pós-rematrícula de mensalidades só ocorre quando `recurring_tuition=true`;
- workflow `Gracefulness Public Schools` executa unit test, typecheck, ESLint e regressão em PostgreSQL 17.

Ainda fora deste hardening:

- módulo orçamental público completo (dotações/rubricas/execução);
- contrato E2E completo de emolumentos;
- policy registry MED aprovado para automação legal;
- perfil documental oficial MED;
- homologação com fixture pública real e aplicação da migration no ambiente alvo.

**Gate:** não marcar `pilot-ready` antes dos checks do PR e da homologação do banco.

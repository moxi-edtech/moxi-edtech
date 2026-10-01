# KLASSE — Status Técnico para Escolas Públicas

**Data da revisão:** 2026-10-01  
**Repositório:** `moxi-edtech/moxi-edtech`  
**Branch de referência:** `main`  
**Status consolidado:** **Parcial — fundação concluída, enforcement financeiro incompleto, ainda não pilot-ready**

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

## 3. Blockers antes de um piloto público

### PUB-001 — Invariantes institucionais

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

### PUB-002 — Hard gate em todos os writers financeiros

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

### PUB-007 — Navegação e UX

A UI deve derivar capacidades do perfil, sem duplicar regras de negócio.

Uma escola sem propina recorrente não deve receber:

- Radar de inadimplência de propinas;
- geração de mensalidades;
- campanhas de cobrança de propina;
- ações IA de cobrança;
- suspensão académica por dívida de mensalidade.

O backend continua sendo a autoridade; a UI é apenas a representação.

### PUB-008 — E2E público

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

### Nível 2 — Enforcement financeiro — PARCIAL

Feito:

- geração de mensalidades;
- cobranças;
- campanhas;
- mensagens financeiras;
- WhatsApp de cobrança;
- parte do KLASSE IA;
- suspensão por inadimplência.

Falta:

- hard gate completo no writer canónico e nos caminhos alternativos.

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

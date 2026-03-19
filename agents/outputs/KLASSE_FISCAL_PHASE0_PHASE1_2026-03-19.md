# KLASSE Fiscal — Fase 0 e Fase 1

Data: 2026-03-19
Objetivo: materializar as decisões mínimas de contrato (Fase 0) e a fundação de dados fiscal (Fase 1) sem contaminar o domínio legado de `documentos_emitidos` e `recibos`.

## Fase 0 — Decisões fechadas agora

### 1. Bounded context fiscal separado
O módulo fiscal nasce separado do fluxo legado de `documentos_emitidos`, `emitir_recibo(...)` e `next_documento_numero(...)`.

**Decisão:** o núcleo novo vive em tabelas `fiscal_*` e não em extensões oportunistas do legado.

### 2. Tenant fiscal explícito
O tenant fiscal é `empresa_id`, não `escola_id`.

**Decisão:** a fundação cria `fiscal_empresas`, `fiscal_empresa_users` e `fiscal_escola_bindings`.

### 3. Ponte escola → empresa fiscal
Uma escola pode ser ligada a uma empresa fiscal sem assumir equivalência estrutural eterna entre escola e empresa.

**Decisão:** a relação fica explícita em `fiscal_escola_bindings`, com suporte a vínculo primário e janela temporal.

### 4. Segurança e acesso
Acesso fiscal não fica “herdado por acidente” do tenant escolar.

**Decisão:** RLS fiscal usa membership em `fiscal_empresa_users`; ligação escola→empresa serve para operação e onboarding, não para furar a fronteira fiscal.

### 5. Séries, chaves e ledger imutável
A fundação já prepara o contrato para:

- séries fiscais por empresa;
- chaves versionadas por empresa;
- documento fiscal com `key_version`, `hash_control` e encadeamento;
- itens, eventos e exportações em tabelas próprias.

### 6. Escopo intencionalmente fora desta entrega
Ainda não foi implementado nesta fase:

- assinatura RSA real;
- emissão/rectificação/anulação por API;
- SAF-T(AO) XML;
- UI fiscal no portal financeiro.

Essas etapas dependem da fundação de dados ficar estável primeiro.

---

## Fase 1 — Foundation entregue

A migration desta fase cria:

- `public.fiscal_empresas`
- `public.fiscal_empresa_users`
- `public.fiscal_escola_bindings`
- `public.fiscal_series`
- `public.fiscal_chaves`
- `public.fiscal_documentos`
- `public.fiscal_documento_itens`
- `public.fiscal_documentos_eventos`
- `public.fiscal_saft_exports`
- funções `current_tenant_empresa_id()`, `user_has_role_in_empresa(...)`, `fiscal_reservar_numero_serie(...)`
- triggers de `updated_at`
- guardrails de consistência cross-tenant para documentos, itens e eventos
- RLS forte por `empresa_id`

## Notas de arquitectura

### Porque não herdar acesso fiscal de `escola_users`
Porque o fiscal vai precisar suportar cenários onde:

- a entidade emissora não é 1:1 com a escola;
- múltiplas escolas partilham a mesma empresa fiscal;
- um auditor fiscal deve ver a empresa, mas não necessariamente todo o ERP escolar;
- uma mudança de vínculo escolar não pode implicitamente reconfigurar o ledger fiscal.

### Porque `fiscal_escola_bindings` existe já
Para evitar acoplamento oculto. A ponte escola→empresa precisa ser modelada no banco desde cedo, mesmo antes da API final, para não obrigar retrofit perigoso depois.

### Porque a trigger de imutabilidade entrou já
Porque documento emitido não pode virar “quase imutável”. Se deixarmos update livre agora, a dívida regulatória nasce no primeiro endpoint.

---

## Próximo corte recomendado

### Fase 2 imediata
1. API privada de setup fiscal (`/api/fiscal/setup/...`) para:
   - criar empresa fiscal;
   - vincular escola;
   - cadastrar série;
   - cadastrar chave pública/metadata de key version.
2. serviço backend de canonical string + assinatura;
3. emissão de `POST /api/fiscal/documentos` transaccional.

### Risco que continua aberto
Ainda falta decidir como a chave privada será operada em produção:

- KMS gerido;
- HSM;
- secret manager com serviço isolado.

Sem essa decisão, a Fase 2 só deve avançar até interfaces e contratos, não até emissão “oficial”.

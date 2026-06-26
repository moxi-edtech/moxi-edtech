# WAHA WhatsApp KLASSE — Implementação

Data: 2026-06-26
Escopo: integração WAHA, Central WhatsApp, outbox auditável, worker, webhook, templates e operação.

## Decisão de Arquitetura

O WhatsApp no KLASSE é comunicação assistida, aprovada e auditável. A integração não implementa bot autônomo, chat livre ou envio direto pelo cliente.

Fluxo principal:

1. Usuário autorizado cria uma mensagem na Central WhatsApp.
2. Backend valida tenant, role, provider, telefone e regras de aprovação.
3. Mensagem vira item em `communication_outbox`.
4. Worker reclama atomicamente itens elegíveis e chama WAHA no servidor.
5. Resultado e eventos são persistidos em `communication_outbox` e `communication_logs`.
6. Webhook WAHA atualiza status e registra eventos sanitizados.

WAHA nunca é chamado pelo browser. `WAHA_API_KEY` e `WAHA_BASE_URL` ficam somente no servidor.

## Componentes

### UI

Página principal:

```text
/escola/{schoolId}/admin/comunicacao/whatsapp
```

Arquivo:

```text
apps/web/src/app/escola/[id]/(portal)/admin/comunicacao/whatsapp/page.tsx
```

Nome exibido:

```text
WhatsApp KLASSE
```

Funcionalidades da tela:

- status da sessão WAHA;
- resumo de fila, enviados hoje, falhas hoje e última sincronização;
- criação de mensagem individual;
- criação de envio de acesso do aluno;
- criação de comunicados controlados por seleção;
- visualização de fila;
- visualização de mensagens enviadas;
- visualização de falhas;
- aprovação, cancelamento e reenvio;
- listagem de templates;
- listagem de logs;
- link para configuração/QR para roles com permissão.

Entrada de menu:

```text
apps/web/src/lib/sidebarNav.ts
apps/web/src/components/layout/klasse/Sidebar.tsx
```

A entrada `WhatsApp KLASSE` foi adicionada para:

- admin;
- secretaria;
- financeiro.

O controle real de acesso continua no backend.

### APIs da Central

Base:

```text
/api/escola/{id}/admin/comunicacao/whatsapp
```

Arquivos:

```text
apps/web/src/app/api/escola/[id]/admin/comunicacao/whatsapp/route.ts
apps/web/src/app/api/escola/[id]/admin/comunicacao/whatsapp/[outboxId]/route.ts
apps/web/src/app/api/escola/[id]/admin/comunicacao/whatsapp/access/route.ts
apps/web/src/app/api/escola/[id]/admin/comunicacao/whatsapp/recipients/route.ts
apps/web/src/app/api/escola/[id]/admin/comunicacao/whatsapp/bulk/route.ts
```

Responsabilidades:

- `GET /whatsapp`: dashboard, provider, sessão, resumo, outbox, templates e logs.
- `POST /whatsapp`: cria mensagem individual/outbox.
- `PATCH /whatsapp/{outboxId}`: aprova, cancela, rejeita ou reenvia.
- `GET /recipients`: busca destinatários com telefone válido.
- `POST /access`: cria envio de acesso do aluno por link seguro.
- `POST /bulk`: cria itens individuais para lote controlado.

Validações comuns:

- usuário autenticado;
- tenant via `resolveEscolaIdForUser`;
- role permitida via `user_has_role_in_school`;
- `WAHA_EXPERIMENTAL_ENABLED=true`;
- provider `whatsapp_waha` conectado;
- telefone normalizado no backend;
- aluno/professor pertence à escola;
- template permitido para a role;
- cobrança financeira exige role financeira;
- cliente não define `approved_by`, `approved_at` ou `provider_message_id`.

### Helper Server-Side

Arquivo:

```text
apps/web/src/lib/server/whatsappUtility.ts
```

Responsabilidades:

- roles permitidas;
- roles de gestão de sessão;
- roles financeiras;
- autorização por tenant;
- normalização e máscara de telefone;
- hash HMAC de telefone;
- interpolação de templates;
- decisão de aprovação obrigatória;
- normalização de status WAHA;
- consulta de status da sessão WAHA;
- envio WAHA via `/api/sendText`;
- extração de `provider_message_id`;
- kill switch `WAHA_EXPERIMENTAL_ENABLED`.

## Modelo de Dados

Migration:

```text
supabase/migrations/20260626210000_whatsapp_utility_v2.sql
```

Também fazem parte do bloco WAHA recente:

```text
supabase/migrations/20260626130000_create_school_notification_providers.sql
supabase/migrations/20260626153000_fix_ai_school_settings_select_policy.sql
```

Essas três migrations foram aplicadas e registradas no remoto em:

```text
supabase_migrations.schema_migrations
```

### `school_notification_providers`

Configura provider por escola.

Campos relevantes:

- `school_id`;
- `provider_type = whatsapp_waha`;
- `display_name`;
- `status`;
- `daily_limit`;
- `monthly_limit`;
- `session_name`;
- `config`.

Uso:

- status e sessão da escola;
- controle de provider conectado/desconectado;
- fonte para o worker localizar `session_name`.

### `communication_templates`

Registry de templates oficiais.

Campos principais:

- `key`;
- `title`;
- `category`;
- `body`;
- `required_variables`;
- `risk_level`;
- `requires_approval`;
- `allowed_roles`;
- `active`.

Templates iniciais:

- `student_access_basic`;
- `student_access_activation`;
- `finance_friendly_reminder`;
- `finance_second_reminder`;
- `finance_formal_notice`;
- `school_general_notice`;
- `document_ready_notice`;
- `meeting_invitation`;
- `enrollment_confirmation`.

Regra:

- templates financeiros têm `risk_level='high'` e `requires_approval=true`;
- rascunhos IA e cobranças também exigem aprovação por regra de backend.

### `communication_outbox`

Fila auditável de mensagens WhatsApp.

Status permitidos:

```text
draft
review_required
approved
queued
sending
sent
delivered
read
failed
cancelled
rejected
```

Tipos suportados:

```text
auth_provision_student
school_notice
finance_charge
document_ready
manual_message
ai_generated_draft
```

Campos de auditoria e entrega:

- `created_by`;
- `approved_by`;
- `approved_at`;
- `queued_at`;
- `sending_at`;
- `sent_at`;
- `delivered_at`;
- `read_at`;
- `failed_at`;
- `cancelled_at`;
- `provider_message_id`;
- `retry_count`;
- `next_retry_at`;
- `last_error`;
- `idempotency_key`.

Campos de destinatário:

- `recipient_type`;
- `recipient_ref_id`;
- `recipient_name`;
- `recipient_phone_masked`;
- `recipient_phone_hash`;
- `metadata`.

Observação operacional:

- o telefone normalizado necessário para envio fica em `metadata.phone`;
- a UI não seleciona nem recebe telefone real para destinatários internos;
- a UI trabalha com telefone mascarado e referência do destinatário.

### `communication_logs`

Log de eventos da comunicação.

Campos:

- `outbox_id`;
- `school_id`;
- `event_type`;
- `provider`;
- `provider_event_id`;
- `payload_sanitized`;
- `created_at`.

O payload é sanitizado para não persistir dados sensíveis desnecessários.

### `communication_rate_limits`

Configuração mínima por escola.

Defaults:

```text
max_messages_per_minute = 10
max_messages_per_hour = 100
max_messages_per_day = 500
quiet_hours_start = 20:00
quiet_hours_end = 07:00
```

## RPCs e Triggers

### `claim_communication_outbox(p_limit integer)`

Reclama atomicamente mensagens elegíveis para envio.

Regras:

- pega `approved` ou `queued`;
- recupera `sending` antigo com mais de 10 minutos;
- respeita `next_retry_at`;
- ignora itens que exigem aprovação e não têm `approved_by`;
- usa `FOR UPDATE SKIP LOCKED`;
- atualiza status para `sending`.

Uso:

```text
apps/web/src/app/api/jobs/outbox/route.ts
```

### `guard_communication_outbox_client_update()`

Trigger anti-tamper.

Bloqueia atualização direta por usuário autenticado de:

- `approved_by`;
- `approved_at`;
- `provider_message_id`.

Esses campos são gerenciados por backend/RPC/worker.

### `set_communication_outbox_action(p_outbox_id uuid, p_action text)`

RPC para ações humanas auditáveis.

Ações:

- `approve`;
- `retry`;
- `cancel`;
- `reject`.

Valida:

- role autorizada na escola;
- role financeira para `finance_charge`;
- status compatível com a ação;
- aprovação sempre usa `auth.uid()`.

## Worker de Envio

Arquivo:

```text
apps/web/src/app/api/jobs/outbox/route.ts
```

O worker existente foi estendido para processar também `communication_outbox`, mantendo o fluxo legado `outbox_notificacoes`.

Fluxo V2:

1. Confere `WAHA_EXPERIMENTAL_ENABLED`.
2. Chama `claim_communication_outbox`.
3. Para cada item:
   - valida `school_id`;
   - valida aprovação quando `requires_approval=true`;
   - carrega provider `whatsapp_waha`;
   - exige provider `connected`;
   - aplica quiet hours;
   - aplica rate limit por minuto/hora/dia;
   - valida telefone e mensagem;
   - envia pelo WAHA server-side;
   - salva `provider_message_id`;
   - marca `sent`;
   - registra log.

Backoff:

- 1a falha: próximo retry em 1 minuto;
- 2a falha: próximo retry em 5 minutos;
- 3a falha: próximo retry em 15 minutos;
- 4a falha: status `failed`.

Proteção contra duplicação:

- `idempotency_key` é enviado ao WAHA como `id`;
- claim atômico usa lock;
- `sending` antigo só é recuperado depois de 10 minutos;
- retry depende de `next_retry_at`.

## Webhook WAHA

Arquivo:

```text
apps/web/src/app/api/jobs/waha-webhook/route.ts
```

Endpoint:

```text
POST /api/jobs/waha-webhook
```

Regras:

- exige `WAHA_WEBHOOK_SECRET`;
- valida assinatura HMAC SHA-256;
- aceita header `x-waha-signature`, `x-hub-signature-256` ou `x-signature`;
- associa evento por `session_name`;
- localiza escola via `school_notification_providers`;
- atualiza outbox por `provider_message_id`;
- registra log sanitizado.

Eventos suportados:

- `sent`;
- `delivered`;
- `read`;
- `failed`;
- `session.connected`;
- `session.disconnected`;
- `session.failed`;
- eventos recebidos ou desconhecidos entram apenas em `communication_logs`.

Inbox completa fica fora deste escopo.

## Configuração de Ambiente

Variáveis necessárias no runtime server:

```text
WAHA_EXPERIMENTAL_ENABLED=true
WAHA_BASE_URL=https://...
WAHA_API_KEY=...
WAHA_WEBHOOK_SECRET=...
WHATSAPP_PHONE_HASH_PEPPER=...
OUTBOX_JOB_TOKEN=...
CRON_SECRET=...
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Regras:

- não criar `NEXT_PUBLIC_WAHA_API_KEY`;
- não expor `WAHA_API_KEY` no client;
- não expor `WAHA_BASE_URL` sensível no client;
- `WAHA_WEBHOOK_SECRET` deve ser diferente da API key;
- `WHATSAPP_PHONE_HASH_PEPPER` deve ser estável para preservar hash de telefone.

## Sessão WAHA por Escola

Cada escola usa provider próprio:

```text
provider_type = whatsapp_waha
session_name = classe_school_...
```

Regras:

- sessão não é compartilhada entre escolas;
- backend mascara `session_name` na UI;
- QR fica na área de configuração;
- gerenciamento de sessão é limitado a `admin`, `admin_escola`, `direcao`, `diretoria`;
- secretaria/financeiro podem usar envio, mas não precisam gerenciar QR.

## VPS / WAHA

Estado operacional atual esperado:

- WAHA rodando em VPS AWS;
- engine `GOWS`;
- endpoint público atrás de HTTPS;
- API protegida por `WAHA_API_KEY`;
- app chama WAHA apenas via server-side.

Checklist de VPS:

```text
docker ps
docker logs <waha-container>
curl -H "X-Api-Key: $WAHA_API_KEY" "$WAHA_BASE_URL/api/sessions"
```

Pontos críticos:

- `WAHA_BASE_URL` não pode ter newline;
- API key no Vercel precisa bater com a key do container;
- container deve preservar storage de sessões entre restarts;
- se QR pareia e cai para `FAILED`, verificar engine, permissões do volume e logs do container;
- session status funcional esperado pelo app: `WORKING`, `connected`, `authenticated` ou equivalente normalizado.

## Segurança

### Kill Switch

`WAHA_EXPERIMENTAL_ENABLED=false` bloqueia:

- criação pela API;
- aprovação/retry;
- envio no worker;
- status da UI mostra ambiente desativado.

### Tenant

Todas as APIs humanas usam:

```text
resolveEscolaIdForUser
user_has_role_in_school
```

Destinatários internos são carregados por `school_id`, não por dados enviados pelo client.

### Roles

Uso WhatsApp:

```text
admin
admin_escola
staff_admin
direcao
diretoria
secretaria
financeiro
admin_financeiro
secretaria_financeiro
```

Gestão de sessão:

```text
admin
admin_escola
direcao
diretoria
```

Financeiro:

```text
admin
admin_escola
direcao
diretoria
financeiro
admin_financeiro
secretaria_financeiro
```

Sem acesso:

```text
aluno
professor
encarregado
```

### Aprovação

Exigem aprovação:

- `finance_charge`;
- `ai_generated_draft`;
- templates com `requires_approval=true`;
- mensagens `risk_level='high'`.

IA pode gerar rascunho, mas não envia, não aprova e não define `approved_by`.

### Credenciais

Bloqueado:

- envio direto do client para WAHA;
- `NEXT_PUBLIC_WAHA_API_KEY`;
- client definindo `approved_by`;
- client definindo `approved_at`;
- client definindo `provider_message_id`;
- client enviando `session_name`;
- senha permanente por WhatsApp.

## Fluxos Implementados

### Mensagem Individual

1. Usuário seleciona destinatário ou contato manual autorizado.
2. Backend valida role e tenant.
3. Backend resolve telefone real quando destinatário é aluno/professor.
4. Mensagem é criada em `communication_outbox`.
5. Se exigir aprovação, fica em `review_required`.
6. Se não exigir aprovação, fica em `queued`.

### Acesso do Aluno

Arquivo:

```text
apps/web/src/app/api/escola/[id]/admin/comunicacao/whatsapp/access/route.ts
```

Regra:

- usa link seguro de ativação;
- não envia senha permanente;
- bloqueia se aluno não tem `codigo_ativacao`;
- telefone vem dos campos de encarregado/responsável do aluno;
- status inicial é `queued`.

### Comunicados Controlados

O lote cria itens individuais na outbox. A UI limita seleção e o worker envia gradualmente com rate limit.

Mensagem operacional exibida:

```text
Serão criadas N mensagens na fila. O envio será processado gradualmente.
```

### Cobrança Financeira

Tipo:

```text
finance_charge
```

Regras:

- role financeira obrigatória;
- aprovação obrigatória;
- worker não envia sem `approved_by`;
- histórico fica em outbox/logs.

Integração direta a partir do Radar Financeiro pode usar a mesma API criando `messageType='finance_charge'` com `sourceModule='financeiro_radar'`.

## Estado de Deploy/Migration

Migrations WAHA/WhatsApp aplicadas e registradas no remoto:

```text
20260626130000:create_school_notification_providers
20260626153000:fix_ai_school_settings_select_policy
20260626210000:whatsapp_utility_v2
```

Observação:

- `20260626210000_whatsapp_utility_v2.sql` foi desenhada para ser idempotente onde possível;
- templates usam `ON CONFLICT (key) DO UPDATE`;
- policies são recriadas com `DROP POLICY IF EXISTS`;
- RPCs são `CREATE OR REPLACE`.

## Operação

### Ver status da escola

```sql
select school_id, provider_type, display_name, status, session_name, updated_at
from public.school_notification_providers
where provider_type = 'whatsapp_waha';
```

### Ver fila

```sql
select id, school_id, message_type, recipient_name, status, retry_count, next_retry_at, last_error, created_at
from public.communication_outbox
order by created_at desc
limit 50;
```

### Ver falhas

```sql
select id, school_id, message_type, recipient_name, retry_count, last_error, failed_at
from public.communication_outbox
where status = 'failed'
order by failed_at desc nulls last
limit 50;
```

### Ver logs

```sql
select outbox_id, school_id, event_type, provider_event_id, created_at
from public.communication_logs
order by created_at desc
limit 100;
```

### Reprocessar worker manualmente

Usar o endpoint existente do job:

```text
GET /api/jobs/outbox
POST /api/jobs/outbox
```

Headers:

```text
x-job-token: <OUTBOX_JOB_TOKEN ou CRON_SECRET>
```

## Validações Recomendadas

Sem iniciar build, validações mínimas:

```bash
git diff --check
pnpm -C apps/web typecheck
```

Secret scan recomendado:

```bash
rg -n "NEXT_PUBLIC_WAHA|WAHA_API_KEY=|WAHA_BASE_URL=|sendWaha|approved_by|/api/admin/ai/chat" apps/web/src || true

rg -n "postgresql://|service_role|WAHA_API_KEY=|WAHA_BASE_URL=|OPENAI_API_KEY=|GEMINI_API_KEY=|SUPABASE_SERVICE_ROLE|eyJhbGci|sk-|AIza" \
  --glob '!node_modules' \
  --glob '!.next' \
  --glob '!dist' \
  --glob '!build'
```

## Pendências Conhecidas

- Integração visual direta do Radar Financeiro para selecionar inadimplentes e pré-preencher `finance_charge`.
- Inbox completa para mensagens recebidas fica para V3.
- Ajustar webhook conforme o formato exato de assinatura/eventos configurado no WAHA em produção, se o provider usar nomes de headers diferentes.
- Monitoramento operacional dedicado para volume por escola e saúde da fila.

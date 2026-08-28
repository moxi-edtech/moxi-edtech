# Apply Diff — WhatsApp agent human gate

Ficheiros:

- `services/whatsapp-sales-agent/agent.mjs`
- `apps/web/src/app/api/jobs/waha-agent/eligibility/route.ts`

Correções:

- o estado do agente só confirma a mensagem após resposta/handoff/no-action confirmado;
- mensagens sem confirmação podem ser reprocessadas com segurança;
- a rota de elegibilidade HMAC é incluída no deployment da aplicação;
- o agente bloqueia apenas conversas atribuídas, resolvidas, arquivadas ou com resposta manual confirmada.

Validação: testes da política 4/4, `node --check` e verificação remota de DeepSeek/WAHA.

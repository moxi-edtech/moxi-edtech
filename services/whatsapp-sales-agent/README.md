# KLASSE WhatsApp Sales Agent

Agente autónomo separado do CRM e do portal escolar. Lê conversas comerciais da sessão WAHA, responde leads recebidos e mantém o estado operacional num ficheiro persistente.

## Segurança operacional

- Ignora grupos, broadcasts e mensagens enviadas pelo próprio número.
- Não inicia conversas frias.
- Respeita pedidos de opt-out.
- `AGENT_DRY_RUN=true` por defeito; mudar para `false` só depois de validar o piloto.
- Guarda apenas IDs e estado operacional; não grava o histórico completo.

## Variáveis

```text
WAHA_BASE_URL=https://waha-staging.klasse.ao
WAHA_API_KEY=...
WAHA_SESSION=klasse_school_f406f5a7a077431cb118297224925726
AI_PROVIDER=deepseek
AI_API_KEY=...
AI_MODEL=deepseek-v4-flash
AI_FALLBACK_PROVIDER=gemini
AI_FALLBACK_API_KEY=...
AI_FALLBACK_MODEL=gemini-2.5-flash
AGENT_DRY_RUN=true
BOOTSTRAP_STATE=true
POLL_MS=15000
FOLLOWUP_AFTER_HOURS=24
MAX_FOLLOWUPS=2
BUSINESS_HOURS=08h–17h30
CALL_WINDOWS=10h–12h, 13h–14h, 14h–15h, 16h–17h
STATE_FILE=/data/state.json
```

## Ativação

1. Copiar esta pasta para a VPS.
2. Criar `.env.agent` com as variáveis acima, sem o commitar.
3. Primeiro executar com `AGENT_DRY_RUN=true` e confirmar os rascunhos nos logs.
4. Para ativar o envio autónomo, mudar apenas `AGENT_DRY_RUN=false` e executar `docker compose -f docker-compose.sales-agent.yml up -d --build`.

### Factos operacionais

O agente não pode inventar horários de atendimento. `BUSINESS_HOURS` é o expediente geral (08h–17h30) e `CALL_WINDOWS` contém exclusivamente os intervalos que podem ser sugeridos para uma ligação de esclarecimento. Fora desses intervalos, a IA não deve sugerir horários.

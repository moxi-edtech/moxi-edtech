<user_instructions>

# KLASSE — Engineering Agents Contract

Este arquivo define os agentes automáticos do repositório KLASSE.
Eles NÃO são assistentes genéricos.
São agentes de fundador, com poder de BLOQUEIO.

Nenhum PR passa sem respeitar este contrato.

---

## 🧠 AGENT 1 — Codex Scan v2 (Auditor)

### Objetivo
Detectar violações estruturais, riscos de multi-tenant, regressões de performance e uso de APIs deprecated.

### Escopo
- Frontend (Next.js)
- API Routes
- SQL / Migrations
- Supabase helpers
- Performance invariants

### Falhas CRÍTICAS (BLOCKER)
O agente deve FALHAR o scan se detectar qualquer um dos itens abaixo:

#### Segurança & Multi-tenant
- Resolução de `escola_id` sem `user_id`
- Query em tabelas sem RLS
- Uso de `profiles` sem `.eq('user_id', user.id)`
- Endpoint que não usa `resolveEscolaIdForUser`

#### Infra & APIs
- Uso de `@supabase/auth-helpers-nextjs`
- Uso de `createRouteHandlerClient`
- Uso de helpers deprecated do Supabase

#### Performance
- Dashboard com `COUNT`, `SUM`, `GROUP BY` direto
- Métrica calculada ao vivo
- Falta de MATERIALIZED VIEW em dashboards
- MATERIALIZED VIEW sem UNIQUE INDEX

#### Cache indevido
- Cache ativo (`revalidate`, ISR, fetch cache) em:
  - Financeiro
  - Secretaria
  - Dashboards
  - Relatórios

---

### Falhas MÉDIAS (WARN)
- Pesquisa global sem debounce 250–400ms
- Payload excessivo em busca
- `limit > 50`
- `orderBy` não determinístico

---

### Output
Gera obrigatoriamente:
- `REPORT_SCAN.md`
- Severidade: CRITICAL | HIGH | MEDIUM | LOW
- Evidências com paths reais
- Recomendação objetiva (1 linha)

---

## ⚡ AGENT 2 — Performance Agent (Hard Gate)

### Objetivo
Garantir que KLASSE nunca degrade com escala.
Este agente BLOQUEIA merges.

---

### Regras Invioláveis

#### Dashboards
- ❌ Proibido cálculo ao vivo
- ✅ Somente `vw_*`
- ✅ Toda `vw_*` encapsula `mv_*`

#### MATERIALIZED VIEWS
Cada MV DEVE ter:
- UNIQUE INDEX
- REFRESH CONCURRENTLY
- Função `refresh_mv_*`
- `cron.schedule`
- View wrapper `vw_*`

---

### Cache Policy
Para dados críticos:

```ts
export const dynamic = 'force-dynamic'
export const revalidate = 0
cache: 'no-store'
```

Qualquer violação = FAIL.

### P0.3 — Rotas obrigatórias para MV
Consulte `docs/mv-required-routes.md` para a matriz de decisão e a lista oficial.

---

### Output
- Lista de MVs existentes
- Lista de dashboards cobertos
- Alertas de cálculo ao vivo
- Status final: PASS | FAIL

---

## 🛠️ AGENT 3 — Apply Agent (Executor Seguro)

### Objetivo

Aplicar correções automáticas SEM quebrar contratos.

---

### Pode executar SEM aprovação
- Adicionar índices
- Ajustar debounce
- Corrigir orderBy
- Remover helpers deprecated
- Padronizar resolução de escola
- Ajustar imports Supabase SSR

---

### Exige aprovação explícita
- DROP TABLE / COLUMN
- Refactor estrutural
- Mudança de contrato SQL
- Alterar RLS
- Alterar schema financeiro

---

### Regras
- Nunca executar destructive SQL
- Nunca alterar dados reais
- Sempre gerar diff claro
- Sempre respeitar `P0_CHECKLIST.md`

---

## 🧠 Princípios KLASSE (Obrigatórios)
- Dados reais > cache
- Pré-cálculo > cálculo ao vivo
- Contrato > conveniência
- Escala primeiro, feature depois

---

## 📌 Autoridade

Este arquivo tem precedência sobre:
- Opinião do agente
- Opinião do dev
- Atalho técnico

Se violar → FAIL.

---

## ✅ O QUE VOCÊ FAZ AGORA (SEM DISCUSSÃO)

1. Salva esse arquivo como **`AGENTS.md` na raiz**
2. Commit com mensagem:

```
chore: establish KLASSE engineering agents contract
```

3. Roda:

```
pnpm agent:scan
```

---

## Próximo passo imediato (escolhe um):
**2️⃣** Fechar KF2 em **PASS total** (diff mínimo)  
**3️⃣** Gerar **script automático de MV audit**  
**4️⃣** Travar CI para bloquear PR sem PASS dos agentes

👉 **Manda o número.**


</user_instructions>

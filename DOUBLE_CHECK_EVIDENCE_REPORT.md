# Relatório de Evidências: Admissão P0 V3 (Verificação)

Data: 12/01/2026
Autor: Gemini (Automated Verification)

## Resumo do Status

| Gate | Descrição | Status | Observação |
|---|---|---|---|
| **P0 — GATE 0** | Build / Typecheck / Lint | 🔴 **FAILED** | Erros de tipagem (Next.js 15 async params) e inconsistências em rotas novas. |
| **P0 — GATE 1** | Rotas Canônicas (Wizard/Radar) | ✅ **PASSED** | Wizard e Radar usam exclusivamente `/api/secretaria/admissoes/*`. |
| **P0 — GATE 2** | Rotas Legadas (Mitigação) | ✅ **PASSED** | Endpoint retorna 410; UI Financeiro trata erro; Link "Nova Matrícula" atualizado. |
| **P0 — GATE 3** | E2E Digital (Hydration) | ✅ **PASSED** | Wizard hidrata via `candidaturaId` e fetch em `/lead`. |
| **P0 — GATE 4** | Segurança (Auth & Storage) | ⚠️ **PARTIAL** | Auth check correto no código. **FALTA Policy do Storage** nas migrações. |
| **P0 — GATE 5** | UX & Draft Flush | ✅ **PASSED** | `saveDraft` forçado no "Avançar" e tratamento de erros com retry implementados. |

---

## Detalhamento das Evidências

### 🔴 P0 — GATE 0: Build + Regressões

**Comando:** `pnpm -w --filter web typecheck`
**Resultado:** Falha.

**Principais Erros Encontrados:**
1.  **Legacy Route (`candidaturas/[id]/confirmar`):** Erro de tipagem devido à mudança do Next.js 15 onde `params` agora é uma Promise.
    *   `Type '{ params: Promise<{ id: string; }>; }' is not assignable to type '{ params: { id: string; }; }'`
2.  **Novas Rotas (`admissoes/*`):** Erros de tipagem nos argumentos passados para `NextResponse` ou Zod.
    *   `Argument of type '"admissao_convert"' is not assignable...`
3.  **Componentes UI:** Vários erros de tipagem em componentes do portal secretaria e financeiro.

---

### ✅ P0 — GATE 1: Rotas Canônicas

**Verificação:** O Wizard e o Radar devem usar apenas o namespace `/api/secretaria/admissoes`.

*   **Evidência 1.1 (Wizard):** `apps/web/src/components/secretaria/AdmissaoWizardClient.tsx`
    *   L61, L172: `fetch('/api/secretaria/admissoes/draft', ...)`
    *   L140: `fetch('/api/secretaria/admissoes/config?escolaId=...')`
    *   L157: `fetch('/api/secretaria/admissoes/vagas?escolaId=...')`
    *   L260: `fetch('/api/secretaria/admissoes/convert', ...)`
    *   L284: `fetch('/api/secretaria/admissoes/save_for_later', ...)`
    *   L350: `fetch('/api/secretaria/admissoes/lead?id=...', ...)`
*   **Evidência 1.2 (Radar):** `apps/web/src/components/secretaria/AdmissoesRadarClient.tsx`
    *   L25: `fetch('/api/secretaria/admissoes/radar?escolaId=...')`
*   **Contra-prova:** Nenhuma chamada para `/api/secretaria/candidaturas` encontrada dentro destes componentes.

---

### ✅ P0 — GATE 2: Rotas Legadas

**Verificação:** Rotas antigas devem estar explicitamente desativadas ou redirecionando o fluxo.

*   **Evidência 2.1 (API 410):** `apps/web/src/app/api/secretaria/candidaturas/[id]/confirmar/route.ts`
    *   Retorna status `410` com mensagem JSON: `{ error: "DEPRECATED: use /api/secretaria/admissoes/convert via Wizard" }`.
*   **Evidência 2.2 (Financeiro UI):** `apps/web/src/app/financeiro/_components/CandidaturasInbox.tsx`
    *   L40-42: Trata explicitamente `res.status === 410` e lança erro amigável: "Este fluxo foi migrado. Use o Radar de Admissões...".
*   **Evidência 2.3 (Link Novo Aluno):** `apps/web/src/components/secretaria/MatriculasListClient.tsx`
    *   L420: Botão "Nova Matrícula" aponta para `href="/secretaria/matriculas/nova"` (Rota do Wizard).

---

### ✅ P0 — GATE 3: E2E Digital (Lead Hydration)

**Verificação:** O Wizard deve ser capaz de carregar dados de um lead existente.

*   **Evidência 3.1 (Logic):** `apps/web/src/components/secretaria/AdmissaoWizardClient.tsx`
    *   L346: Verifica `searchParams.get('candidaturaId')`.
    *   L350: Faz fetch em `/api/secretaria/admissoes/lead?id=${candId}`.
    *   L352: Hidrata estado inicial (`setInitialData`).
    *   L30 (Step1) & L132 (Step2): `useEffect` consome `initialData` para preencher formulários.

---

### ⚠️ P0 — GATE 4: Hardening de Segurança

**Verificação:** Autorização robusta e proteção de dados.

*   **Evidência 4.1 (API Lead - Auth Order):** `apps/web/src/app/api/secretaria/admissoes/lead/route.ts`
    *   ✅ **Correto:**
        1. Fetch apenas do `escola_id` (L23).
        2. `requireRoleInSchool` (L33).
        3. Fetch do documento completo (L41).
*   **Evidência 4.2 (Storage Policy):** 🔴 **FALTA**
    *   Busca por `fichas-inscricao` em `supabase/migrations/*.sql` retornou **ZERO resultados**.
    *   O bucket pode não estar protegido corretamente via Infrastructure-as-Code.

---

### ✅ P0 — GATE 5: UX & Flush do Draft

**Verificação:** Garantia de salvamento ao avançar etapas.

*   **Evidência 5.1 (Flush on Next):** `apps/web/src/components/secretaria/AdmissaoWizardClient.tsx`
    *   L85 (`handleNext`): Chama `await saveDraft()` antes de `onNext()`.
    *   Não depende apenas do debounce/autosave.
*   **Evidência 5.2 (Error Handling):**
    *   L96: Renderiza alerta de erro se `error` state não for nulo.
    *   Botão "Tentar Novamente" executa `saveDraft` explicitamente.

---

## Próximos Passos Obrigatórios (Blockers)

1.  **FIX GATE 0:** Corrigir erros de tipagem do Next.js 15 (`params` async) na rota legada e nos novos endpoints.
2.  **FIX GATE 4:** Criar migration SQL adicionando policies de storage para o bucket `fichas-inscricao` (restrito por `escola_id`).
# AGENT_INSTRUCTIONS.md — KLASSE (Admin Academic Setup) + Pilot Readiness Workflow

> **Versão:** 1.2  
> **Audiência:** Agentes de IA, devs externos, devs internos a fazer onboarding.  
> **Princípio:** Nada de "parece". PASS só com evidência executada. Ambiguidade é WARN, não PASS.

---

## OBJETIVO

Implementar e verificar, com evidência real, o core vital do "Portal do Admin → Configurações Acadêmicas" para piloto (3–5 escolas):

- Ano letivo + períodos (TRIMESTRES Angola)
- Currículo versionado por ano (draft/published)
- Turmas geradas a partir do currículo publicado
- Frequência (SSOT = `frequencias`)
- Avaliações/Notas trimestrais on-demand
- Boletim mínimo (view/RPC) com missing flags
- Status do setup (view/RPC) sem contagens bugadas

---

## REGRAS INVIOLÁVEIS

1. **DB/migrations primeiro.** Nunca criar endpoint antes de ter o schema correcto.
2. **RPCs/views de leitura antes de endpoints.** O endpoint só pode existir se a view/RPC já funciona.
3. **Endpoints antes de UI.** A UI não pode existir se o endpoint não retorna dados reais.
4. **PASS só com evidência.** SQL executado ou HTTP com resposta real. Screenshots não contam.
5. **Sem service role em endpoints humanos.** Sem excepção. Ver P0.4.
6. **Ambiguidade é WARN, não PASS.** Se o resultado é parcialmente correcto, é WARN com descrição do que falta.
7. **WARN acumulado bloqueia PILOT GO.** Mais de 3 WARNs activos = NO-GO até resolução.

---

## COMO LIDAR COM EVIDÊNCIA AMBÍGUA

Quando o resultado de uma verificação não é claramente PASS nem FAIL:

| Situação | Classificação | Acção |
|---|---|---|
| Query retorna resultado mas com dados suspeitos (ex: contagens a zero quando deveriam ter dados) | WARN | Descrever o que é suspeito + SQL alternativo para confirmar |
| Endpoint retorna 200 mas payload não tem todos os campos esperados | WARN | Listar campos em falta |
| Constraint existe mas não cobre todos os casos especificados | WARN | Descrever o gap |
| Evidência executada mas em ambiente de desenvolvimento, não staging/produção | WARN | Marcar como "DEV-ONLY, verificar em staging" |
| Teste de segurança retorna 403 mas por razão diferente da esperada | WARN | Investigar razão real do 403 |

**Formato de WARN:**
```
⚠️ WARN [P1.2] Currículo versionado — parcialmente correcto
Evidência: SELECT retorna 2 linhas, esperado 3 (trimestre 3 em falta)
Query executada: <SQL>
Resultado obtido: <output>
O que falta: periodos_letivos trimestre 3 não foi criado para escola_id=X
Acção necessária: executar migration ou verificar seed
Bloqueador para PILOT GO: SIM (sem trimestre 3, fecho de ano não funciona)
```

---

## COMO LIDAR COM REGRESSÕES

Se um item anteriormente marcado como PASS quebra numa verificação posterior:

1. Reclassificar imediatamente como `REGRESSION`.
2. Não apagar a evidência anterior — adicionar nova entrada com timestamp.
3. Bloquear merge de qualquer PR relacionado até resolução.
4. Formato:

```
🔴 REGRESSION [P0.2] Índices por escola_id — foi PASS em 2026-02-01, quebrou em 2026-02-10
Causa provável: migration X adicionou tabela nova sem índice
Evidência original: <referência>
Evidência actual: <SQL + output mostrando ausência>
Acção: criar índice em tabela Y, verificar migration Z
```

---

## ORDEM DE PRIORIDADE (NÃO ALTERAR SEM APROVAÇÃO)

```
P0 → P1 → P2 → P2.5
```

Nunca começar P1 com P0 em FAIL ou REGRESSION activo.  
Nunca começar P2 com P1 em FAIL ou REGRESSION activo.

---

# 🔴 P0 — MULTI-TENANT + INTEGRIDADE (BLOCKER)

### P0.1 — `escola_id` NOT NULL em tabelas core

**Verificar (SQL):**
```sql
SELECT table_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'escola_id'
  AND table_name IN (
    'escolas','anos_letivos','periodos_letivos',
    'cursos','classes','turmas','matriculas',
    'turma_disciplinas','curso_curriculos','curriculo_itens',
    'avaliacoes','notas',
    'frequencias',
    'financeiro_titulos','financeiro_cobrancas','pagamentos'
  );
```

**Esperado:** zero linhas com `is_nullable = 'YES'`.  
**Se falhar:** FAIL — identificar tabela(s) em falta e criar migration com `ALTER TABLE ... ALTER COLUMN escola_id SET NOT NULL`.

---

### P0.2 — Índices compostos começando por `escola_id`

**Verificar (SQL):**
```sql
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'alunos','matriculas','turmas','notas',
    'avaliacoes','frequencias','financeiro_titulos','pagamentos'
  )
ORDER BY tablename, indexname;
```

**Esperado:** pelo menos 1 índice composto por tabela crítica com `escola_id` como primeira coluna.  
**Índices mínimos obrigatórios:**
```sql
-- Exemplos do padrão esperado:
CREATE INDEX idx_notas_escola_matricula ON notas(escola_id, matricula_id);
CREATE INDEX idx_frequencias_escola_turma_data ON frequencias(escola_id, turma_id, data);
CREATE INDEX idx_avaliacoes_escola_turma_disc ON avaliacoes(escola_id, turma_disciplina_id, trimestre);
```

---

### P0.3 — RLS real por role

**Verificar (SQL):**
```sql
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'alunos','matriculas','turmas','notas',
    'avaliacoes','frequencias','pagamentos'
  );
```

**Esperado:** pelo menos 1 policy por tabela, cobrindo pelo menos `SELECT` com filtro por `escola_id`.

**Verificar (HTTP) — obrigatório, não apenas SQL:**

| Cenário | Endpoint | Esperado |
|---|---|---|
| Professor autentica e tenta ler alunos de outra escola | `GET /api/secretaria/alunos?escolaId=<outra>` | 403 |
| Aluno autentica e tenta ler dados de outro aluno | `GET /api/aluno/notas/<outro_matricula_id>` | 403 |
| Secretaria autentica e lê alunos da sua escola | `GET /api/secretaria/alunos` | 200 com dados corretos |

**Nota:** um 403 por razão diferente da RLS (ex: middleware de auth) conta como WARN, não PASS. Verificar a razão real.

---

### P0.4 — Service Role banida de endpoints humanos

**Verificar (repo):**
```bash
# Deve retornar zero resultados fora de jobs/workers/cron/provisioning
rg -n "SUPABASE_SERVICE_ROLE_KEY\|supabaseAdmin\|service_role" apps/web/src/app/api \
  | grep -v "jobs\|workers\|cron\|provisioning\|inngest"
```

**Esperado:** zero resultados.  
**Se encontrar:** FAIL — cada ocorrência é um risco de cross-tenant. Substituir por cliente autenticado com RLS.

---

# 🔴 P1 — CORE DO PORTAL CONFIG (BLOCKER)

### P1.1 — Ano letivo + Períodos (TRIMESTRE 1/2/3 Angola)

**Schema requerido:**
```sql
-- anos_letivos
id uuid PK, escola_id uuid NOT NULL, ano int NOT NULL,
dt_inicio date, dt_fim date, ativo boolean DEFAULT false
UNIQUE(escola_id, ano)

-- periodos_letivos
id uuid PK, escola_id uuid NOT NULL, ano_letivo_id uuid NOT NULL,
tipo text CHECK(tipo = 'TRIMESTRE'), numero int CHECK(numero IN (1,2,3)),
dt_inicio date, dt_fim date, trava_notas_em timestamptz
UNIQUE(escola_id, ano_letivo_id, tipo, numero)
```

**Verificar (SQL):**
```sql
SELECT al.ano, pl.tipo, pl.numero, pl.dt_inicio, pl.dt_fim, pl.trava_notas_em
FROM anos_letivos al
JOIN periodos_letivos pl ON pl.ano_letivo_id = al.id
WHERE al.escola_id = '<ESCOLA_ID>' AND al.ativo = true
ORDER BY pl.numero;
```

**Esperado:** exactamente 3 linhas com `tipo = 'TRIMESTRE'` e `numero IN (1, 2, 3)`.

---

### P1.2 — Currículo versionado por ano (draft/published)

**Schema requerido:**
```sql
-- curso_curriculos
id uuid PK, escola_id uuid NOT NULL, curso_id uuid NOT NULL,
ano_letivo_id uuid NOT NULL, version int NOT NULL,
status text CHECK(status IN ('draft','published','archived')),
created_at timestamptz, created_by uuid
UNIQUE(escola_id, curso_id, ano_letivo_id, version)
-- Garantir apenas 1 published por (escola, curso, ano):
UNIQUE(escola_id, curso_id, ano_letivo_id) WHERE status = 'published'

-- curriculo_itens
id uuid PK, escola_id uuid NOT NULL, curso_curriculo_id uuid NOT NULL,
classe_id uuid, disciplina_id uuid, aulas_semana int,
obrigatoria boolean, modelo_avaliacao jsonb
```

**Verificar (SQL):**
```sql
-- Nenhum curso deve ter mais de 1 published por (escola, curso, ano)
SELECT escola_id, curso_id, ano_letivo_id, COUNT(*) AS total_published
FROM curso_curriculos
WHERE escola_id = '<ESCOLA_ID>'
  AND ano_letivo_id = '<ANO_LETIVO_ID>'
  AND status = 'published'
GROUP BY escola_id, curso_id, ano_letivo_id
HAVING COUNT(*) > 1;
```

**Esperado:** zero linhas.

---

### P1.3 — Aplicar Preset → cria versão draft + itens

**Endpoint requerido:** `POST /api/escola/:id/admin/curriculo/apply-preset`

**Verificar (HTTP):**
```http
POST /api/escola/<ESCOLA_ID>/admin/curriculo/apply-preset
{ "preset": "ensino_medio_angola_2024", "ano_letivo_id": "<ANO_ID>" }

Esperado: 201 + { ok: true, curriculo_id: "<ID>", itens_criados: N }
```

**Verificar (SQL):**
```sql
SELECT cc.id, cc.status, cc.version, COUNT(ci.id) AS total_itens
FROM curso_curriculos cc
LEFT JOIN curriculo_itens ci ON ci.curso_curriculo_id = cc.id
WHERE cc.escola_id = '<ESCOLA_ID>'
GROUP BY cc.id, cc.status, cc.version
ORDER BY cc.created_at DESC
LIMIT 5;
```

**Esperado:** 1 linha com `status = 'draft'` e `total_itens > 0`.

---

### P1.4 — Publicar Currículo (trava published único)

**Endpoint requerido:** `POST /api/escola/:id/admin/curriculo/publish`

**Testes obrigatórios (executar em sequência):**

```
Teste 1 — Publicação normal:
  Input: curriculo_id com status='draft'
  Esperado: { ok: true } + status muda para 'published'
  SQL: SELECT status FROM curso_curriculos WHERE id='<ID>' → 'published'

Teste 2 — Segunda publicação (deve arquivar a primeira):
  Input: novo curriculo_id draft para o mesmo (escola, curso, ano)
  Esperado: { ok: true } + primeiro fica 'archived', segundo fica 'published'
  SQL: SELECT status, version FROM curso_curriculos WHERE escola_id='<ID>'
       ORDER BY version → v1: archived, v2: published

Teste 3 — Idempotência:
  Input: mesmo curriculo_id já publicado
  Esperado: { ok: true, message: "already published" } ou { ok: true, idempotent: true }
  Sem efeito secundário (nenhuma linha alterada)

Teste 4 — Tentativa sem permissão:
  Input: professor tenta publicar
  Esperado: 403
```

---

### P1.5 — Turmas + `turma_disciplinas` a partir do currículo published

**Endpoint requerido:** `POST /api/escola/:id/admin/turmas/generate`

**Verificar (SQL após gerar turma):**
```sql
SELECT td.turma_id, COUNT(*) AS disciplinas_vinculadas
FROM turma_disciplinas td
WHERE td.escola_id = '<ESCOLA_ID>'
  AND td.turma_id = '<TURMA_ID>'
GROUP BY td.turma_id;
```

**Esperado:** 1 linha com `disciplinas_vinculadas` igual ao número de `curriculo_itens` do currículo publicado para aquele curso/classe.

**Verificar consistência (deve ser zero):**
```sql
-- Turmas sem disciplinas vinculadas (sinal de bug no trigger/RPC)
SELECT t.id, t.nome
FROM turmas t
LEFT JOIN turma_disciplinas td ON td.turma_id = t.id
WHERE t.escola_id = '<ESCOLA_ID>'
  AND td.turma_id IS NULL;
```

---

### P1.6 — Setup Status sem bug de contagem

**View requerida:** `vw_escola_setup_status`

**Verificar (SQL):**
```sql
SELECT
  escola_id,
  has_ano_letivo_ativo,
  has_3_trimestres,
  has_curriculo_published,
  has_turmas_no_ano,
  percentage
FROM vw_escola_setup_status
WHERE escola_id = '<ESCOLA_ID>';
```

**Esperado:** 1 linha com todos os campos presentes e `percentage` em `{0, 25, 50, 75, 100}`.

**Verificar anti-JOIN-multiplicado:**
```sql
-- Se a view usa JOINs, verificar que os counts não estão inflados
-- Comparar contagem da view com contagem directa:
SELECT COUNT(*) FROM turmas WHERE escola_id = '<ESCOLA_ID>';
-- vs o que a view reporta em has_turmas_no_ano
```

---

# 🔴 P2 — OPERAÇÃO DIÁRIA (BLOCKER)

### P2.1 — Frequência (SSOT = `frequencias`)

**Constraint obrigatória:**
```sql
-- Por aula (recomendado):
UNIQUE(escola_id, matricula_id, aula_id)
-- Ou por dia (alternativo):
UNIQUE(escola_id, matricula_id, data, turma_disciplina_id)
```

**Verificar (SQL):**
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'frequencias';
```

**Teste de duplicidade (obrigatório):**
```
1. Lançar presença para aluno X, turma Y, data Z
2. Lançar exactamente a mesma presença novamente
Esperado: segundo lançamento retorna 200/204 sem criar duplicado (upsert)
SQL: SELECT COUNT(*) FROM frequencias WHERE matricula_id='X' AND data='Z' → 1 (não 2)
```

---

### P2.2 — Avaliações + Notas trimestrais on-demand

**Constraints obrigatórias:**
```sql
avaliacoes: UNIQUE(escola_id, turma_disciplina_id, ano_letivo, trimestre, tipo)
notas: UNIQUE(escola_id, matricula_id, avaliacao_id)
```

**Endpoint requerido:** `POST /api/professor/notas`

**Comportamento esperado:**
1. Se avaliação não existe para `(turma_disciplina_id, trimestre, tipo)` → criar on-demand.
2. Resolver `matricula_id` via `(turma_id, aluno_id)` — nunca aceitar `matricula_id` directamente do cliente sem validar que pertence à turma.
3. Upsert nota: `INSERT ... ON CONFLICT (escola_id, matricula_id, avaliacao_id) DO UPDATE`.

**Verificar (SQL após lançar nota):**
```sql
SELECT n.valor, a.trimestre, a.tipo, a.created_at
FROM notas n
JOIN avaliacoes a ON a.id = n.avaliacao_id
WHERE n.escola_id = '<ESCOLA_ID>'
ORDER BY n.created_at DESC
LIMIT 5;
```

---

### P2.3 — Boletim mínimo com missing flags

**View requerida:** `vw_boletim_por_matricula`

**Campos obrigatórios:** `disciplina_nome`, `nota_valor`, `missing_count`, `has_missing`, `trimestre`.

**Verificar (SQL):**
```sql
SELECT disciplina_nome, nota_valor, missing_count, has_missing
FROM vw_boletim_por_matricula
WHERE escola_id = '<ESCOLA_ID>'
  AND matricula_id = '<MATRICULA_ID>'
  AND trimestre = 1;
```

**Verificar consistência:**
```sql
-- has_missing deve ser TRUE quando missing_count > 0
SELECT COUNT(*) FROM vw_boletim_por_matricula
WHERE escola_id = '<ESCOLA_ID>'
  AND has_missing = false
  AND missing_count > 0;
-- Esperado: 0 (inconsistência seria bug na view)
```

---

# 🧩 WORKFLOW DE IMPLEMENTAÇÃO (ORDEM OBRIGATÓRIA)

```
FASE 1: DB + Migrations
  → anos_letivos, periodos_letivos
  → curso_curriculos, curriculo_itens
  → constraints, índices, RLS
  → frequencias SSOT
  → avaliacoes + notas com uniques
  → views: vw_escola_setup_status, vw_boletim_por_matricula

FASE 2: RPCs + Endpoints
  → GET  /api/escola/:id/admin/setup/status
  → POST /api/escola/:id/admin/ano-letivo/upsert
  → POST /api/escola/:id/admin/periodos-letivos/upsert-bulk
  → POST /api/escola/:id/admin/curriculo/apply-preset
  → POST /api/escola/:id/admin/curriculo/publish
  → POST /api/escola/:id/admin/turmas/generate
  → POST /api/professor/frequencias
  → POST /api/professor/notas

FASE 3: UI
  → ConfiguracoesPage (consome setup/status)
  → NeedsAcademicSetupBanner
  → Wizard 1/4: Ano Letivo + Períodos
  → Wizard 2/4: Frequência + Avaliação config
  → Wizard 3/4: Presets + draft curriculo
  → Wizard 4/4: Turmas
```

**Regra:** nunca avançar de fase sem evidência de que a fase anterior está completa.

---

# ✅ FORMATO DE SAÍDA DO AGENTE

### Por item verificado:

```
✅ PASS [P0.1] escola_id NOT NULL em tabelas core
Evidence: query executada em 2026-02-10 14:32 UTC
SQL: SELECT table_name, is_nullable FROM information_schema.columns WHERE ...
Result: 14 linhas, todas is_nullable='NO'
```

```
⚠️ WARN [P1.2] Currículo versionado — constraint parcial
Evidence: UNIQUE existe mas não cobre WHERE status='published'
SQL: SELECT indexdef FROM pg_indexes WHERE tablename='curso_curriculos'
Result: index sem partial condition
Acção: ALTER INDEX ou recriar com WHERE status='published'
Bloqueador para PILOT GO: SIM
```

```
🔴 FAIL [P2.1] Frequência — duplicidade possível
Evidence: INSERT duplicado cria 2 linhas
SQL: SELECT COUNT(*) FROM frequencias WHERE matricula_id='X' AND data='Z'
Result: 2
Acção: adicionar UNIQUE constraint + migrar dados duplicados existentes
```

```
🔴 REGRESSION [P0.4] Service Role em endpoint humano
Foi PASS em 2026-02-01. Encontrado em PR #127.
File: apps/web/src/app/api/secretaria/alunos/route.ts:34
Acção: substituir por cliente autenticado com RLS
```

### Sumário final obrigatório:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PILOT READINESS: GO / NO-GO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASS:      X itens
WARN:      Y itens (listar)
FAIL:      Z itens (listar)
REGRESSION: W itens (listar)

BLOCKERS ACTIVOS:
  - [P0.4] Service Role em 2 endpoints
  - [P1.4] Publish sem arquivar anterior

WARNS ACTIVOS:
  - [P1.2] Constraint parcial (não bloqueia se resolvido em 48h)

DECISÃO: NO-GO
Razão: 2 BLOCKERs activos. Resolver antes de activar piloto.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## REGRA FINAL

Nada de "parece funcionar". Nada de "deve estar correcto".  
PASS só com evidência executada (SQL com output real / HTTP com response real / log de produção).  
Ambiguidade é WARN. WARN acumulado (> 3) é NO-GO.
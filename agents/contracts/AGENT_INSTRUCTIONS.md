# AGENT_INSTRUCTION.md — KLASSE (Admin Academic Setup) + Pilot Readiness Workflow

## OBJETIVO
Implementar e verificar, com evidência real, o core vital do "Portal do Admin → Configurações Acadêmicas" para piloto (3–5 escolas):
- Ano letivo + períodos (TRIMESTRES Angola)
- Currículo versionado por ano (draft/published)
- Turmas geradas a partir do currículo publicado
- Frequência (SSOT = frequencias)
- Avaliações/Notas trimestrais on-demand
- Boletim mínimo (view/RPC) com missing flags
- Status do setup (view/RPC) sem contagens bugadas

O agente NÃO assume nada. Sem evidência explícita = FAIL ou WARN.

---

## REGRA GERAL (NÃO QUEBRAR)
1) DB/migrations primeiro (SSOT, constraints, índices).
2) RPCs/views de leitura (status, boletim, frequencia).
3) Endpoints (Admin/Professor).
4) UI (ConfigPage + Wizard 1-4).
5) Testes E2E manuais com evidência (SQL + HTTP).

---

# 🔥 ORDEM DE PRIORIDADE DE IMPLEMENTAÇÃO (NÃO ALTERAR)

## 🔴 P0 — MULTI-TENANT + INTEGRIDADE (BLOCKER)
### P0.1 — escola_id NOT NULL em tabelas core
**Verificar (SQL):**
```sql
select table_name, is_nullable
from information_schema.columns
where table_schema='public'
  and column_name='escola_id'
  and table_name in (
    'escolas','anos_letivos','periodos_letivos',
    'cursos','classes','turmas','matriculas',
    'turma_disciplinas','curso_curriculos','curriculo_itens',
    'avaliacoes','notas',
    'frequencias', -- SSOT
    'financeiro_titulos','financeiro_cobrancas','pagamentos'
  );

Esperado: nenhum is_nullable='YES'.

P0.2 — índices começando por escola_id (tabelas grandes)

Verificar (SQL):

select tablename, indexname, indexdef
from pg_indexes
where schemaname='public'
  and tablename in ('alunos','matriculas','turmas','notas','avaliacoes','frequencias','financeiro_titulos','pagamentos')
order by tablename, indexname;

Esperado: pelo menos 1 índice composto por tabela crítica começando com escola_id.

P0.3 — RLS real por role (secretaria/professor/aluno/admin_escola)

Evidência (SQL policies):

select tablename, policyname, roles, cmd
from pg_policies
where schemaname='public'
  and tablename in ('alunos','matriculas','turmas','notas','avaliacoes','frequencias','pagamentos');

Evidência (HTTP):
	•	professor não lê alunos de outra escola (403)
	•	aluno lê só dados próprios (200) e não lê de outro (403)
	•	secretaria/admin_escola lê só da própria escola (200)

P0.4 — Service Role fora de endpoints humanos

Verificar (repo-wide):
	•	FAIL se SUPABASE_SERVICE_ROLE_KEY aparecer em apps/web/src/app/api/**/route.ts fora de jobs|workers|provisioning|cron.
Comandos:
	•	rg -n "SUPABASE_SERVICE_ROLE_KEY|supabaseAdmin|service_role" apps/web/src/app/api
	•	rg -n "createClient<Database>\(" apps/web/src/app/api

⸻

🔴 P1 — CORE DO PORTAL CONFIG (Admin Setup) (BLOCKER)

Aqui é onde teu wireframe vira realidade.

P1.1 — Ano letivo + Períodos (TRIMESTRE 1/2/3 Angola)

DB Required:
	•	anos_letivos(escola_id, ano, dt_inicio, dt_fim, ativo)
	•	periodos_letivos(escola_id, ano_letivo_id, tipo='TRIMESTRE', numero=1..3, dt_inicio, dt_fim, trava_notas_em)
Constraints:
	•	UNIQUE(escola_id, ano) em anos_letivos (ou por intervalo se preferir)
	•	UNIQUE(escola_id, ano_letivo_id, tipo, numero) em periodos_letivos
Evidência (SQL):

select al.ano, pl.tipo, pl.numero, pl.dt_inicio, pl.dt_fim, pl.trava_notas_em
from anos_letivos al
join periodos_letivos pl on pl.ano_letivo_id=al.id
where al.escola_id = '<ESCOLA_ID>' and al.ativo=true
order by pl.numero;

Esperado: 3 linhas TRIMESTRE (1,2,3).

P1.2 — Currículo versionado por ano (draft/published)

SSOT recomendado:
	•	curso_curriculos(id, escola_id, curso_id, ano_letivo_id, version int, status 'draft'|'published'|'archived', created_at, created_by)
	•	curriculo_itens(id, escola_id, curso_curriculo_id, classe_id, disciplina_id, aulas_semana int, obrigatoria bool, modelo_avaliacao jsonb)
Constraints vitais:
	•	UNIQUE(escola_id, curso_id, ano_letivo_id, version)
	•	UNIQUE publicado: (escola_id, curso_id, ano_letivo_id) WHERE status=‘published’
Evidência (SQL):

select escola_id, curso_id, ano_letivo_id, version, status, created_at
from curso_curriculos
where escola_id='<ESCOLA_ID>' and ano_letivo_id='<ANO_LETIVO_ID>'
order by curso_id, version desc;

P1.3 — Aplicar Preset → cria versão draft + itens

RPC/Endpoint requerido:
	•	POST /api/escola/:id/admin/curriculo/apply-preset
Evidência:
	•	cria 1 curso_curriculos(status='draft')
	•	cria N curriculo_itens
SQL:

select count(*) from curriculo_itens where escola_id='<ESCOLA_ID>' and curso_curriculo_id='<CURR_ID>';

P1.4 — Publicar Currículo (trava published único)

RPC/Endpoint requerido:
	•	POST /api/escola/:id/admin/curriculo/publish
Evidência:
	•	troca draft → published
	•	se já existir published, arquiva o anterior ou falha com mensagem clara
SQL:

select curso_id, count(*) 
from curso_curriculos
where escola_id='<ESCOLA_ID>' and ano_letivo_id='<ANO_LETIVO_ID>' and status='published'
group by curso_id having count(*)>1;

Esperado: 0 linhas.

Testes (Agent):
1) Attempt call via raw DB_URL/psql as postgres:
   Expect: ERROR permission denied admin_escola required
   => This is PASS (security gate working), not FAIL.

2) Run real test as authenticated admin_escola:
   - create draft v2 (insert curso_curriculos version=2 + backfill curso_matriz.curso_curriculo_id)
   - call RPC curriculo_publish(...)
   Expect:
     - returns ok=true
     - v2 status='published'
     - previous published becomes 'archived'
     - uniqueness holds: only 1 published per (escola,curso,ano)
     - turma_disciplinas rebuilt for turmas in that (curso,ano) only

3) Idempotency:
   - call RPC again same params
   Expect: ok=true + message contains 'idempotent'

P1.5 — Turmas: gerar + hidratar turma_disciplinas a partir do currículo published

Endpoint requerido:
	•	POST /api/escola/:id/admin/turmas/generate (gera turmas por curso/classe/turno/capacidade)
DB:
	•	turmas referenciando curso_id, classe_id, ano_letivo_id, turno
Evidência:
	•	 ao criar turma, turma_disciplinas preenchida (trigger/RPC) usando curriculo published
SQL:

select td.turma_id, count(*) as disciplinas
from turma_disciplinas td
where td.escola_id='<ESCOLA_ID>' and td.turma_id='<TURMA_ID>'
group by td.turma_id;

P1.6 — Setup Status (ConfigPage) sem bug de contagem (NUNCA JOIN multiplicando)

SSOT: view/RPC agregando por subqueries separadas.
Requisito:
	•	has_ano_letivo_ativo
	•	has_3_trimestres
	•	has_curriculo_published
	•	has_turmas_no_ano
	•	percentage = 0/25/50/75/100
Evidência (SQL):

select * from vw_escola_setup_status where escola_id='<ESCOLA_ID>';


⸻

🔴 P2 — OPERAÇÃO DIÁRIA (Professor/Aluno) (BLOCKER)

P2.1 — Frequência (SSOT = frequencias)

Modelo mínimo recomendado:
	•	registro por aula: UNIQUE(escola_id, matricula_id, aula_id)
OU registro por dia: UNIQUE(escola_id, matricula_id, data)
Exigir: rota do professor escreve em frequencias.
Evidência (SQL):

select indexname, indexdef
from pg_indexes
where schemaname='public' and tablename like 'frequencias%';

Teste: lançar 2x mesma aula/data → não duplica (upsert).
P2.2 — Avaliações + Notas trimestrais (on-demand) (sem placeholder)

Constraints vitais:
	•	avaliacoes UNIQUE(escola_id, turma_disciplina_id, ano_letivo, trimestre, tipo)
	•	notas UNIQUE(escola_id, matricula_id, avaliacao_id)
Endpoint requerido (professor):
	•	POST /api/professor/notas
	•	resolve matricula_id via (turma_id + aluno_id)
	•	resolve turma_disciplina_id
	•	cria avaliacao on-demand (trimestre atual) se não existir
	•	upsert nota (matricula_id + avaliacao_id)
Evidência:

select * from avaliacoes where escola_id='<ESCOLA_ID>' order by created_at desc limit 5;
select * from notas where escola_id='<ESCOLA_ID>' order by created_at desc limit 5;

P2.3 — Boletim mínimo (view/RPC) com missing flags

Requisito:
	•	por matrícula + trimestre:
	•	lista disciplinas (turma_disciplinas)
	•	agrega notas existentes
	•	calcula missing_count e has_missing
Evidência:

select * from vw_boletim_por_matricula
where escola_id='<ESCOLA_ID>' and matricula_id='<MATRICULA_ID>' and trimestre=1;


⸻

🧩 IMPLEMENTAÇÃO — WORKFLOW PARA O AGENTE (DB → API → UI)

FASE 1 — DB/MIGRATIONS (obrigatório antes de UI)
	1.	Criar/ajustar:

	•	anos_letivos, periodos_letivos
	•	curso_curriculos, curriculo_itens
	•	constraints/índices/rls necessários

	2.	Ajustar SSOT:

	•	garantir frequencias como SSOT (rota escreve nela + unique/upsert)

	3.	Notas:

	•	alinhar schema avaliacoes + notas com uniques corretos

	4.	Views/RPCs:

	•	vw_escola_setup_status
	•	vw_boletim_por_matricula
	•	vw_frequencia_resumo_aluno (ou RPC)

Output esperado: migrações novas em supabase/migrations/.

⸻

FASE 2 — ENDPOINTS (Admin + Professor)

Admin
	•	GET /api/escola/:id/admin/setup/status
	•	POST /api/escola/:id/admin/ano-letivo/upsert
	•	POST /api/escola/:id/admin/periodos-letivos/upsert-bulk
	•	POST /api/escola/:id/admin/curriculo/apply-preset
	•	POST /api/escola/:id/admin/curriculo/publish
	•	POST /api/escola/:id/admin/turmas/generate

Professor
	•	POST /api/professor/frequencias (SSOT)
	•	POST /api/professor/notas (on-demand)

Regra: endpoints humanos SEM service role.

⸻

FASE 3 — UI (Wireframe novo)

Tela 1 — ConfiguracoesPage
	•	consome setup/status
	•	renderiza cards (academic/financial/users)
	•	banner NeedsAcademicSetupBanner com:
	•	botão “Iniciar Assistente” → Wizard
	•	botão “Ver o que falta” → lista checks + links diretos

Wizard 1/4 — Ano Letivo + Períodos
	•	cria/edita ano letivo ativo
	•	gera 3 trimestres automaticamente com datas editáveis + trava_notas_em

Wizard 2/4 — Frequência + Avaliação
	•	fixa SSOT = frequencias (por aula, recomendado)
	•	modelo de avaliação (mínimo): “Simplificado” ou “Tradicional (MAC/NPP/PT)”
	•	grava config (pode ser tabela escola_avaliacao_config ou JSON em escolas.settings)

Wizard 3/4 — Presets
	•	aplica preset → cria currículo draft
	•	preview real (contagem de classes/disciplinas)

Wizard 4/4 — Turmas
	•	gera turmas por classe/turno/capacidade
	•	confirma → cria turmas + turma_disciplinas

⸻

✅ SAÍDA DO AGENTE (FORMATO OBRIGATÓRIO)

Para cada item:
	•	[P1.2] Currículo versionado por ano — PASS
Evidence: <SQL result + migration file + endpoint>
	•	[P2.2] Notas trimestrais on-demand — FAIL
Reason: endpoint insere em schema antigo
Evidence: <HTTP + query>

Ao final:
	•	PILOT READINESS: GO / NO-GO
	•	BLOCKERS: 
	•	WARNINGS: 

⸻

❌ REGRA FINAL

Nada de “parece”.
PASS só com evidência executada (SQL/HTTP/log).
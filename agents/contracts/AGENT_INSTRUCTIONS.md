# 🧠 AGENT INSTRUCTIONS — PILOT READINESS CHECK (KLASSE)

## OBJETIVO

Verificar end-to-end, com evidência real, se o KLASSE está pronto para piloto com 3–5 escolas, cobrindo Secretaria, Admin e Financeiro.

O agente NÃO assume nada.
Tudo que não tiver evidência explícita = FAIL ou WARN.

---

## ORDEM DE PRIORIDADE (NÃO ALTERAR)

### 🔴 P0 — SEGURANÇA, TENANT E CONSISTÊNCIA (BLOCKER)

#### P0.1 — Tenant Isolation (G0)

Verificar:
- Todas as tabelas core têm escola_id NOT NULL
- Índices iniciando por escola_id
- Triggers ou constraints impedem cross-tenant write

Evidência (SQL):

```
select table_name, is_nullable
from information_schema.columns
where column_name = 'escola_id'
  and table_schema = 'public'
  and table_name in (
    'alunos','matriculas','pagamentos','mensalidades',
    'notas','avaliacoes','presencas','frequencias','candidaturas'
  );
```

Resultado esperado: nenhum is_nullable = YES.

---

#### P0.2 — RLS REAL POR ROLE (não teórico)

Testar com usuários reais:
- secretaria
- professor
- aluno
- admin

Verificar:
- professor não acessa aluno fora da turma
- aluno só acessa próprios dados
- secretaria/admin acessam apenas da própria escola

Evidência:
- chamadas HTTP retornando 200/403 corretamente
- policies existentes e aplicadas

```
select tablename, policyname, roles, cmd
from pg_policies
where tablename in ('alunos','notas','avaliacoes','pagamentos');
```

---

#### P0.3 — Service Role fora do fluxo humano

Verificar:
- Nenhuma rota de secretaria/admin usa SUPABASE_SERVICE_ROLE_KEY
- Service role só em:
  - jobs
  - workers
  - provisioning

Evidência:
- grep no repo
- revisão das rotas API

---

### 🔴 P1 — FLUXOS CRÍTICOS END-TO-END (PILOTO NÃO SOBREVIVE SEM)

#### P1.1 — Candidatura → Matrícula

Verificar:
- Confirmar candidatura cria matrícula
- Reconfirmar é idempotente
- Ano letivo consistente

```
select c.id, c.status, m.id as matricula_id, m.ano_letivo
from candidaturas c
left join matriculas m
  on m.aluno_id = c.aluno_id
 and m.ano_letivo = c.ano_letivo
where c.id = '<CANDIDATURA_ID>';
```

---

#### P1.2 — Matrícula & Rematrícula

Verificar:
- 1 matrícula ativa por aluno/ano/escola
- Rematrícula em massa é idempotente
- Matrícula antiga vira transferido

```
select aluno_id, ano_letivo, count(*)
from matriculas
where status = 'ativa'
group by aluno_id, ano_letivo
having count(*) > 1;
```

---

#### P1.3 — Pagamento Manual (base para webhook)

Verificar E2E:
1. gerar mensalidade
2. confirmar pagamento
3. mensalidade atualiza
4. outbox dispara evento
5. audit log registrado

```
select * from pagamentos
order by created_at desc limit 5;

select * from mensalidades
where id = '<MENSALIDADE_ID>';

select * from outbox_events
where event_type = 'FINANCE_PAYMENT_CONFIRMED'
order by created_at desc;

select * from audit_logs
where action = 'FINANCE_PAYMENT_CONFIRMED'
order by created_at desc;
```

Idempotência obrigatória:

```
select count(*), count(distinct transacao_id_externo)
from pagamentos
where transacao_id_externo is not null;
```

---

### 🔴 P2 — OPERAÇÃO DIÁRIA (SECRETARIA / PROFESSOR)

#### P2.1 — Presenças / Frequências

Verificar:
- Qual tabela é SSOT (presencas OU frequencias)
- Lançar mesma aula 2x não duplica
- Unique key por partição existe

```
select indexname, indexdef
from pg_indexes
where tablename like 'frequencias%';
```

---

#### P2.2 — Notas & Boletim

Verificar:
- professor lança nota
- aluno consulta nota
- secretaria/admin consulta tudo
- existe consolidação mínima (média por disciplina/ano)

```
select count(*) from notas;
select count(*) from avaliacoes;
```

Se não houver view/RPC de consolidação → WARN explícito.

---

### 🟡 P3 — SUPORTE AO CRESCIMENTO (NÃO BLOQUEIA PILOTO, MAS REGISTRAR)

#### P3.1 — Transferência de Turma

Verificar:
- Existe endpoint explícito que:
  - encerra matrícula atual
  - cria nova matrícula
  - audita evento

Se só existe checagem, marcar FAIL OPERACIONAL.

---

#### P3.2 — Importação (Backfill)

Verificar:
- Importar mesmo CSV 2x não duplica
- Aprovação é idempotente
- Cursos/turmas criados apenas após aprovação

---

### 🟢 EVENTOS MÍNIMOS (OUTBOX)

Obrigatórios no piloto:
- AUTH_PROVISION_USER
- FINANCE_PAYMENT_CONFIRMED

Verificar:

```
select event_type, count(*)
from outbox_events
group by event_type;
```

Payload mínimo esperado:
- escola_id
- entidade principal (user_id ou pagamento_id)
- timestamp
- dedupe_key

---

## SAÍDA DO AGENTE (FORMATO OBRIGATÓRIO)

Para cada item:

```
[P0.1] Tenant Isolation — PASS
Evidence: <SQL / endpoint / log>

[P1.3] Pagamentos E2E — FAIL
Reason: mensalidade não atualiza após confirmação
Evidence: <query result>
```

Ao final:

```
PILOT READINESS: GO / NO-GO
BLOCKERS: <lista>
WARNINGS: <lista>
```

---

## REGRA FINAL (IMPORTANTE)

❌ Nada de “parece que”
❌ Nada de “acho que”
✅ Só PASS se houver evidência executada

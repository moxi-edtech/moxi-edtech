# Auditoria de Alocação Docente — KLASSE

Data: 2026-03-09
Escopo: modelagem SQL, RLS e RPCs de alocação docente, notas e horários.

## 1) A Tríade de Alocação (Professor × Disciplina × Turma)

### DIAGNÓSTICO ATUAL
- O modelo possui dois caminhos de vínculo docente:
  1) `public.turma_disciplinas` com `professor_id` opcional por linha `(escola_id, turma_id, curso_matriz_id)`.
  2) `public.turma_disciplinas_professores` com tripla explícita `(turma_id, disciplina_id, professor_id)`.
- Existe `UNIQUE (escola_id, turma_id, curso_matriz_id)` em `turma_disciplinas`, que impede duplicar a mesma disciplina curricular na mesma turma.
- Existe `UNIQUE (turma_id, disciplina_id)` em `turma_disciplinas_professores` (`uq_tdp_unique`), que impede múltiplos professores para a mesma disciplina/turma.
- Risco estrutural: o `UNIQUE` da tabela de junção **não inclui `escola_id`**; na prática os UUIDs reduzem colisão, mas o desenho não expressa invariável multi-tenant de forma explícita.

### O BURACO DE PRODUÇÃO
- Duplicidade semântica de fonte de verdade (`turma_disciplinas.professor_id` vs `turma_disciplinas_professores`) pode criar estado divergente (um professor no campo direto e outro na junção).
- Integridade cross-tenant da unicidade na junção fica implícita, não formalizada via chave composta.

### ARQUITETURA DE CURA
1. Definir SSOT única para alocação docente (recomendado: tabela de junção).
2. Em `turma_disciplinas`, tornar `professor_id` derivado/deprecado (ou removido em fase posterior).
3. Migrar unicidade para `UNIQUE (escola_id, turma_id, disciplina_id)` em `turma_disciplinas_professores`.
4. Adicionar FK composta para hard-tenant (`(turma_id, escola_id)` e `(professor_id, escola_id)`), espelhando padrão usado em `quadro_horarios`.

## 2) Chave do Cofre (RLS + RPC de Notas)

### DIAGNÓSTICO ATUAL
- RLS de `notas` exige somente:
  - `escola_id = current_tenant_escola_id()`
  - papel em `['admin_escola','secretaria','professor']`.
- A RLS **não valida** se o professor está alocado à disciplina/turma da nota.
- A proteção fina está dentro da RPC `public.lancar_notas_batch` (SECURITY DEFINER), que:
  - resolve `auth.uid()`;
  - confirma professor da escola;
  - verifica atribuição em `turma_disciplinas.professor_id` ou em `turma_disciplinas_professores`.
- A RPC permite exceção para perfis administrativos (`admin`, `secretaria`, etc.), por desenho.

### O BURACO DE PRODUÇÃO
- Qualquer endpoint/função que faça `INSERT/UPDATE` direto em `notas` (sem usar `lancar_notas_batch`) pode deixar professor autenticado atuar fora da sua pauta, porque a RLS atual é apenas por papel + escola.
- Security posture depende de disciplina operacional (“sempre chamar RPC”), não de política de dados auto-defensiva.

### ARQUITETURA DE CURA
1. Bloquear escrita direta em `notas` para `professor` na RLS (escrita só admin/secretaria).
2. Expor escrita docente somente via RPC `lancar_notas_batch` (SECURITY DEFINER) com validação da alocação.
3. Opcional hardening: trigger `BEFORE INSERT/UPDATE` em `notas` validando alocação do ator quando contexto for docente.
4. Auditoria obrigatória por nota/lote com `actor_id`, `turma_id`, `disciplina_id`, `avaliacao_id`.

## 3) Coesão com Horário (SSOT quadro_horarios)

### DIAGNÓSTICO ATUAL
- `quadro_horarios` está blindado para coerência de tenant:
  - FKs compostas `(id, escola_id)`;
  - trigger `trg_validate_quadro_tenant_cohesion` valida que turma/disciplina/professor/sala/versão pertencem à mesma escola.
- Também há guardrail de conflito de publicação (`trg_validate_quadro_published_conflicts`) para professor/sala no mesmo slot publicado.
- Porém não há validação explícita de “professor X está oficialmente alocado à disciplina Y da turma Z” no insert do quadro.
- A RPC de upsert de horários (`upsert_quadro_horarios_versao_atomic`) só grava itens; não cruza com tabela de alocação docente.

### O BURACO DE PRODUÇÃO
- Admin pode publicar horário com professor não oficialmente alocado à disciplina/turma.
- O horário passa no banco (tenant-cohesion OK), mas quebra governança pedagógica e cria conflitos posteriores na pauta de notas.

### ARQUITETURA DE CURA
1. Criar trigger de domínio em `quadro_horarios` para exigir vínculo em tabela de alocação docente:
   - validar `(escola_id, turma_id, disciplina_id, professor_id)` ativo.
2. Versionar alocação docente (vigência) para suportar substituição temporária sem perder trilha.
3. Na publicação de horário, rodar validação set-based e bloquear versão com itens órfãos.
4. Expor view de conformidade (`vw_quadro_alocacao_inconsistencias`) para secretaria/pedagógico.

## SQL de referência (produção) — núcleo de cura

```sql
-- 1) Unicidade multi-tenant explícita
ALTER TABLE public.turma_disciplinas_professores
  DROP CONSTRAINT IF EXISTS uq_tdp_unique;

ALTER TABLE public.turma_disciplinas_professores
  ADD CONSTRAINT uq_tdp_unique_escola
  UNIQUE (escola_id, turma_id, disciplina_id);

-- 2) Guardrail de alocação para horário
CREATE OR REPLACE FUNCTION public.trg_validate_quadro_docente_alocacao()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.professor_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.turma_disciplinas_professores tdp
    WHERE tdp.escola_id = NEW.escola_id
      AND tdp.turma_id = NEW.turma_id
      AND tdp.disciplina_id = NEW.disciplina_id
      AND tdp.professor_id = NEW.professor_id
  ) THEN
    RAISE EXCEPTION 'DOCENTE_NAO_ALOCADO: professor % não está alocado à disciplina % na turma %',
      NEW.professor_id, NEW.disciplina_id, NEW.turma_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_quadro_docente_alocacao ON public.quadro_horarios;
CREATE TRIGGER trg_validate_quadro_docente_alocacao
BEFORE INSERT OR UPDATE ON public.quadro_horarios
FOR EACH ROW EXECUTE FUNCTION public.trg_validate_quadro_docente_alocacao();

-- 3) RLS de escrita em notas: professor só via RPC (bloquear DML direto)
DROP POLICY IF EXISTS notas_insert ON public.notas;
DROP POLICY IF EXISTS notas_update ON public.notas;

CREATE POLICY notas_insert_admin_secretaria ON public.notas
FOR INSERT TO authenticated
WITH CHECK (
  escola_id = public.current_tenant_escola_id()
  AND public.user_has_role_in_school(escola_id, ARRAY['admin_escola','secretaria','admin'])
);

CREATE POLICY notas_update_admin_secretaria ON public.notas
FOR UPDATE TO authenticated
USING (
  escola_id = public.current_tenant_escola_id()
  AND public.user_has_role_in_school(escola_id, ARRAY['admin_escola','secretaria','admin'])
)
WITH CHECK (
  escola_id = public.current_tenant_escola_id()
  AND public.user_has_role_in_school(escola_id, ARRAY['admin_escola','secretaria','admin'])
);
```

> Nota: a policy acima força o professor a usar a RPC `lancar_notas_batch`, onde a validação fina de alocação já existe.

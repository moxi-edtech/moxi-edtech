begin;

-- ============================================================
-- PATCH P0: Frequencias (Índice + RLS + Unicidade)
-- ============================================================

-- 1) P0.2: Adiciona um índice composto para consultas eficientes
create index if not exists idx_frequencias_lookup
  on public.frequencias (escola_id, matricula_id, data desc);

-- 2) P2.1: Adiciona uma constraint UNIQUE para garantir que não haja duplicatas
--    (usamos 'data' porque 'aula_id' pode ser null)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_frequencias_escola_matricula_data' AND conrelid = 'public.frequencias'::regclass) THEN
        ALTER TABLE public.frequencias
        ADD CONSTRAINT uq_frequencias_escola_matricula_data
        UNIQUE (escola_id, matricula_id, data);
    END IF;
END $$;

-- 3) P0.3: Corrige as políticas RLS para serem role-aware

-- Drop das políticas antigas e permissivas
drop policy if exists "Tenant Isolation" on public.frequencias;
drop policy if exists "tenant_isolation" on public.frequencias;

-- RLS para SELECT
drop policy if exists frequencias_select on public.frequencias;
create policy frequencias_select
on public.frequencias
for select
to authenticated
using (
  escola_id = public.current_tenant_escola_id()
);

-- RLS para INSERT (professores e admins)
drop policy if exists frequencias_insert on public.frequencias;
create policy frequencias_insert
on public.frequencias
for insert
to authenticated
with check (
  escola_id = public.current_tenant_escola_id()
  and public.user_has_role_in_school(escola_id, array['admin_escola', 'secretaria', 'professor'])
);

-- RLS para UPDATE (professores e admins)
drop policy if exists frequencias_update on public.frequencias;
create policy frequencias_update
on public.frequencias
for update
to authenticated
using (
  escola_id = public.current_tenant_escola_id()
  and public.user_has_role_in_school(escola_id, array['admin_escola', 'secretaria', 'professor'])
);

-- RLS para DELETE (apenas admins)
drop policy if exists frequencias_delete on public.frequencias;
create policy frequencias_delete
on public.frequencias
for delete
to authenticated
using (
  escola_id = public.current_tenant_escola_id()
  and public.user_has_role_in_school(escola_id, array['admin_escola', 'secretaria'])
);

commit;

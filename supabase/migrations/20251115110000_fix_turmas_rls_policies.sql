-- Ajusta políticas RLS de public.turmas para considerar vínculo em escola_usuarios
-- e aplica FORCE ROW LEVEL SECURITY. Alinha com política já usada em classes.

DO $$
BEGIN
  IF to_regclass('public.turmas') IS NULL THEN
    RAISE NOTICE 'Tabela public.turmas não encontrada, ignorando migração.';
    RETURN;
  END IF;

  -- Garantir RLS ligado e forçado
  EXECUTE 'ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.turmas FORCE ROW LEVEL SECURITY';

  -- Remover políticas anteriores conhecidas (idempotente)
  EXECUTE 'DROP POLICY IF EXISTS "select_own_turmas" ON public.turmas';
  EXECUTE 'DROP POLICY IF EXISTS "insert_own_turmas" ON public.turmas';
  EXECUTE 'DROP POLICY IF EXISTS "update_own_turmas" ON public.turmas';
  EXECUTE 'DROP POLICY IF EXISTS "delete_own_turmas" ON public.turmas';
  EXECUTE 'DROP POLICY IF EXISTS "tenant_isolation" ON public.turmas';

  -- SELECT: membros da escola podem ver turmas da mesma escola
  EXECUTE 'CREATE POLICY "turmas select membros escola" ON public.turmas FOR SELECT
           USING (
             EXISTS (
               SELECT 1 FROM public.escola_usuarios eu
               WHERE eu.escola_id = turmas.escola_id
                 AND eu.user_id = (SELECT auth.uid())
             )
           )';

  -- INSERT: só inserir na própria escola
  EXECUTE 'CREATE POLICY "turmas insert membros escola" ON public.turmas FOR INSERT
           WITH CHECK (
             EXISTS (
               SELECT 1 FROM public.escola_usuarios eu
               WHERE eu.escola_id = turmas.escola_id
                 AND eu.user_id = (SELECT auth.uid())
             )
           )';

  -- UPDATE: apenas dentro da própria escola
  EXECUTE 'CREATE POLICY "turmas update membros escola" ON public.turmas FOR UPDATE
           USING (
             EXISTS (
               SELECT 1 FROM public.escola_usuarios eu
               WHERE eu.escola_id = turmas.escola_id
                 AND eu.user_id = (SELECT auth.uid())
             )
           )
           WITH CHECK (
             EXISTS (
               SELECT 1 FROM public.escola_usuarios eu
               WHERE eu.escola_id = turmas.escola_id
                 AND eu.user_id = (SELECT auth.uid())
             )
           )';

  -- DELETE: apenas dentro da própria escola
  EXECUTE 'CREATE POLICY "turmas delete membros escola" ON public.turmas FOR DELETE
           USING (
             EXISTS (
               SELECT 1 FROM public.escola_usuarios eu
               WHERE eu.escola_id = turmas.escola_id
                 AND eu.user_id = (SELECT auth.uid())
             )
           )';

  -- Grants típicos (RLS ainda se aplica)
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.turmas TO authenticated';
  EXECUTE 'GRANT SELECT ON public.turmas TO anon';
END$$;


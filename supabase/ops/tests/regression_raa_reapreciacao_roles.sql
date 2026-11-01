-- Run after 20271031002000_raa_reapreciacao_decision_permission_fix.sql
DO $$
BEGIN
 IF has_table_privilege('authenticated','public.reapreciacao_pedidos','DELETE') THEN
   RAISE EXCEPTION 'authenticated must not DELETE academic appeals';
 END IF;
 IF has_table_privilege('anon','public.reapreciacao_pedidos','SELECT') THEN
   RAISE EXCEPTION 'anon must not read academic appeals';
 END IF;
 IF has_table_privilege('authenticated','public.reapreciacao_pedidos','TRUNCATE') THEN
   RAISE EXCEPTION 'authenticated must not TRUNCATE academic appeals';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public'
     AND tablename='reapreciacao_pedidos' AND policyname='reapreciacao_pedidos_tenant') THEN
   RAISE EXCEPTION 'permissive FOR ALL policy is still active';
 END IF;
END $$;

SET ROLE authenticated;
SET request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
SET app.mock_school = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SET app.mock_role = 'secretaria';

DO $$
DECLARE affected integer;
BEGIN
  UPDATE public.reapreciacao_pedidos
  SET estado='deferido', decisao_motivo='Sem autoridade', 
      decidido_por=auth.uid(), decidido_em=now(), updated_at=now()
  WHERE id='00000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'secretaria bypassed the director decision'; END IF;
END $$;

DO $$
BEGIN
  BEGIN
    DELETE FROM public.reapreciacao_pedidos WHERE id='00000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'unsafe DELETE accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

INSERT INTO public.reapreciacao_pedidos
  (id,escola_id,estado,solicitado_por,prazo_em,resultado_publicado_em)
VALUES
  ('00000000-0000-4000-8000-000000000003',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','pendente',auth.uid(),
   now() + interval '1 day',now() - interval '1 hour');

DO $$
BEGIN
  BEGIN
    INSERT INTO public.reapreciacao_pedidos
      (id,escola_id,estado,solicitado_por,prazo_em,resultado_publicado_em)
    VALUES
      ('00000000-0000-4000-8000-000000000004',
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','deferido',auth.uid(),
       now() + interval '1 day',now() - interval '1 hour');
    RAISE EXCEPTION 'unsafe pre-decided INSERT accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- The generic role helper expands 'admin' to admin_financeiro. The
-- dedicated RAA policy must still deny that exact stored financial role.
SET request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
DO $$
DECLARE affected integer;
BEGIN
  UPDATE public.reapreciacao_pedidos
    SET estado='deferido', decisao_motivo='Financeiro não decide',
        decidido_por=auth.uid(), decidido_em=now(), updated_at=now()
    WHERE id='00000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'admin_financeiro decided academic appeal'; END IF;
  UPDATE public.raa_indisciplina_eventos
    SET estado='resolvido', decisao_motivo='Financeiro não decide disciplina',
        resolvido_por=auth.uid(), resolvido_em=now(), updated_at=now()
    WHERE id='00000000-0000-4000-8000-000000000005';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'admin_financeiro decided discipline'; END IF;
END $;

SET request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';
SET app.mock_role = 'diretor';
UPDATE public.reapreciacao_pedidos
SET estado='deferido', decisao_motivo='Decisão fundamentada pela direção',
    decidido_por=auth.uid(), decidido_em=now(), updated_at=now()
WHERE id='00000000-0000-4000-8000-000000000001';

DO $$
DECLARE affected integer;
BEGIN
  BEGIN
    UPDATE public.reapreciacao_pedidos
      SET solicitado_por='22222222-2222-4222-8222-222222222222'
      WHERE id='00000000-0000-4000-8000-000000000003';
    RAISE EXCEPTION 'identity mutation accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

UPDATE public.raa_indisciplina_eventos
SET estado='resolvido', decisao_motivo='Revisão documental validada pela direção',
    resolvido_por=auth.uid(), resolvido_em=now(), updated_at=now()
WHERE id='00000000-0000-4000-8000-000000000005';

RESET ROLE;
DO $$
BEGIN
 IF (SELECT estado FROM public.raa_indisciplina_eventos
     WHERE id='00000000-0000-4000-8000-000000000005') <> 'resolvido'
 THEN RAISE EXCEPTION 'director failed to decide discipline'; END IF;
 IF (SELECT estado FROM public.reapreciacao_pedidos
     WHERE id='00000000-0000-4000-8000-000000000001') <> 'deferido'
 THEN RAISE EXCEPTION 'director failed to decide the petition'; END IF;
 IF EXISTS (SELECT 1 FROM public.reapreciacao_pedidos
    WHERE id='00000000-0000-4000-8000-000000000004')
 THEN RAISE EXCEPTION 'direct INSERT created a pre-decided request'; END IF;
END $$;

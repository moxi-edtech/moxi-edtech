\set ON_ERROR_STOP on
-- Disposable PostgreSQL only. Include the P0 benchmark fixture + existing
-- school-wide guard tests, then assert real restrictive RLS across two polos.
\ir regression_command_center_polo_scope_p0.sql
RESET ROLE;
CREATE TABLE public.escolas (id uuid PRIMARY KEY);
INSERT INTO public.escolas(id) VALUES
 ('00000000-0000-4000-8000-0000000000a1'),
 ('00000000-0000-4000-8000-0000000000b2'),
 ('00000000-0000-4000-8000-0000000000c3');
CREATE UNIQUE INDEX ux_fixture_membership ON public.escola_users(escola_id,user_id);
\ir ../../migrations/20271022142000_cc003_canonical_polo_rls.sql

INSERT INTO public.escola_polos(id,escola_id,codigo,nome) VALUES
 ('00000000-0000-4000-8111-000000000001','00000000-0000-4000-8000-0000000000a1','p1','Polo fictício 1'),
 ('00000000-0000-4000-8111-000000000002','00000000-0000-4000-8000-0000000000a1','p2','Polo fictício 2'),
 ('00000000-0000-4000-8111-000000000003','00000000-0000-4000-8000-0000000000b2','p3','Polo fictício 3');
INSERT INTO public.escola_users(escola_id,user_id,papel,role) VALUES
 ('00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-0000000000d6','admin','staff');
INSERT INTO public.escola_user_polos(escola_id,user_id,polo_id) VALUES
 ('00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-0000000000d1','00000000-0000-4000-8111-000000000001'),
 ('00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-0000000000d3','00000000-0000-4000-8111-000000000002'),
 ('00000000-0000-4000-8000-0000000000b2','00000000-0000-4000-8000-0000000000d4','00000000-0000-4000-8111-000000000003');
INSERT INTO public.turmas(id,escola_id,classe_id,curso_id,ano_letivo_id,ano_letivo,nome,capacidade_maxima)
VALUES ('00000000-0000-4000-8f00-000000000099',
 '00000000-0000-4000-8000-0000000000a1',
 '00000000-0000-4000-8000-0000000000c1',NULL,
 '00000000-0000-4000-8000-000000000026',2026,'Polo 2 turmas',30);
INSERT INTO public.turmas(id,escola_id,classe_id,curso_id,ano_letivo_id,ano_letivo,nome,capacidade_maxima)
VALUES ('00000000-0000-4000-8f00-000000000098',
 '00000000-0000-4000-8000-0000000000a1',
 '00000000-0000-4000-8000-0000000000c1',NULL,
 '00000000-0000-4000-8000-000000000026',2025,'Polo 1 histórico',30);
INSERT INTO public.alunos(id,escola_id,nome,nome_completo) VALUES
 ('00000000-0000-4000-8a00-000000000888','00000000-0000-4000-8000-0000000000a1','Aluno P2','Aluno P2'),
 ('00000000-0000-4000-8a00-000000000777','00000000-0000-4000-8000-0000000000a1','Aluno ambíguo','Aluno ambíguo');
INSERT INTO public.matriculas(id,escola_id,ano_letivo,turma_id,aluno_id,status,ativo)
VALUES
 ('00000000-0000-4000-8b00-000000000888','00000000-0000-4000-8000-0000000000a1',2026,
  '00000000-0000-4000-8f00-000000000099','00000000-0000-4000-8a00-000000000888','ativo',true),
 ('00000000-0000-4000-8b00-000000000777','00000000-0000-4000-8000-0000000000a1',2026,
  '00000000-0000-4000-8f00-000000000099','00000000-0000-4000-8a00-000000000777','ativo',true),
 ('00000000-0000-4000-8c00-000000000777','00000000-0000-4000-8000-0000000000a1',2025,
  '00000000-0000-4000-8f00-000000000098','00000000-0000-4000-8a00-000000000777','ativo',true);
INSERT INTO public.escola_turma_polos(escola_id,turma_id,ano_letivo,polo_id) VALUES
 ('00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-0000000000f1',2026,'00000000-0000-4000-8111-000000000001'),
 ('00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8f00-000000000099',2026,'00000000-0000-4000-8111-000000000002'),
 ('00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8f00-000000000098',2025,'00000000-0000-4000-8111-000000000001'),
 ('00000000-0000-4000-8000-0000000000b2','00000000-0000-4000-8000-0000000000f2',2026,'00000000-0000-4000-8111-000000000003');
-- Before activation a school retains the preexisting tenant RLS.
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000d1';
DO $$
BEGIN
 IF (SELECT count(*) FROM public.turmas WHERE id='00000000-0000-4000-8f00-000000000099')<>1
 THEN RAISE EXCEPTION 'Legacy tenant changed before activation'; END IF;
END $$;
RESET ROLE;
-- Protection switch is private and controlled by service-role/postgres only.
INSERT INTO cc_security.enforced_schools(escola_id,enabled,activated_at)
 VALUES ('00000000-0000-4000-8000-0000000000a1',true,now());

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000d1';
DO $$
BEGIN
 IF (SELECT count(*) FROM public.turmas WHERE id='00000000-0000-4000-8000-0000000000f1')<>1
 OR (SELECT count(*) FROM public.turmas WHERE id='00000000-0000-4000-8f00-000000000099')<>0
 THEN RAISE EXCEPTION 'Polo 1 can see polo 2 turma'; END IF;
 IF (SELECT count(*) FROM public.matriculas WHERE id='00000000-0000-4000-8b00-000000000888')<>0
 THEN RAISE EXCEPTION 'Polo 1 can see polo 2 enrollment'; END IF;
 IF (SELECT count(*) FROM public.alunos WHERE id='00000000-0000-4000-8a00-000000000888')<>0
 THEN RAISE EXCEPTION 'Polo 1 can see polo 2 pupil'; END IF;
 IF (SELECT count(*) FROM public.alunos WHERE id='00000000-0000-4000-8a00-000000000777')<>0
 THEN RAISE EXCEPTION 'Ambiguous active polo enrollment is not denied'; END IF;
 IF (SELECT count(*) FROM public.alunos WHERE id='00000000-0000-4000-8100-000000000001')<>1
 THEN RAISE EXCEPTION 'Legitimate polo 1 pupil denied'; END IF;
END $$;
RESET ROLE;

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000d3';
DO $$
BEGIN
 IF (SELECT count(*) FROM public.turmas WHERE id='00000000-0000-4000-8000-0000000000f1')<>0
 OR (SELECT count(*) FROM public.turmas WHERE id='00000000-0000-4000-8f00-000000000099')<>1
 THEN RAISE EXCEPTION 'Polo 2 can see polo 1 turma'; END IF;
 IF (SELECT count(*) FROM public.alunos WHERE id='00000000-0000-4000-8a00-000000000888')<>1
 THEN RAISE EXCEPTION 'Legitimate polo 2 pupil denied'; END IF;
END $$;
RESET ROLE;
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000d6';
DO $$
BEGIN
 IF (SELECT count(*) FROM public.turmas WHERE id IN (
 '00000000-0000-4000-8000-0000000000f1','00000000-0000-4000-8f00-000000000099'))<>2
 THEN RAISE EXCEPTION 'School admin cannot see both authorised polos'; END IF;
 IF (SELECT count(*) FROM public.turmas WHERE escola_id='00000000-0000-4000-8000-0000000000b2')<>0
 THEN RAISE EXCEPTION 'School admin can see other school'; END IF;
END $$;
RESET ROLE;
-- Cannot inject cross-school user/polo association even as provisioning admin.
DO $$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN
 INSERT INTO public.escola_user_polos(escola_id,user_id,polo_id) VALUES
 ('00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-0000000000d1','00000000-0000-4000-8111-000000000003');
 EXCEPTION WHEN foreign_key_violation THEN blocked:=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Composite school/polo FK failed'; END IF;
END $$;

-- Force a permissive fixture UPDATE; the *restrictive* polo policy must
-- still prevent writes to rows of the other polo.
CREATE POLICY synthetic_turma_update_same_school ON public.turmas
  FOR UPDATE TO authenticated
  USING (public.has_access_to_escola_fast(escola_id))
  WITH CHECK (public.has_access_to_escola_fast(escola_id));
GRANT UPDATE(nome) ON public.turmas TO authenticated;
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000d1';
DO $
DECLARE affected integer; blocked boolean:=false;
BEGIN
  UPDATE public.turmas SET nome='Unauthorized P2 edit'
    WHERE id='00000000-0000-4000-8f00-000000000099';
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>0 THEN RAISE EXCEPTION 'Cross-polo UPDATE escaped restrictive RLS'; END IF;

  UPDATE public.turmas SET nome='P1 authorized edit'
    WHERE id='00000000-0000-4000-8000-0000000000f1';
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'Authorized polo UPDATE unexpectedly denied'; END IF;

  BEGIN
    UPDATE cc_security.enforced_schools SET enabled=false
      WHERE escola_id='00000000-0000-4000-8000-0000000000a1';
  EXCEPTION WHEN insufficient_privilege THEN blocked:=true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'Operator can disable private polo guard'; END IF;
  blocked:=false;
  BEGIN
    INSERT INTO public.escola_user_polos(escola_id,user_id,polo_id) VALUES (
      '00000000-0000-4000-8000-0000000000a1',
      '00000000-0000-4000-8000-0000000000d1',
      '00000000-0000-4000-8111-000000000002');
  EXCEPTION WHEN insufficient_privilege THEN blocked:=true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'Operator can escalate own polo membership'; END IF;
END $;
RESET ROLE;
-- Removal of an assignment takes effect in the next statement, no JWT refresh.
DELETE FROM public.escola_user_polos WHERE
  escola_id='00000000-0000-4000-8000-0000000000a1'
  AND user_id='00000000-0000-4000-8000-0000000000d1';
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000d1';
DO $
BEGIN
 IF (SELECT count(*) FROM public.turmas WHERE id='00000000-0000-4000-8000-0000000000f1')<>0
 THEN RAISE EXCEPTION 'Revoked user still sees prior polo'; END IF;
END $;
RESET ROLE;

SELECT 'CC-003 canonical polo RLS fixture PASS' AS verdict;

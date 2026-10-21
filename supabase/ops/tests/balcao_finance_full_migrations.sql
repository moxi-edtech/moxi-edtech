\set ON_ERROR_STOP on
-- Disposable synthetic identities, authentic migrations / RLS / payment RPCs.
INSERT INTO auth.users (id,email,aud,role,encrypted_password,email_confirmed_at) VALUES
('00000000-0000-4000-8000-000000000a13','fixture.guardian@example.invalid','authenticated','authenticated','fixture',now()),
('00000000-0000-4000-8000-000000000a14','fixture.secretaria@example.invalid','authenticated','authenticated','fixture',now()),
('00000000-0000-4000-8000-000000000a15','fixture.professor@example.invalid','authenticated','authenticated','fixture',now()),
('00000000-0000-4000-8000-000000000b14','fixture.other-school@example.invalid','authenticated','authenticated','fixture',now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.escolas (id,nome,status,onboarding_finalizado) VALUES
('00000000-0000-4000-8000-000000000a11','Synthetic Alpha','ativa',true),
('00000000-0000-4000-8000-000000000b11','Synthetic Beta','ativa',true)
ON CONFLICT (id) DO NOTHING;
-- Real aluno.profile_id FK targets public.profiles.user_id, NOT auth.users.
-- The four synthetic Auth users must therefore have genuine scoped profiles.
INSERT INTO public.profiles (user_id,nome,role,email,escola_id,current_escola_id) VALUES
('00000000-0000-4000-8000-000000000a13','Fixture Student Alpha','aluno','fixture.guardian@example.invalid','00000000-0000-4000-8000-000000000a11','00000000-0000-4000-8000-000000000a11'),
('00000000-0000-4000-8000-000000000a14','Fixture Secretary Alpha','secretaria','fixture.secretaria@example.invalid','00000000-0000-4000-8000-000000000a11','00000000-0000-4000-8000-000000000a11'),
('00000000-0000-4000-8000-000000000a15','Fixture Teacher Alpha','professor','fixture.professor@example.invalid','00000000-0000-4000-8000-000000000a11','00000000-0000-4000-8000-000000000a11'),
('00000000-0000-4000-8000-000000000b14','Fixture Secretary Beta','secretaria','fixture.other-school@example.invalid','00000000-0000-4000-8000-000000000b11','00000000-0000-4000-8000-000000000b11')
ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.escola_users (escola_id,user_id,role,papel) VALUES
('00000000-0000-4000-8000-000000000a11','00000000-0000-4000-8000-000000000a14','staff','secretaria'),
('00000000-0000-4000-8000-000000000a11','00000000-0000-4000-8000-000000000a15','staff','professor'),
('00000000-0000-4000-8000-000000000b11','00000000-0000-4000-8000-000000000b14','staff','secretaria')
ON CONFLICT DO NOTHING;
INSERT INTO public.alunos(id,escola_id,nome,profile_id,status) VALUES
('00000000-0000-4000-8000-000000000a12','00000000-0000-4000-8000-000000000a11','Fixture Learner Alpha','00000000-0000-4000-8000-000000000a13','ativo'),
('00000000-0000-4000-8000-000000000b12','00000000-0000-4000-8000-000000000b11','Fixture Learner Beta',NULL,'ativo')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.mensalidades
(id,escola_id,aluno_id,valor,valor_previsto,valor_pago_total,data_vencimento,status,mes_referencia,ano_referencia,ano_letivo)
VALUES
('00000000-0000-4000-8000-000000000a16','00000000-0000-4000-8000-000000000a11','00000000-0000-4000-8000-000000000a12',100,100,0,'2026-09-10','pendente',9,2026,'2026'),
('00000000-0000-4000-8000-000000000a17','00000000-0000-4000-8000-000000000a11','00000000-0000-4000-8000-000000000a12',200,200,0,'2026-10-10','pendente',10,2026,'2026'),
('00000000-0000-4000-8000-000000000b16','00000000-0000-4000-8000-000000000b11','00000000-0000-4000-8000-000000000b12',100,100,0,'2026-09-10','pendente',9,2026,'2026')
ON CONFLICT (id) DO NOTHING;

-- Student uploads proof; office approval does not equal settlement.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000a13',false);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000a13","escola_id":"00000000-0000-4000-8000-000000000a11"}',false);
SELECT public.aluno_submeter_comprovativo_pagamento('00000000-0000-4000-8000-000000000a16','fixture://only',100,'{"fixture":true}'::jsonb,'synthetic proof');
RESET ROLE;

-- Unauthorized teacher must fail inside SECURITY DEFINER, not merely on UI.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000a15',false);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000a15","escola_id":"00000000-0000-4000-8000-000000000a11"}',false);
DO $$
BEGIN
 BEGIN
  PERFORM public.validar_pagamento((SELECT id FROM public.pagamentos WHERE mensalidade_id='00000000-0000-4000-8000-000000000a16' LIMIT 1),true,NULL);
  RAISE EXCEPTION 'UNAUTHORIZED_TEACHER_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='UNAUTHORIZED_TEACHER_ACCEPTED' THEN RAISE; END IF;
  IF SQLERRM NOT LIKE '%forbidden%' AND SQLERRM NOT LIKE '%permission%' THEN RAISE; END IF;
 END;
END $$;
RESET ROLE;

-- User B must neither SELECT private rows nor validate school A finance.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000b14',false);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000b14","escola_id":"00000000-0000-4000-8000-000000000b11"}',false);
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.pagamentos WHERE escola_id='00000000-0000-4000-8000-000000000a11') THEN RAISE EXCEPTION 'CROSS_TENANT_DATA_LEAK'; END IF;
 BEGIN
  PERFORM public.validar_pagamento((SELECT id FROM public.pagamentos WHERE mensalidade_id='00000000-0000-4000-8000-000000000a16' LIMIT 1),true,NULL);
  RAISE EXCEPTION 'CROSS_TENANT_MUTATION_ALLOWED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='CROSS_TENANT_MUTATION_ALLOWED' THEN RAISE; END IF;
  IF SQLERRM NOT LIKE '%cross_tenant%' AND SQLERRM NOT LIKE '%not found%' AND SQLERRM NOT LIKE '%não encontrado%' THEN RAISE; END IF;
 END;
END $$;
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000a14',false);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000a14","escola_id":"00000000-0000-4000-8000-000000000a11"}',false);
DO $$
DECLARE payment_id uuid; result jsonb;
BEGIN
 SELECT id INTO payment_id FROM public.pagamentos WHERE mensalidade_id='00000000-0000-4000-8000-000000000a16' LIMIT 1;
 IF (SELECT status FROM public.pagamentos WHERE id=payment_id) <> 'pending' THEN RAISE EXCEPTION 'PROOF_PREMATURELY_SETTLED'; END IF;
 result := public.validar_pagamento(payment_id,true,NULL);
 IF (SELECT status FROM public.pagamentos WHERE id=payment_id) <> 'settled' THEN RAISE EXCEPTION 'PAYMENT_NOT_SETTLED'; END IF;
 IF result->'recibo'->>'ok' IS DISTINCT FROM 'true' OR NULLIF(result->'recibo'->>'doc_id','') IS NULL THEN
   RAISE EXCEPTION 'RECEIPT_NOT_ISSUED_BY_CANONICAL_SETTLEMENT';
 END IF;
 IF (SELECT count(*) FROM public.documentos_emitidos WHERE tipo='recibo' AND mensalidade_id='00000000-0000-4000-8000-000000000a16') <> 1 THEN
   RAISE EXCEPTION 'RECEIPT_NOT_IN_AUTHORITATIVE_DOCUMENTS_TABLE';
 END IF;
 IF (SELECT valor_pago_total FROM public.mensalidades WHERE id='00000000-0000-4000-8000-000000000a16') <> 100 THEN RAISE EXCEPTION 'BALANCE_NOT_AUTHORITATIVE'; END IF;
END $$;
RESET ROLE;

-- Reject another receipt, prove no payment, resubmit for same monthly request.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000a13',false);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000a13","escola_id":"00000000-0000-4000-8000-000000000a11"}',false);
SELECT public.aluno_submeter_comprovativo_pagamento('00000000-0000-4000-8000-000000000a17','fixture://reject',200,'{}'::jsonb,'synthetic second proof');
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000a14',false);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000a14","escola_id":"00000000-0000-4000-8000-000000000a11"}',false);
SELECT public.validar_pagamento((SELECT id FROM public.pagamentos WHERE mensalidade_id='00000000-0000-4000-8000-000000000a17' LIMIT 1),false,'Fixture proof illegible');
DO $$ BEGIN
 IF (SELECT valor_pago_total FROM public.mensalidades WHERE id='00000000-0000-4000-8000-000000000a17') <> 0 THEN RAISE EXCEPTION 'REJECTION_CHANGED_BALANCE'; END IF;
END $$;
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000a13',false);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000a13","escola_id":"00000000-0000-4000-8000-000000000a11"}',false);
SELECT public.aluno_submeter_comprovativo_pagamento('00000000-0000-4000-8000-000000000a17','fixture://resubmit',200,'{}'::jsonb,'synthetic resubmission');
RESET ROLE;
-- The concurrency test races approval/rejection on the most recent pending
-- proof of the same monthly request. It must not double-charge.
\echo FULL_RLS_FINANCE_FIXTURE_PASS

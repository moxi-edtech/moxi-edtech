-- Test after the original regression and the new migration on a disposable DB.
BEGIN;
INSERT INTO public.escolas(id,nome,status) VALUES ('00000000-0000-4000-8000-000000007101','Escola gratuidades','ativa');
INSERT INTO auth.users(id,email) VALUES ('00000000-0000-4000-8000-000000007103','gratuidade@documentos-klasse.test');
INSERT INTO public.escola_users(escola_id,user_id,role,papel) VALUES ('00000000-0000-4000-8000-000000007101','00000000-0000-4000-8000-000000007103','staff','secretaria');
INSERT INTO public.alunos(id,escola_id,nome) VALUES ('00000000-0000-4000-8000-000000007105','00000000-0000-4000-8000-000000007101','Aluno');
INSERT INTO public.anos_letivos(id,escola_id,ano) VALUES ('00000000-0000-4000-8000-000000007106','00000000-0000-4000-8000-000000007101',2026);
INSERT INTO public.matriculas(id,escola_id,aluno_id,session_id,status) VALUES ('00000000-0000-4000-8000-000000007108','00000000-0000-4000-8000-000000007101','00000000-0000-4000-8000-000000007105','00000000-0000-4000-8000-000000007106','concluido');
INSERT INTO public.historico_anos(id,escola_id,aluno_id,ano_letivo,matricula_id,snapshot_status) VALUES ('00000000-0000-4000-8000-000000007110','00000000-0000-4000-8000-000000007101','00000000-0000-4000-8000-000000007105',2026,'00000000-0000-4000-8000-000000007108','fechado');
INSERT INTO public.historico_disciplinas(id,historico_ano_id,disciplina_nome,nota_final) VALUES ('00000000-0000-4000-8000-000000007112','00000000-0000-4000-8000-000000007110','Matemática',15);
INSERT INTO public.servicos_escola(escola_id,codigo,nome,valor_base,exige_pagamento_antes_de_liberar,exige_aprovacao) VALUES
 ('00000000-0000-4000-8000-000000007101','DOC_DECLARACAO_NOTAS','Declaração com notas',0,false,false),
 ('00000000-0000-4000-8000-000000007101','DOC_CERTIFICADO_HABILITACOES','Certificado',0,false,true),
 ('00000000-0000-4000-8000-000000007101','DOC_DECLARACAO_FREQUENCIA','Declaração simples',0,true,false),
 ('00000000-0000-4000-8000-000000007101','DOC_BOLETIM_TRIMESTRAL','Boletim',0,false,false);
SET LOCAL ROLE authenticated;
DO $$
DECLARE s uuid := '00000000-0000-4000-8000-000000007101'; a uuid := '00000000-0000-4000-8000-000000007105'; y uuid := '00000000-0000-4000-8000-000000007106'; v jsonb; w jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims',json_build_object('sub','00000000-0000-4000-8000-000000007103','role','authenticated','escola_id',s)::text,true);
  v := public.documento_individual_acesso(s,a,y,'declaracao_notas');
  IF v->>'status' IS DISTINCT FROM 'free' OR (v->>'granted')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'FREE_DECLARATION_BLOCKED: %',v; END IF;
  v := public.documento_individual_acesso(s,a,y,'certificado');
  IF v->>'status' IS DISTINCT FROM 'approval' OR (v->>'granted')::boolean IS DISTINCT FROM false THEN RAISE EXCEPTION 'APPROVAL_NOT_EXPLICIT: %',v; END IF;
  v := public.documento_individual_solicitar(s,a,y,'certificado');
  w := public.documento_individual_solicitar(s,a,y,'certificado');
  IF v->>'pedido_id' IS NULL OR v->>'pedido_id' IS DISTINCT FROM w->>'pedido_id' OR v->>'pagamento_intent_id' IS NOT NULL THEN RAISE EXCEPTION 'FREE_APPROVAL_REQUEST_INVALID: %',v; END IF;
  IF public.documento_individual_acesso(s,a,y,'declaracao_frequencia')->>'reason' IS DISTINCT FROM 'TAXA_NAO_CONFIGURADA' THEN RAISE EXCEPTION 'MISCONFIGURED_PAID_SERVICE_ALLOWED'; END IF;
  IF public.documento_individual_acesso(s,a,y,'boletim_trimestral')->>'reason' IS DISTINCT FROM 'TAXA_NAO_CONFIGURADA' THEN RAISE EXCEPTION 'PAID_BOLETIM_BYPASSED'; END IF;
END; $$;
RESET ROLE;
UPDATE public.servico_pedidos SET status='granted' WHERE escola_id='00000000-0000-4000-8000-000000007101' AND servico_codigo='DOC_CERTIFICADO_HABILITACOES';
SET LOCAL ROLE authenticated;
DO $$
DECLARE v jsonb;
BEGIN
 v := public.documento_individual_acesso('00000000-0000-4000-8000-000000007101','00000000-0000-4000-8000-000000007105','00000000-0000-4000-8000-000000007106','certificado');
 IF v->>'status' IS DISTINCT FROM 'free' OR (v->>'granted')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'APPROVED_FREE_CERTIFICATE_BLOCKED: %',v; END IF;
END; $$;
ROLLBACK;

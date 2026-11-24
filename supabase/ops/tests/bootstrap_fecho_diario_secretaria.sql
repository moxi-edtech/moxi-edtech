-- Synthetic fixture, never production. Models the exact relevant catalog contracts.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE SCHEMA cron;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(auth.jwt()->>'sub','')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon,authenticated,service_role;
CREATE FUNCTION cron.schedule(text,text,text) RETURNS bigint LANGUAGE sql AS $$ SELECT 1::bigint $$;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;
CREATE TABLE public.escolas(id uuid PRIMARY KEY, tenant_type text NOT NULL);
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.escola_users(escola_id uuid REFERENCES public.escolas(id),user_id uuid REFERENCES auth.users(id),tenant_type text,papel text, UNIQUE(escola_id,user_id));
CREATE TABLE public.profiles(user_id uuid REFERENCES auth.users(id),deleted_at timestamptz);
CREATE TABLE public.audit_logs(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,escola_id uuid,actor_id uuid,action text,entity text,entity_id text,portal text,details jsonb);
CREATE TYPE public.evento_tipo AS ENUM ('financeiro.fecho.autorizado');
CREATE TYPE public.notificacao_prioridade AS ENUM ('info','aviso','urgente');
CREATE TABLE public.eventos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),escola_id uuid NOT NULL REFERENCES public.escolas(id),tipo public.evento_tipo NOT NULL,actor_id uuid,entidade_tipo text,entidade_id uuid,payload jsonb NOT NULL DEFAULT '{}');
CREATE TABLE public.notificacoes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),escola_id uuid NOT NULL REFERENCES public.escolas(id),evento_id uuid REFERENCES public.eventos(id),destinatario_id uuid REFERENCES auth.users(id),titulo text,corpo text,prioridade public.notificacao_prioridade,action_label text,action_url text,gatilho text,tipo text,agrupamento_chave text,UNIQUE(evento_id,destinatario_id));
CREATE TABLE public.fecho_caixa(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
 operador_id uuid NOT NULL REFERENCES auth.users(id), data_fecho date NOT NULL,
 valor_declarado_especie numeric NOT NULL,valor_declarado_tpa numeric NOT NULL,valor_declarado_transferencia numeric NOT NULL,
 valor_sistema_especie numeric,valor_sistema_tpa numeric,valor_sistema_transferencia numeric,diferenca_especie numeric,diferenca_tpa numeric,diferenca_transferencia numeric,
 status text NOT NULL DEFAULT 'draft',aprovado_por uuid REFERENCES auth.users(id),aprovado_em timestamptz,observacao_aprovador text,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),day_key date NOT NULL,declared_by uuid,declared_at timestamptz,
 declared_cash numeric(12,2) NOT NULL DEFAULT 0,declared_tpa numeric(12,2) NOT NULL DEFAULT 0,declared_transfer numeric(12,2) NOT NULL DEFAULT 0,declared_mcx numeric(12,2) NOT NULL DEFAULT 0,
 system_cash numeric(12,2) NOT NULL DEFAULT 0,system_tpa numeric(12,2) NOT NULL DEFAULT 0,system_transfer numeric(12,2) NOT NULL DEFAULT 0,system_mcx numeric(12,2) NOT NULL DEFAULT 0,system_calculated_at timestamptz,
 approved_by uuid,approved_at timestamptz,approval_note text,updated_by uuid,UNIQUE(escola_id,day_key),UNIQUE(escola_id,operador_id,data_fecho));
ALTER TABLE public.fecho_caixa ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.financeiro_fecho_declarar_e_snapshot(p_escola_id uuid,p_day_key date,p_cash numeric,p_tpa numeric,p_transfer numeric,p_mcx numeric) RETURNS public.fecho_caixa LANGUAGE sql AS $$ SELECT NULL::public.fecho_caixa $$;
CREATE FUNCTION public.financeiro_fecho_aprovar(p_escola_id uuid,p_fecho_id uuid,p_aprovacao text,p_justificativa text DEFAULT NULL,p_aprovacao_meta jsonb DEFAULT '{}'::jsonb) RETURNS public.fecho_caixa LANGUAGE sql AS $$ SELECT NULL::public.fecho_caixa $$;
CREATE FUNCTION public.declarar_fecho_caixa(p_escola_id uuid,p_valor_declarado_especie numeric,p_valor_declarado_tpa numeric,p_valor_declarado_transferencia numeric) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
CREATE FUNCTION public.aprovar_fecho_caixa(p_fecho_caixa_id uuid) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
CREATE TABLE public.pagamentos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),escola_id uuid NOT NULL REFERENCES public.escolas(id),day_key date NOT NULL,valor_pago numeric(12,2),metodo text,status text,updated_at timestamptz DEFAULT now());
CREATE INDEX ON public.pagamentos(escola_id,day_key);
CREATE TABLE public.official_document_exports(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),school_id uuid NOT NULL REFERENCES public.escolas(id),status text);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['alunos','candidaturas','matriculas','documentos_emitidos','servico_pedidos','mensalidades','notas','financeiro_lancamentos','financeiro_estornos','reapreciacao_pedidos','frequencias','aluno_encarregados','matricula_reclassificacoes','matricula_desistencia_sinalizacoes','matricula_desistencia_reativacoes','financeiro_pagamento_alocacoes','financeiro_pagamento_reversoes','financeiro_cobrancas','financeiro_reconciliacoes_mensalidades','pautas_oficiais','pauta_conclusoes','excecoes_pauta','professores','turmas','turma_disciplinas','turma_disciplinas_professores','quadro_horarios','horario_slots','horario_versoes','horario_eventos','aluno_falta_justificacoes','frequencia_status_periodo','rematricula_janelas','atendimentos_balcao','balcao_academic_operacoes','balcao_historic_recovery_requests','balcao_late_reenroll_authorizations','melhoria_nota_pedidos','virada_importacoes'] LOOP
 EXECUTE format('CREATE TABLE public.%I(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),escola_id uuid NOT NULL REFERENCES public.escolas(id),status text,updated_at timestamptz DEFAULT now())',t);
 END LOOP;
END $$;

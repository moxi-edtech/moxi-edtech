-- Synthetic and isolated PostgreSQL finance RPC contract ONLY.
-- Reproduces the target table columns, row locks, actor membership and RLS.
-- Not a replacement for the full Supabase migration chain / fiscal verification.
DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN
  CREATE ROLE authenticated NOLOGIN;
END IF; END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
 SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
CREATE TABLE public.escolas (id uuid primary key, nome text NOT NULL);
CREATE TABLE public.escola_users (
 escola_id uuid NOT NULL REFERENCES public.escolas(id),
 user_id uuid NOT NULL,
 papel text NOT NULL,
 PRIMARY KEY (escola_id,user_id)
);
CREATE OR REPLACE FUNCTION public.safe_auth_uid() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT auth.uid() $$;
CREATE OR REPLACE FUNCTION public.current_tenant_escola_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $$
 SELECT eu.escola_id FROM public.escola_users eu
 WHERE eu.user_id = auth.uid()
   AND eu.escola_id = NULLIF(
     NULLIF(current_setting('request.jwt.claims',true),'')::jsonb->>'escola_id',''
   )::uuid
 LIMIT 1
$$;
CREATE OR REPLACE FUNCTION public.user_has_role_in_school(
 p_escola_id uuid, p_roles text[]
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $$
 SELECT EXISTS(SELECT 1 FROM public.escola_users
    WHERE escola_id=p_escola_id AND user_id=auth.uid() AND papel=ANY(p_roles))
$$;
CREATE TABLE public.mensalidades(
 id uuid PRIMARY KEY,
 escola_id uuid NOT NULL REFERENCES public.escolas(id),
 aluno_id uuid NOT NULL,
 valor numeric(14,2) NOT NULL,
 valor_previsto numeric(14,2),
 valor_pago_total numeric(14,2) NOT NULL DEFAULT 0,
 status text NOT NULL DEFAULT 'pendente',
 data_pagamento_efetiva date,
 updated_at timestamptz,
 updated_by uuid
);
CREATE TABLE public.pagamentos(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 escola_id uuid NOT NULL REFERENCES public.escolas(id),
 mensalidade_id uuid REFERENCES public.mensalidades(id),
 valor_pago numeric(14,2) NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','settled','rejected')),
 settled_at timestamptz,
 settled_by uuid,
 updated_at timestamptz,
 meta jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE public.servico_pedidos(
 id uuid PRIMARY KEY,
 escola_id uuid NOT NULL REFERENCES public.escolas(id),
 status text NOT NULL CHECK (status IN ('pending_payment','granted','canceled'))
);
CREATE TABLE public.pagamento_intents(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 escola_id uuid NOT NULL REFERENCES public.escolas(id),
 servico_pedido_id uuid REFERENCES public.servico_pedidos(id),
 status text NOT NULL CHECK (status IN ('draft','pending','settled','failed','canceled')),
 settled_at timestamptz,
 meta jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE public.documentos_emitidos(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 mensalidade_id uuid NOT NULL,
 escola_id uuid NOT NULL REFERENCES public.escolas(id),
 tipo text NOT NULL DEFAULT 'recibo'
);
-- Test-only receipt seam. The production fiscal emit function is not modified.
CREATE OR REPLACE FUNCTION public.emitir_recibo(p_mensalidade_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE v_id uuid;
BEGIN
 INSERT INTO public.documentos_emitidos (mensalidade_id,escola_id)
 SELECT m.id,m.escola_id FROM public.mensalidades m WHERE m.id=p_mensalidade_id
 RETURNING id INTO v_id;
 RETURN jsonb_build_object('ok',true,'doc_id',v_id);
END; $$;

ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensalidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamento_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_emitidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servico_pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY documents_school_isolation ON public.documentos_emitidos FOR SELECT TO authenticated
 USING (escola_id=public.current_tenant_escola_id());
CREATE POLICY services_school_isolation ON public.servico_pedidos FOR SELECT TO authenticated
 USING (escola_id=public.current_tenant_escola_id());
CREATE POLICY pagamentos_school_isolation ON public.pagamentos FOR SELECT TO authenticated
 USING (escola_id = public.current_tenant_escola_id());
CREATE POLICY mensalidades_school_isolation ON public.mensalidades FOR SELECT TO authenticated
 USING (escola_id = public.current_tenant_escola_id());
CREATE POLICY intents_school_isolation ON public.pagamento_intents FOR SELECT TO authenticated
 USING (escola_id = public.current_tenant_escola_id());
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT SELECT ON public.pagamentos,public.mensalidades,public.pagamento_intents,
  public.documentos_emitidos,public.servico_pedidos TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
INSERT INTO public.escolas VALUES
 ('00000000-0000-4000-8000-000000000a11','synthetic-alpha'),
 ('00000000-0000-4000-8000-000000000b11','synthetic-beta');
INSERT INTO public.escola_users VALUES
 ('00000000-0000-4000-8000-000000000a11','00000000-0000-4000-8000-000000000a14','secretaria'),
 ('00000000-0000-4000-8000-000000000a11','00000000-0000-4000-8000-000000000a15','professor'),
 ('00000000-0000-4000-8000-000000000b11','00000000-0000-4000-8000-000000000b14','secretaria');
INSERT INTO public.mensalidades (id,escola_id,aluno_id,valor,valor_previsto) VALUES
 ('00000000-0000-4000-8000-000000000a16','00000000-0000-4000-8000-000000000a11','00000000-0000-4000-8000-000000000a12',100,100),
 ('00000000-0000-4000-8000-000000000a17','00000000-0000-4000-8000-000000000a11','00000000-0000-4000-8000-000000000a12',200,200),
 ('00000000-0000-4000-8000-000000000b16','00000000-0000-4000-8000-000000000b11','00000000-0000-4000-8000-000000000b12',100,100),
 ('00000000-0000-4000-8000-000000000a26','00000000-0000-4000-8000-000000000a11','00000000-0000-4000-8000-000000000a12',50,50),
 ('00000000-0000-4000-8000-000000000a36','00000000-0000-4000-8000-000000000a11','00000000-0000-4000-8000-000000000a12',200,200);
INSERT INTO public.pagamentos(id,escola_id,mensalidade_id,valor_pago) VALUES
 ('00000000-0000-4000-8000-000000000a18','00000000-0000-4000-8000-000000000a11','00000000-0000-4000-8000-000000000a16',100),
 ('00000000-0000-4000-8000-000000000a19','00000000-0000-4000-8000-000000000a11','00000000-0000-4000-8000-000000000a17',200),
 ('00000000-0000-4000-8000-000000000b18','00000000-0000-4000-8000-000000000b11','00000000-0000-4000-8000-000000000b16',100),
 ('00000000-0000-4000-8000-000000000a28','00000000-0000-4000-8000-000000000a11','00000000-0000-4000-8000-000000000a26',50),
 ('00000000-0000-4000-8000-000000000a37','00000000-0000-4000-8000-000000000a11','00000000-0000-4000-8000-000000000a36',200),
 ('00000000-0000-4000-8000-000000000a38','00000000-0000-4000-8000-000000000a11','00000000-0000-4000-8000-000000000a36',200);
INSERT INTO public.servico_pedidos VALUES
 ('00000000-0000-4000-8000-000000000a21','00000000-0000-4000-8000-000000000a11','pending_payment'),
 ('00000000-0000-4000-8000-000000000a22','00000000-0000-4000-8000-000000000a11','pending_payment'),
 ('00000000-0000-4000-8000-000000000a23','00000000-0000-4000-8000-000000000a11','pending_payment'),
 ('00000000-0000-4000-8000-000000000a24','00000000-0000-4000-8000-000000000a11','pending_payment');
INSERT INTO public.pagamento_intents(id,escola_id,servico_pedido_id,status) VALUES
 ('00000000-0000-4000-8000-000000000a31','00000000-0000-4000-8000-000000000a11','00000000-0000-4000-8000-000000000a21','pending'),
 ('00000000-0000-4000-8000-000000000a32','00000000-0000-4000-8000-000000000a11','00000000-0000-4000-8000-000000000a22','pending'),
 ('00000000-0000-4000-8000-000000000a33','00000000-0000-4000-8000-000000000a11','00000000-0000-4000-8000-000000000a23','failed'),
 ('00000000-0000-4000-8000-000000000a34','00000000-0000-4000-8000-000000000a11','00000000-0000-4000-8000-000000000a24','pending');

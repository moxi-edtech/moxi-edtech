-- Disposable PG17 fixture: deliberately no production credentials or data.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('role',current_setting('request.jwt.claim.role',true)) $$;
CREATE FUNCTION public.fixture_id(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid $$;
CREATE TABLE public.profiles(user_id uuid PRIMARY KEY,role text,escola_id uuid,deleted_at timestamptz);
CREATE TABLE public.escola_users(escola_id uuid,user_id uuid,papel text,role text);
CREATE TABLE public.anos_letivos(id uuid PRIMARY KEY,escola_id uuid,ativo boolean);
CREATE TABLE public.turmas(id uuid PRIMARY KEY,escola_id uuid,ano_letivo_id uuid,turno text,classe_id uuid,curso_id uuid,status_validacao text);
CREATE TABLE public.curso_curriculos(id uuid PRIMARY KEY,escola_id uuid,ano_letivo_id uuid,curso_id uuid,classe_id uuid,status text);
CREATE TABLE public.curso_matriz(id uuid PRIMARY KEY,escola_id uuid,curso_curriculo_id uuid,disciplina_id uuid,classe_id uuid,curso_id uuid,ativo boolean,entra_no_horario boolean);
CREATE TABLE public.turma_disciplinas(escola_id uuid,turma_id uuid,curso_matriz_id uuid,entra_no_horario boolean);
CREATE TABLE public.horario_slots(id uuid PRIMARY KEY,escola_id uuid,turno_id text,dia_semana integer,inicio time,fim time,is_intervalo boolean);
CREATE TABLE public.horario_versoes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),escola_id uuid NOT NULL,turma_id uuid NOT NULL,status text NOT NULL DEFAULT 'draft',publicado_em timestamptz,updated_at timestamptz DEFAULT now());
CREATE UNIQUE INDEX fixture_one_published ON public.horario_versoes(escola_id,turma_id) WHERE status='publicada';
CREATE TABLE public.quadro_horarios(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),escola_id uuid NOT NULL,turma_id uuid NOT NULL,disciplina_id uuid NOT NULL,professor_id uuid,sala_id uuid,slot_id uuid NOT NULL,versao_id uuid NOT NULL REFERENCES public.horario_versoes(id),UNIQUE(turma_id,slot_id,versao_id));
CREATE TABLE public.horario_eventos(escola_id uuid,turma_id uuid,versao_id uuid,tipo text,payload jsonb);
CREATE TABLE public.audit_logs(escola_id uuid,portal text,action text,entity text,entity_id text,acao text,tabela text,registro_id text,"before" jsonb,"after" jsonb);
CREATE FUNCTION public.current_tenant_escola_id() RETURNS uuid LANGUAGE sql STABLE AS $ SELECT escola_id FROM public.profiles WHERE user_id=auth.uid() $;
CREATE FUNCTION public.log_horario_event(uuid,uuid,uuid,text,jsonb) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ INSERT INTO public.horario_eventos VALUES($1,$2,$3,$4,$5) $$;
-- Install the trigger binding which already exists in production; migration replaces function.
CREATE FUNCTION public.trg_validate_quadro_published_conflicts() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$;
CREATE TRIGGER trg_validate_quadro_published_conflicts BEFORE INSERT OR UPDATE ON public.quadro_horarios FOR EACH ROW EXECUTE FUNCTION public.trg_validate_quadro_published_conflicts();

INSERT INTO public.anos_letivos VALUES(fixture_id(10),fixture_id(1),true),(fixture_id(11),fixture_id(1),false),(fixture_id(12),fixture_id(2),true);
INSERT INTO public.turmas VALUES
(fixture_id(20),fixture_id(1),fixture_id(10),'T',fixture_id(30),fixture_id(31),'ativo'),
(fixture_id(21),fixture_id(1),fixture_id(10),'M',fixture_id(30),fixture_id(31),'ativo'),
(fixture_id(22),fixture_id(1),fixture_id(11),'T',fixture_id(30),fixture_id(31),'ativo'),
(fixture_id(23),fixture_id(2),fixture_id(12),'T',fixture_id(30),fixture_id(31),'ativo'),
(fixture_id(24),fixture_id(1),fixture_id(10),'T',fixture_id(30),fixture_id(31),'ativo');
INSERT INTO public.curso_curriculos VALUES(fixture_id(40),fixture_id(1),fixture_id(10),fixture_id(31),fixture_id(30),'published'),(fixture_id(41),fixture_id(1),fixture_id(11),fixture_id(31),fixture_id(30),'published'),(fixture_id(42),fixture_id(2),fixture_id(12),fixture_id(31),fixture_id(30),'published');
INSERT INTO public.curso_matriz VALUES
(fixture_id(50),fixture_id(1),fixture_id(40),fixture_id(60),fixture_id(30),fixture_id(31),true,true),
(fixture_id(51),fixture_id(1),fixture_id(41),fixture_id(60),fixture_id(30),fixture_id(31),true,true),
(fixture_id(52),fixture_id(2),fixture_id(42),fixture_id(61),fixture_id(30),fixture_id(31),true,true);
INSERT INTO public.turma_disciplinas VALUES(fixture_id(1),fixture_id(20),fixture_id(50),true),(fixture_id(1),fixture_id(21),fixture_id(50),true),(fixture_id(1),fixture_id(22),fixture_id(51),true),(fixture_id(2),fixture_id(23),fixture_id(52),true),(fixture_id(1),fixture_id(24),fixture_id(50),true);
INSERT INTO public.horario_slots VALUES
(fixture_id(70),fixture_id(1),'tarde',1,'13:00','13:45',false),
(fixture_id(71),fixture_id(1),'matinal',1,'13:30','14:00',false),
(fixture_id(72),fixture_id(1),'matinal',1,'13:45','14:30',false),
(fixture_id(73),fixture_id(1),'tarde',1,'14:00','14:15',true),
(fixture_id(74),fixture_id(1),'tarde',2,'13:00','13:45',false),
(fixture_id(75),fixture_id(2),'tarde',1,'13:00','13:45',false);
INSERT INTO public.horario_versoes(id,escola_id,turma_id,status) VALUES
(fixture_id(80),fixture_id(1),fixture_id(20),'publicada'),
(fixture_id(81),fixture_id(1),fixture_id(20),'draft'),
(fixture_id(82),fixture_id(1),fixture_id(21),'draft'),
(fixture_id(83),fixture_id(1),fixture_id(22),'publicada'),
(fixture_id(84),fixture_id(2),fixture_id(23),'draft'),
(fixture_id(85),fixture_id(1),fixture_id(24),'draft');
INSERT INTO public.quadro_horarios(escola_id,turma_id,disciplina_id,professor_id,sala_id,slot_id,versao_id) VALUES
(fixture_id(1),fixture_id(20),fixture_id(60),fixture_id(90),fixture_id(91),fixture_id(70),fixture_id(80)),
(fixture_id(1),fixture_id(22),fixture_id(60),fixture_id(90),fixture_id(91),fixture_id(70),fixture_id(83));
INSERT INTO public.profiles VALUES(fixture_id(100),'admin',fixture_id(1),NULL),(fixture_id(101),'admin',fixture_id(2),NULL),(fixture_id(102),'aluno',fixture_id(1),NULL);
CREATE FUNCTION public.fixture_item(slot integer, professor integer DEFAULT NULL, sala integer DEFAULT NULL, disciplina integer DEFAULT 60) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$ SELECT jsonb_build_array(jsonb_build_object('slot_id',fixture_id(slot),'disciplina_id',fixture_id(disciplina),'professor_id',fixture_id(professor),'sala_id',fixture_id(sala))) $$;

INSERT INTO public.escola_users VALUES(fixture_id(1),fixture_id(100),'admin',NULL),(fixture_id(2),fixture_id(101),'admin',NULL);
-- One legacy mislabelled slot with an exact equivalent; no lesson time changes.
INSERT INTO public.horario_slots VALUES(fixture_id(76),fixture_id(1),'matinal',3,'08:15','09:00',false),(fixture_id(77),fixture_id(1),'tarde',3,'08:15','09:00',false);
INSERT INTO public.turmas VALUES(fixture_id(25),fixture_id(1),fixture_id(10),'M',fixture_id(30),fixture_id(31),'ativo');
INSERT INTO public.turma_disciplinas VALUES(fixture_id(1),fixture_id(25),fixture_id(50),true);
INSERT INTO public.horario_versoes(id,escola_id,turma_id,status) VALUES(fixture_id(88),fixture_id(1),fixture_id(25),'publicada');
INSERT INTO public.quadro_horarios(escola_id,turma_id,disciplina_id,slot_id,versao_id) VALUES(fixture_id(1),fixture_id(25),fixture_id(60),fixture_id(77),fixture_id(88));
-- Exercise the real API role privileges, not only the postgres owner.
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE ON public.horario_versoes,public.quadro_horarios,public.horario_slots,public.horario_eventos TO authenticated,anon;
ALTER TABLE public.horario_versoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quadro_horarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horario_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horario_eventos ENABLE ROW LEVEL SECURITY;
-- Fixture deliberately permits all authenticated timetable DML; actual triggers must
-- still reject direct official mutation. School authorization is tested on RPC.
CREATE POLICY fixture_versions ON public.horario_versoes TO authenticated USING(true) WITH CHECK(true);
CREATE POLICY fixture_rows ON public.quadro_horarios TO authenticated USING(true) WITH CHECK(true);
CREATE POLICY fixture_slots ON public.horario_slots TO authenticated USING(true) WITH CHECK(true);
CREATE POLICY fixture_events ON public.horario_eventos TO authenticated USING(true) WITH CHECK(true);

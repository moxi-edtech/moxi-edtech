BEGIN;

CREATE TYPE public.evento_tipo AS ENUM (
  'curriculo.published',
  'turmas.generated',
  'notas.lancadas',
  'pagamento.confirmado',
  'matricula.concluida',
  'aluno.arquivado',
  'documento.emitido'
);

CREATE TYPE public.notificacao_prioridade AS ENUM (
  'info',
  'aviso',
  'urgente'
);

CREATE TABLE public.eventos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  tipo public.evento_tipo NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text,
  created_at timestamptz DEFAULT now() NOT NULL,
  entidade_tipo text,
  entidade_id uuid
);

CREATE RULE eventos_no_update AS ON UPDATE TO public.eventos DO INSTEAD NOTHING;
CREATE RULE eventos_no_delete AS ON DELETE TO public.eventos DO INSTEAD NOTHING;

CREATE INDEX idx_eventos_escola_id ON public.eventos(escola_id);
CREATE INDEX idx_eventos_tipo ON public.eventos(tipo);
CREATE INDEX idx_eventos_created_at ON public.eventos(created_at DESC);
CREATE INDEX idx_eventos_entidade ON public.eventos(entidade_tipo, entidade_id);

COMMENT ON TABLE public.eventos IS
  'Log imutavel de eventos do sistema. Fonte de verdade para notificacoes e auditoria. Nunca apagar.';

CREATE TABLE public.notificacoes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  evento_id uuid NOT NULL REFERENCES public.eventos(id),
  destinatario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  corpo text,
  prioridade public.notificacao_prioridade NOT NULL DEFAULT 'info',
  action_label text,
  action_url text,
  lida boolean NOT NULL DEFAULT false,
  lida_em timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (evento_id, destinatario_id)
);

CREATE INDEX idx_notificacoes_destinatario ON public.notificacoes(destinatario_id, lida, created_at DESC);
CREATE INDEX idx_notificacoes_escola ON public.notificacoes(escola_id);
CREATE INDEX idx_notificacoes_evento ON public.notificacoes(evento_id);

COMMENT ON TABLE public.notificacoes IS
  'Inbox por utilizador. Criada automaticamente por triggers em eventos e entrega via Realtime.';

ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY eventos_escola_read ON public.eventos
FOR SELECT TO authenticated
USING (
  escola_id IN (
    SELECT escola_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY eventos_sistema_insert ON public.eventos
FOR INSERT TO authenticated
WITH CHECK (
  escola_id IN (
    SELECT escola_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY notificacoes_proprias_read ON public.notificacoes
FOR SELECT TO authenticated
USING (destinatario_id = auth.uid());

CREATE POLICY notificacoes_proprias_update ON public.notificacoes
FOR UPDATE TO authenticated
USING (destinatario_id = auth.uid())
WITH CHECK (destinatario_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_users_by_role(
  p_escola_id uuid,
  p_roles public.user_role[]
)
RETURNS TABLE (user_id uuid, role public.user_role)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.role
  FROM public.profiles p
  WHERE p.escola_id = p_escola_id
    AND p.role = ANY(p_roles)
    AND p.deleted_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.inserir_notificacao(
  p_escola_id uuid,
  p_evento_id uuid,
  p_destinatario_id uuid,
  p_titulo text,
  p_corpo text DEFAULT NULL,
  p_prioridade public.notificacao_prioridade DEFAULT 'info',
  p_action_label text DEFAULT NULL,
  p_action_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notificacoes (
    escola_id, evento_id, destinatario_id,
    titulo, corpo, prioridade,
    action_label, action_url
  ) VALUES (
    p_escola_id, p_evento_id, p_destinatario_id,
    p_titulo, p_corpo, p_prioridade,
    p_action_label, p_action_url
  )
  ON CONFLICT (evento_id, destinatario_id) DO NOTHING;

  PERFORM pg_notify(
    'notificacoes_novas',
    json_build_object(
      'destinatario_id', p_destinatario_id,
      'escola_id', p_escola_id,
      'titulo', p_titulo,
      'prioridade', p_prioridade
    )::text
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_evento_curriculo_published_fn(ev public.eventos)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_curriculo_nome text;
  v_destinatario record;
BEGIN
  v_curriculo_nome := ev.payload->>'curriculo_nome';

  FOR v_destinatario IN
    SELECT user_id FROM public.get_users_by_role(ev.escola_id, ARRAY['secretaria', 'admin']::public.user_role[])
  LOOP
    PERFORM public.inserir_notificacao(
      ev.escola_id,
      ev.id,
      v_destinatario.user_id,
      'Curriculo publicado: ' || COALESCE(v_curriculo_nome, 'Novo curriculo'),
      'O curriculo foi publicado. Pode agora gerar as turmas para o ano lectivo.',
      'aviso'::public.notificacao_prioridade,
      'Gerar turmas',
      '/secretaria/turmas?acao=gerar&curriculo=' || COALESCE(ev.entidade_id::text, '')
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_evento_turmas_generated_fn(ev public.eventos)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_professor record;
BEGIN
  FOR v_professor IN
    SELECT
      (t->>'professor_id')::uuid AS professor_id,
      t->>'turma_nome' AS turma_nome,
      t->>'turma_id' AS turma_id
    FROM jsonb_array_elements(ev.payload->'turmas') AS t
    WHERE t->>'professor_id' IS NOT NULL
  LOOP
    PERFORM public.inserir_notificacao(
      ev.escola_id,
      ev.id,
      v_professor.professor_id,
      'Foi associado a turma ' || COALESCE(v_professor.turma_nome, ''),
      'Pode ja aceder ao diario e preparar os planos de aula.',
      'info'::public.notificacao_prioridade,
      'Ver turma',
      '/professor/turmas/' || COALESCE(v_professor.turma_id, '')
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_evento_notas_lancadas_fn(ev public.eventos)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_destinatario record;
BEGIN
  FOR v_destinatario IN
    SELECT user_id FROM public.get_users_by_role(ev.escola_id, ARRAY['secretaria', 'admin']::public.user_role[])
  LOOP
    PERFORM public.inserir_notificacao(
      ev.escola_id,
      ev.id,
      v_destinatario.user_id,
      'Notas lancadas — ' || COALESCE(ev.payload->>'turma_nome', 'Turma'),
      COALESCE(ev.payload->>'professor_nome', 'Professor') || ' lancou notas. Disponivel para conferencia.',
      'info'::public.notificacao_prioridade,
      'Conferir notas',
      '/secretaria/pautas?turma=' || COALESCE(ev.payload->>'turma_id', '')
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_evento_pagamento_confirmado_fn(ev public.eventos)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_destinatario record;
  v_apto boolean;
BEGIN
  v_apto := (ev.payload->>'apto_matricula')::boolean;

  FOR v_destinatario IN
    SELECT user_id FROM public.get_users_by_role(ev.escola_id, ARRAY['secretaria']::public.user_role[])
  LOOP
    PERFORM public.inserir_notificacao(
      ev.escola_id,
      ev.id,
      v_destinatario.user_id,
      'Pagamento confirmado — ' || COALESCE(ev.payload->>'aluno_nome', 'Aluno'),
      CASE
        WHEN v_apto THEN COALESCE(ev.payload->>'aluno_nome', 'Aluno') || ' esta apto para matricula e servicos.'
        ELSE 'Pagamento de ' || COALESCE(ev.payload->>'valor_formatado', '—') || ' registado.'
      END,
      CASE
        WHEN v_apto THEN 'aviso'
        ELSE 'info'
      END::public.notificacao_prioridade,
      'Ver aluno',
      '/secretaria/alunos/' || COALESCE(ev.payload->>'aluno_id', '')
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_despachar_evento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  CASE NEW.tipo
    WHEN 'curriculo.published' THEN PERFORM public.trg_evento_curriculo_published_fn(NEW);
    WHEN 'turmas.generated' THEN PERFORM public.trg_evento_turmas_generated_fn(NEW);
    WHEN 'notas.lancadas' THEN PERFORM public.trg_evento_notas_lancadas_fn(NEW);
    WHEN 'pagamento.confirmado' THEN PERFORM public.trg_evento_pagamento_confirmado_fn(NEW);
    ELSE NULL;
  END CASE;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_despachar_evento
AFTER INSERT ON public.eventos
FOR EACH ROW
EXECUTE FUNCTION public.trg_despachar_evento();

COMMENT ON TRIGGER trg_despachar_evento ON public.eventos IS
  'Dispatcher central de eventos. Para adicionar novo tipo: adicionar no enum e criar a funcao handler.';

COMMIT;

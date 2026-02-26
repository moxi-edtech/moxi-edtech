CREATE OR REPLACE FUNCTION public.trg_evento_curriculo_published_fn(ev public.eventos)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_curriculo_nome text;
  v_destinatario record;
  v_roles public.user_role[];
BEGIN
  v_curriculo_nome := ev.payload->>'curriculo_nome';
  v_roles := CASE
    WHEN ev.actor_role = 'secretaria' THEN ARRAY['admin']::public.user_role[]
    ELSE ARRAY['secretaria', 'admin']::public.user_role[]
  END;

  FOR v_destinatario IN
    SELECT user_id FROM public.get_users_by_role(ev.escola_id, v_roles)
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

CREATE OR REPLACE FUNCTION public.trg_evento_notas_lancadas_fn(ev public.eventos)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_destinatario record;
  v_roles public.user_role[];
BEGIN
  v_roles := CASE
    WHEN ev.actor_role = 'secretaria' THEN ARRAY['admin']::public.user_role[]
    ELSE ARRAY['secretaria', 'admin']::public.user_role[]
  END;

  FOR v_destinatario IN
    SELECT user_id FROM public.get_users_by_role(ev.escola_id, v_roles)
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
  v_roles public.user_role[];
  v_action_url text;
BEGIN
  v_apto := (ev.payload->>'apto_matricula')::boolean;
  v_roles := CASE
    WHEN ev.actor_role = 'secretaria' THEN ARRAY['admin']::public.user_role[]
    ELSE ARRAY['secretaria', 'admin']::public.user_role[]
  END;

  FOR v_destinatario IN
    SELECT user_id, role
    FROM public.get_users_by_role(ev.escola_id, v_roles)
  LOOP
    v_action_url := CASE
      WHEN v_destinatario.role = 'admin'
        THEN '/escola/' || ev.escola_id::text || '/admin/alunos/' || COALESCE(ev.payload->>'aluno_id', '')
      ELSE '/secretaria/alunos/' || COALESCE(ev.payload->>'aluno_id', '')
    END;

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
      v_action_url
    );
  END LOOP;
END;
$$;

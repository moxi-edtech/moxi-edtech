CREATE OR REPLACE FUNCTION public.trg_evento_pagamento_confirmado_fn(ev public.eventos)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_destinatario record;
  v_apto boolean;
  v_action_url text;
BEGIN
  v_apto := (ev.payload->>'apto_matricula')::boolean;

  FOR v_destinatario IN
    SELECT user_id, role
    FROM public.get_users_by_role(ev.escola_id, ARRAY['secretaria', 'admin']::public.user_role[])
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

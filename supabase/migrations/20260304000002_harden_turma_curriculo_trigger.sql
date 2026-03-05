BEGIN;

CREATE OR REPLACE FUNCTION public.ensure_curriculo_published_for_turma()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_ano_letivo_id uuid;
  v_curriculo_id uuid;
  v_has_matriz boolean := false;
BEGIN
  IF NEW.curso_id IS NULL OR NEW.escola_id IS NULL THEN
    RAISE EXCEPTION
      'Turma inválida: curso_id e escola_id são obrigatórios.'
      USING ERRCODE = 'P0001';
  END IF;

  v_ano_letivo_id := NEW.ano_letivo_id;

  IF v_ano_letivo_id IS NULL AND NEW.ano_letivo IS NOT NULL THEN
    SELECT al.id
      INTO v_ano_letivo_id
      FROM public.anos_letivos al
     WHERE al.escola_id = NEW.escola_id
       AND al.ano = NEW.ano_letivo
     ORDER BY al.ativo DESC, al.created_at DESC
     LIMIT 1;
  END IF;

  IF v_ano_letivo_id IS NULL THEN
    RAISE EXCEPTION
      'Turma inválida: ano letivo não resolvido para escola % e ano %.',
      NEW.escola_id, NEW.ano_letivo
      USING ERRCODE = 'P0001';
  END IF;

  SELECT cc.id
    INTO v_curriculo_id
    FROM public.curso_curriculos cc
   WHERE cc.escola_id = NEW.escola_id
     AND cc.curso_id = NEW.curso_id
     AND cc.ano_letivo_id = v_ano_letivo_id
     AND cc.status = 'published'
     AND (cc.classe_id IS NULL OR NEW.classe_id IS NULL OR cc.classe_id = NEW.classe_id)
   ORDER BY cc.created_at DESC
   LIMIT 1;

  IF v_curriculo_id IS NULL THEN
    RAISE EXCEPTION
      'Não é permitido criar turma sem currículo publicado para este curso/ano letivo.'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM public.curso_matriz cm
     WHERE cm.escola_id = NEW.escola_id
       AND cm.curso_curriculo_id = v_curriculo_id
       AND (NEW.classe_id IS NULL OR cm.classe_id = NEW.classe_id)
  )
  INTO v_has_matriz;

  IF NOT v_has_matriz THEN
    RAISE EXCEPTION
      'Não é permitido criar turma com currículo publicado sem disciplinas ativas na matriz.'
      USING ERRCODE = 'P0001';
  END IF;

  NEW.ano_letivo_id := v_ano_letivo_id;
  RETURN NEW;
END;
$$;

COMMIT;

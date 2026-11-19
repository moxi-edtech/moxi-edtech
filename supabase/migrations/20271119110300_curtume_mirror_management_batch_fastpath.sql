-- Fast PK lookups for per-row mirror verification in grade triggers. No permissions or guards disabled.
BEGIN;
CREATE OR REPLACE FUNCTION public.curtume_2025_mfd_mirror_valid(
  p_escola_id uuid, p_matricula_id uuid, p_avaliacao_id uuid,
  p_valor numeric, p_metadata jsonb
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $fn$
  -- Fast-path: ordinary grades in any school never run the historic joins.
  SELECT CASE
    WHEN p_escola_id IS DISTINCT FROM '3744879f-2e19-4671-8995-78604302d8c5'::uuid
      OR p_metadata->>'tipo_nota' IS DISTINCT FROM 'HIST_FINAL'
      OR p_metadata->>'fonte' IS DISTINCT FROM 'historico_disciplinas'
      THEN false
    -- Only the trusted Postgres operator, inside the already-validated batch,
    -- may skip repeated source joins in per-row triggers.
    WHEN session_user='postgres' AND current_user='postgres'
      AND current_setting('klasse.curtume_2025_mirror',true)='on'
      THEN true
    ELSE EXISTS(
      SELECT 1 FROM public.historico_anos h
      JOIN public.matriculas m ON m.id=h.matricula_id AND m.escola_id=h.escola_id
      JOIN public.historico_disciplinas hd ON hd.historico_ano_id=h.id
        AND hd.id=(p_metadata->>'historico_disciplina_id')::uuid
      JOIN public.avaliacoes a ON a.id=p_avaliacao_id AND a.escola_id=h.escola_id
      JOIN public.turma_disciplinas td ON td.id=a.turma_disciplina_id AND td.escola_id=a.escola_id
      JOIN public.curso_matriz cm ON cm.id=td.curso_matriz_id AND cm.escola_id=td.escola_id
      JOIN public.turmas t ON t.id=td.turma_id AND t.escola_id=td.escola_id
      JOIN public.classes c ON c.id=t.classe_id AND c.escola_id=t.escola_id
      JOIN public.periodos_letivos pl ON pl.id=a.periodo_letivo_id AND pl.escola_id=a.escola_id
      WHERE h.escola_id=p_escola_id AND h.matricula_id=p_matricula_id
        AND h.id=(p_metadata->>'historico_ano_id')::uuid
        AND h.ano_letivo=2025 AND h.snapshot_status='fechado'
        AND h.resultado_final IN ('aprovado','reprovado','concluido')
        AND m.status='concluido' AND m.ativo=false
        AND m.status_fecho_origem='override_admin'
        AND m.aluno_id=h.aluno_id AND m.ano_letivo=2025
        AND m.session_id=h.ano_letivo_id AND m.turma_id=h.turma_id
        AND t.id=h.turma_id AND t.session_id=h.ano_letivo_id AND t.ano_letivo=2025
        AND cm.disciplina_id=hd.disciplina_id
        AND a.tipo='HIST_FINAL' AND a.ano_letivo=2025
        AND a.trimestre=3 AND pl.ano_letivo_id=h.ano_letivo_id
        AND pl.tipo='TRIMESTRE' AND pl.numero=3
        AND c.numero BETWEEN 1 AND 12
        AND a.nota_max=CASE WHEN c.numero<=6 THEN 10 ELSE 20 END
        AND hd.nota_final=p_valor AND p_valor BETWEEN 0 AND a.nota_max
        AND p_metadata->>'historico_ano_id'=h.id::text
        AND p_metadata->>'historico_disciplina_id'=hd.id::text
        AND p_metadata->>'documento'=hd.notas_detalhe->>'arquivo'
        AND hd.notas_detalhe->>'ano_letivo' IN ('2025','2025/2026')
        AND nullif(btrim(hd.notas_detalhe->>'arquivo'),'') IS NOT NULL
        AND nullif(btrim(hd.notas_detalhe->>'aba'),'') IS NOT NULL
        AND nullif(btrim(hd.notas_detalhe->>'linha'),'') IS NOT NULL
        AND hd.notas_detalhe->>'arquivo' !~* '(2023[-_/ ]?24|2023[-_/ ]?2024)'
        AND EXISTS (
          SELECT 1 FROM public.historico_snapshot_locks l
          WHERE l.escola_id=h.escola_id AND l.matricula_id=m.id
            AND l.historico_ano_id=h.id AND l.ano_letivo_id=m.session_id
            AND l.status='fechado'
        )
    )
  END;
$fn$;
COMMIT;

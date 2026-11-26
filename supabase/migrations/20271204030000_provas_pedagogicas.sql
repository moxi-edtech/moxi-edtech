BEGIN;
-- Facets are computed over authorized rows, ignoring only their own filter.
-- No exam content or teacher personal data is returned.
CREATE FUNCTION public.provas_faceta(p_escola uuid,p_categoria text,p_filtros jsonb,p_historico boolean)
RETURNS text[] LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH f AS (SELECT coalesce(p_filtros,'{}'::jsonb)-p_categoria AS v,
   (timezone('Africa/Luanda',now()))::date AS hoje),
 permitted AS MATERIALIZED (
   SELECT p.id,p.autor_id,p.ano_letivo_id,p.curso_matriz_id,p.tipo_prova,p.estado,
     p.classe,p.disciplina,p.ano_lectivo,p.trimestre,p.data_realizacao
   FROM public.provas_pedagogicas p CROSS JOIN f
   WHERE p.escola_id=p_escola
     AND provas_private.provas_papel(p_escola,ARRAY['admin','admin_escola','diretor','admin_secretaria','admin_secretario','staff_admin','admin_financeiro'])
     AND CASE WHEN p_historico THEN p.estado='arquivada' ELSE p.estado<>'arquivada' END
     AND (f.v->>'tipo' IS NULL OR p.tipo_prova::text=f.v->>'tipo')
     AND (f.v->>'estado' IS NULL OR p.estado::text=f.v->>'estado')
     AND (f.v->>'trimestre' IS NULL OR p.trimestre::text=f.v->>'trimestre')
     AND (f.v->>'ano' IS NULL OR p.ano_lectivo=f.v->>'ano')
     AND (f.v->>'classe' IS NULL OR p.classe=f.v->>'classe')
     AND (f.v->>'disciplina' IS NULL OR p.disciplina=f.v->>'disciplina')
     AND (f.v->>'autoria' IS NULL OR (f.v->>'autoria'='sistema' AND p.autor_id IS NULL) OR (f.v->>'autoria'='utilizador' AND p.autor_id IS NOT NULL))
     AND (f.v->>'periodo' IS NULL OR (f.v->>'periodo'='sem_data' AND p.data_realizacao IS NULL) OR (f.v->>'periodo'='futuras' AND p.data_realizacao>=f.hoje) OR (f.v->>'periodo'='passadas' AND p.data_realizacao<f.hoje))
     AND (f.v->>'professor' IS NULL OR p.id IN (SELECT x.id FROM public.provas_por_professor(p_escola,(f.v->>'professor')::uuid) x))
 ), academic AS MATERIALIZED (
   SELECT DISTINCT td.professor_id,td.turma_id,cm.disciplina_id
   FROM permitted p
   JOIN public.turma_disciplinas td ON td.escola_id=p_escola AND td.curso_matriz_id=p.curso_matriz_id
   JOIN public.turmas t ON t.id=td.turma_id AND t.escola_id=p_escola AND t.ano_letivo_id=p.ano_letivo_id AND t.session_id=p.ano_letivo_id
   JOIN public.curso_matriz cm ON cm.id=td.curso_matriz_id AND cm.escola_id=p_escola AND cm.classe_id=t.classe_id AND cm.curso_id=t.curso_id
   WHERE p_categoria='professor' AND (td.periodos_ativos IS NULL OR p.trimestre=ANY(td.periodos_ativos))
 ), docentes AS (
   SELECT pr.id AS id FROM permitted p JOIN public.professores pr ON pr.escola_id=p_escola AND pr.profile_id=p.autor_id WHERE p_categoria='professor'
   UNION
   SELECT a.professor_id FROM academic a
   UNION
   SELECT tdp.professor_id FROM academic a JOIN public.turma_disciplinas_professores tdp ON tdp.escola_id=p_escola AND tdp.turma_id=a.turma_id AND tdp.disciplina_id=a.disciplina_id
 ), valores AS (
   SELECT CASE p_categoria WHEN 'classe' THEN p.classe WHEN 'disciplina' THEN p.disciplina WHEN 'ano' THEN p.ano_lectivo
     WHEN 'tipo' THEN p.tipo_prova::text WHEN 'estado' THEN p.estado::text WHEN 'trimestre' THEN p.trimestre::text
     WHEN 'autoria' THEN CASE WHEN p.autor_id IS NULL THEN 'sistema' ELSE 'utilizador' END
     WHEN 'periodo' THEN CASE WHEN p.data_realizacao IS NULL THEN 'sem_data' WHEN p.data_realizacao>=f.hoje THEN 'futuras' ELSE 'passadas' END END AS valor
   FROM permitted p CROSS JOIN f WHERE p_categoria<>'professor'
   UNION
   SELECT pr.id::text FROM docentes d JOIN public.professores pr ON pr.escola_id=p_escola AND pr.id=d.id
 )
 SELECT ARRAY(SELECT DISTINCT valor FROM valores WHERE valor IS NOT NULL AND valor<>'' ORDER BY valor LIMIT 2001);
$$;
REVOKE ALL ON FUNCTION public.provas_faceta(uuid,text,jsonb,boolean) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.provas_faceta(uuid,text,jsonb,boolean) TO authenticated;
COMMIT;

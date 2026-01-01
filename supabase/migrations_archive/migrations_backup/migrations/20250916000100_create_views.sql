-- Create views safely with existence checks
DO $$ 
BEGIN
    -- Create view: escolas_view only if base tables exist
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'escolas'
    ) THEN
        -- Create or replace view: escolas_view
        CREATE OR REPLACE VIEW public.escolas_view AS
        SELECT
          e.id,
          e.nome,
          e.status,
          'Básico'::text as plano,
          NULL::timestamp as last_access,
          COALESCE(a.total_alunos, 0) as total_alunos,
          COALESCE(pf.total_professores, 0) as total_professores,
          e.endereco as cidade,
          NULL::text as estado
        FROM public.escolas e
        LEFT JOIN (
          SELECT escola_id, COUNT(*)::int as total_alunos
          FROM public.alunos
          GROUP BY escola_id
        ) a ON a.escola_id = e.id
        LEFT JOIN (
          SELECT p.escola_id, COUNT(*)::int as total_professores
          FROM public.profiles p
          WHERE p.role = 'professor'
          GROUP BY p.escola_id
        ) pf ON pf.escola_id = e.id;
    END IF;

    -- Create view: matriculas_por_ano only if table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'matriculas'
    ) THEN
        CREATE OR REPLACE VIEW public.matriculas_por_ano AS
        SELECT
          m.escola_id,
          TO_CHAR(COALESCE(m.created_at, NOW()), 'YYYY') as ano,
          COUNT(*)::int as total
        FROM public.matriculas m
        GROUP BY m.escola_id, TO_CHAR(COALESCE(m.created_at, NOW()), 'YYYY');
    END IF;

    -- Create view: pagamentos_status only if table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'pagamentos'
    ) THEN
        CREATE OR REPLACE VIEW public.pagamentos_status AS
        SELECT
          p.escola_id,
          COALESCE(p.status, 'desconhecido') as status,
          COUNT(*)::int as total
        FROM public.pagamentos p
        GROUP BY p.escola_id, COALESCE(p.status, 'desconhecido');
    END IF;
END $$;
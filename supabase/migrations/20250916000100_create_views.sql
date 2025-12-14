-- Create views safely with existence checks and defensive fallbacks
DO $$
DECLARE
    have_escolas boolean;
    have_alunos boolean;
    have_escola_usuarios boolean;
    sql text;
BEGIN
    -- Only proceed if base table escolas exists
    have_escolas := EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'escolas'
    );

    IF have_escolas THEN
        -- Detect optional dependencies used in the view
        have_alunos := EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'alunos'
        );

        have_escola_usuarios := EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'escola_usuarios'
        );

        -- Build the view SQL dynamically to avoid referencing missing tables/columns
        sql := 'CREATE OR REPLACE VIEW public.escolas_view AS
            SELECT
              e.id,
              e.nome,
              e.status,
              ''Básico''::text as plano,
              NULL::timestamp as last_access';

        IF have_alunos THEN
            sql := sql || ', COALESCE(a.total_alunos, 0) as total_alunos';
        ELSE
            sql := sql || ', 0::int as total_alunos';
        END IF;

        IF have_escola_usuarios THEN
            sql := sql || ', COALESCE(pf.total_professores, 0) as total_professores';
        ELSE
            sql := sql || ', 0::int as total_professores';
        END IF;

        sql := sql || ', e.endereco as cidade, NULL::text as estado
            FROM public.escolas e';

        IF have_alunos THEN
            sql := sql || ' LEFT JOIN (
              SELECT escola_id, COUNT(*)::int as total_alunos
              FROM public.alunos
              GROUP BY escola_id
            ) a ON a.escola_id = e.id';
        END IF;

        IF have_escola_usuarios THEN
            sql := sql || ' LEFT JOIN (
              SELECT eu.escola_id, COUNT(*)::int as total_professores
              FROM public.escola_usuarios eu
              WHERE eu.papel = ''professor''
              GROUP BY eu.escola_id
            ) pf ON pf.escola_id = e.id';
        END IF;

        sql := sql || ';';
        EXECUTE sql;
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

    -- Create view: pagamentos_status only if table exists, adapt to schema
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'pagamentos'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'pagamentos' AND column_name = 'escola_id'
        ) THEN
            CREATE OR REPLACE VIEW public.pagamentos_status AS
            SELECT
              p.escola_id,
              COALESCE(p.status, 'desconhecido') as status,
              COUNT(*)::int as total
            FROM public.pagamentos p
            GROUP BY p.escola_id, COALESCE(p.status, 'desconhecido');
        ELSE
            -- Fallback for legacy schemas without escola_id on pagamentos
            CREATE OR REPLACE VIEW public.pagamentos_status AS
            SELECT
              NULL::uuid as escola_id,
              COALESCE(p.status, 'desconhecido') as status,
              COUNT(*)::int as total
            FROM public.pagamentos p
            GROUP BY COALESCE(p.status, 'desconhecido');
        END IF;
    END IF;
END $$;

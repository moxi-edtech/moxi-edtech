CREATE OR REPLACE VIEW public.vw_escola_setup_status AS
SELECT
    e.id AS escola_id,
    (EXISTS (SELECT 1 FROM anos_letivos WHERE escola_id = e.id AND ativo = true)) AS has_ano_letivo_ativo,
    ((SELECT count(*) FROM periodos_letivos pl JOIN anos_letivos al ON al.id = pl.ano_letivo_id WHERE al.escola_id = e.id AND al.ativo = true AND pl.tipo = 'TRIMESTRE') >= 3) AS has_3_trimestres,
    (EXISTS (SELECT 1 FROM curso_curriculos cc JOIN anos_letivos al ON al.id = cc.ano_letivo_id WHERE cc.escola_id = e.id AND al.ativo = true AND cc.status = 'published')) AS has_curriculo_published,
    (EXISTS (SELECT 1 FROM turmas t JOIN anos_letivos al ON al.escola_id = t.escola_id AND al.ano = t.ano_letivo WHERE t.escola_id = e.id AND al.ativo = true)) AS has_turmas_no_ano,
    (
        (CASE WHEN (EXISTS (SELECT 1 FROM anos_letivos WHERE escola_id = e.id AND ativo = true)) THEN 25 ELSE 0 END) +
        (CASE WHEN ((SELECT count(*) FROM periodos_letivos pl JOIN anos_letivos al ON al.id = pl.ano_letivo_id WHERE al.escola_id = e.id AND al.ativo = true AND pl.tipo = 'TRIMESTRE') >= 3) THEN 25 ELSE 0 END) +
        (CASE WHEN (EXISTS (SELECT 1 FROM curso_curriculos cc JOIN anos_letivos al ON al.id = cc.ano_letivo_id WHERE cc.escola_id = e.id AND al.ativo = true AND cc.status = 'published')) THEN 25 ELSE 0 END) +
        (CASE WHEN (EXISTS (SELECT 1 FROM turmas t JOIN anos_letivos al ON al.escola_id = t.escola_id AND al.ano = t.ano_letivo WHERE t.escola_id = e.id AND al.ativo = true)) THEN 25 ELSE 0 END)
    ) AS percentage
FROM
    escolas e;

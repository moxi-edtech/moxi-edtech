CREATE OR REPLACE VIEW public.vw_radar_inadimplencia AS
SELECT 
    1 as aluno_id,
    150.50 as valor_em_atraso
UNION ALL
SELECT 
    2 as aluno_id,
    200.75 as valor_em_atraso
UNION ALL
SELECT 
    3 as aluno_id,
    75.25 as valor_em_atraso;

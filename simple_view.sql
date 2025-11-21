CREATE OR REPLACE VIEW public.vw_radar_inadimplencia AS
SELECT 
    id as aluno_id,
    100.00 as valor_em_atraso
FROM alunos 
LIMIT 10;

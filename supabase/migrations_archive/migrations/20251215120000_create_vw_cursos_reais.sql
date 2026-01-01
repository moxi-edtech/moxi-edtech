-- Cria uma view para isolar apenas cursos reais (técnico / PUNIV)
CREATE OR REPLACE VIEW vw_cursos_reais AS
SELECT 
  id,
  escola_id,
  codigo,
  nome,
  tipo,
  descricao,
  nivel,
  semestre_id
FROM cursos
WHERE COALESCE(tipo, 'geral') IN ('tecnico', 'puniv');

GRANT SELECT ON vw_cursos_reais TO anon, authenticated, service_role;

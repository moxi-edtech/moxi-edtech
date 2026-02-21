-- MIGRATION: legacy curriculum keys → new curriculum keys/siglas
-- Review TODO mappings before running on production.

-- Preview legacy keys
select id, nome, codigo, course_code, curriculum_key
from cursos
where curriculum_key in (
  'primario_base',
  'primario_avancado',
  'ciclo1',
  'puniv_fisicas',
  'puniv_economicas',
  'puniv_humanas',
  'puniv_artes',
  'tecnico_informatica',
  'tecnico_gestao',
  'tecnico_construcao',
  'tecnico_electricidade',
  'tecnico_mecanica',
  'tecnico_electronica',
  'tecnico_petroleos',
  'tecnico_base',
  'saude_enfermagem',
  'saude_farmacia_analises',
  'magisterio_primario'
)
order by updated_at desc nulls last;

-- Primary mappings
with mapping as (
  select * from (values
    ('primario_base', 'primario_generico', 'EP'),
    ('primario_avancado', 'primario_generico', 'EP'),
    ('ciclo1', 'esg_ciclo1', 'ESG'),
    ('puniv_fisicas', 'esg_puniv_cfb', 'CFB'),
    ('puniv_economicas', 'esg_puniv_cej', 'CEJ'),
    ('puniv_humanas', 'esg_puniv_cch', 'CCH'),
    ('puniv_artes', 'esg_puniv_artes', 'AV'),
    ('tecnico_informatica', 'tec_informatica', 'TI'),
    ('tecnico_gestao', 'tec_contabilidade', 'TG'),
    ('tecnico_construcao', 'tec_construcao_civil', 'CC'),
    ('tecnico_electricidade', 'tec_energia_eletrica', 'EL'),
    ('tecnico_mecanica', 'tec_mecanica_manut', 'MEC'),
    ('tecnico_electronica', 'tec_electronica_telecom', 'ET'),
    ('saude_enfermagem', 'tec_saude_enfermagem', 'ENF')
  ) as t(old_key, new_key, new_code)
)
update cursos c
set curriculum_key = m.new_key,
    course_code = m.new_code,
    codigo = m.new_code
from mapping m
where c.curriculum_key = m.old_key;

-- Saúde: separar farmácia vs análises quando vierem juntas
update cursos
set curriculum_key = 'tec_saude_farmacia',
    course_code = 'FARM',
    codigo = 'FARM'
where curriculum_key = 'saude_farmacia_analises'
  and nome ilike '%farmac%';

update cursos
set curriculum_key = 'tec_saude_analises',
    course_code = 'ACL',
    codigo = 'ACL'
where curriculum_key = 'saude_farmacia_analises'
  and (nome ilike '%anal%' or nome ilike '%anál%');

update cursos
set curriculum_key = 'tec_saude_analises',
    course_code = 'ACL',
    codigo = 'ACL'
where curriculum_key = 'saude_farmacia_analises';

-- Informática gestão (mantém currículo, troca sigla TI -> TIG)
update cursos
set course_code = 'TIG',
    codigo = 'TIG'
where curriculum_key = 'tec_informatica_gestao'
  and (course_code = 'TI' or codigo = 'TI');

-- Detecta cursos com sigla TI mas nome sugere gestão
update cursos
set curriculum_key = 'tec_informatica_gestao',
    course_code = 'TIG',
    codigo = 'TIG'
where (course_code = 'TI' or codigo = 'TI')
  and nome ilike '%gest%';

-- TODO: definir mapeamento final para estas keys legacy (sem equivalente direto)
-- tecnico_petroleos
-- tecnico_base
-- magisterio_primario

-- Preview after
select id, nome, codigo, course_code, curriculum_key
from cursos
where curriculum_key in (
  'primario_generico',
  'esg_ciclo1',
  'esg_puniv_cfb',
  'esg_puniv_cej',
  'esg_puniv_cch',
  'esg_puniv_artes',
  'tec_informatica_gestao',
  'tec_contabilidade',
  'tec_construcao_civil',
  'tec_energia_eletrica',
  'tec_mecanica_manut',
  'tec_electronica_telecom',
  'tec_saude_enfermagem',
  'tec_saude_farmacia',
  'tec_saude_analises',
  'tec_desenhador_projectista',
  'tec_electronica_automacao',
  'tec_energias_renovaveis',
  'tec_geologia_petroleo',
  'tec_perfuracao_producao',
  'tec_minas',
  'tec_producao_metalomecanica',
  'tec_informatica',
  'tec_gestao_sistemas'
)
order by updated_at desc nulls last;

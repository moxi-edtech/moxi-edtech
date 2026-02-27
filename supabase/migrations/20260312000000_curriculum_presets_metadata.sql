ALTER TABLE public.curriculum_presets
  ADD COLUMN IF NOT EXISTS course_code TEXT,
  ADD COLUMN IF NOT EXISTS badge TEXT,
  ADD COLUMN IF NOT EXISTS recommended BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS class_min INT,
  ADD COLUMN IF NOT EXISTS class_max INT;

UPDATE public.curriculum_presets
SET
  course_code = CASE id
    WHEN 'primario_generico' THEN 'EP'
    WHEN 'esg_ciclo1' THEN 'ESG'
    WHEN 'esg_puniv_cfb' THEN 'CFB'
    WHEN 'esg_puniv_cej' THEN 'CEJ'
    WHEN 'esg_puniv_cch' THEN 'CCH'
    WHEN 'esg_puniv_artes' THEN 'AV'
    WHEN 'tec_contabilidade' THEN 'TG'
    WHEN 'tec_informatica_gestao' THEN 'TIG'
    WHEN 'tec_recursos_humanos' THEN 'TRH'
    WHEN 'tec_secretariado' THEN 'SEC'
    WHEN 'tec_financas' THEN 'FIN'
    WHEN 'tec_comercio' THEN 'COM'
    WHEN 'tec_saude_analises' THEN 'ACL'
    WHEN 'tec_saude_enfermagem' THEN 'ENF'
    WHEN 'tec_saude_estomatologia' THEN 'ESTO'
    WHEN 'tec_saude_farmacia' THEN 'FARM'
    WHEN 'tec_saude_fisioterapia' THEN 'FISI'
    WHEN 'tec_saude_nutricao' THEN 'NUTR'
    WHEN 'tec_saude_radiologia' THEN 'RAD'
    WHEN 'tec_construcao_civil' THEN 'CC'
    WHEN 'tec_energia_eletrica' THEN 'EL'
    WHEN 'tec_mecanica_manut' THEN 'MEC'
    WHEN 'tec_informatica_sistemas' THEN 'TIS'
    WHEN 'tec_desenhador_projectista' THEN 'DP'
    WHEN 'tec_electronica_telecom' THEN 'ET'
    WHEN 'tec_electronica_automacao' THEN 'EA'
    WHEN 'tec_energias_renovaveis' THEN 'ER'
    WHEN 'tec_geologia_petroleo' THEN 'GP'
    WHEN 'tec_perfuracao_producao' THEN 'PP'
    WHEN 'tec_minas' THEN 'MIN'
    WHEN 'tec_producao_metalomecanica' THEN 'PM'
    WHEN 'tec_informatica' THEN 'TI'
    WHEN 'tec_gestao_sistemas' THEN 'TGS'
    ELSE course_code
  END,
  badge = CASE id
    WHEN 'primario_generico' THEN '1ª-6ª'
    WHEN 'esg_ciclo1' THEN '7ª-9ª'
    WHEN 'esg_puniv_cfb' THEN 'PUNIV'
    WHEN 'esg_puniv_cej' THEN 'PUNIV'
    WHEN 'esg_puniv_cch' THEN 'PUNIV'
    WHEN 'esg_puniv_artes' THEN 'PUNIV'
    WHEN 'tec_contabilidade' THEN 'Técnico'
    WHEN 'tec_informatica_gestao' THEN 'Técnico'
    WHEN 'tec_recursos_humanos' THEN 'Técnico'
    WHEN 'tec_secretariado' THEN 'Técnico'
    WHEN 'tec_financas' THEN 'Técnico'
    WHEN 'tec_comercio' THEN 'Técnico'
    WHEN 'tec_saude_analises' THEN 'Saúde'
    WHEN 'tec_saude_enfermagem' THEN 'Saúde'
    WHEN 'tec_saude_estomatologia' THEN 'Saúde'
    WHEN 'tec_saude_farmacia' THEN 'Saúde'
    WHEN 'tec_saude_fisioterapia' THEN 'Saúde'
    WHEN 'tec_saude_nutricao' THEN 'Saúde'
    WHEN 'tec_saude_radiologia' THEN 'Saúde'
    WHEN 'tec_construcao_civil' THEN 'Técnico'
    WHEN 'tec_energia_eletrica' THEN 'Técnico'
    WHEN 'tec_mecanica_manut' THEN 'Técnico'
    WHEN 'tec_informatica_sistemas' THEN 'Técnico'
    WHEN 'tec_desenhador_projectista' THEN 'Técnico'
    WHEN 'tec_electronica_telecom' THEN 'Técnico'
    WHEN 'tec_electronica_automacao' THEN 'Técnico'
    WHEN 'tec_energias_renovaveis' THEN 'Técnico'
    WHEN 'tec_geologia_petroleo' THEN 'Técnico'
    WHEN 'tec_perfuracao_producao' THEN 'Técnico'
    WHEN 'tec_minas' THEN 'Técnico'
    WHEN 'tec_producao_metalomecanica' THEN 'Técnico'
    WHEN 'tec_informatica' THEN 'Técnico'
    WHEN 'tec_gestao_sistemas' THEN 'Técnico'
    ELSE badge
  END,
  recommended = CASE id
    WHEN 'primario_generico' THEN true
    WHEN 'esg_puniv_cfb' THEN true
    WHEN 'tec_contabilidade' THEN true
    WHEN 'tec_informatica_gestao' THEN true
    ELSE recommended
  END,
  class_min = CASE id
    WHEN 'primario_generico' THEN 1
    WHEN 'esg_ciclo1' THEN 7
    WHEN 'esg_puniv_cfb' THEN 10
    WHEN 'esg_puniv_cej' THEN 10
    WHEN 'esg_puniv_cch' THEN 10
    WHEN 'esg_puniv_artes' THEN 10
    WHEN 'tec_contabilidade' THEN 10
    WHEN 'tec_informatica_gestao' THEN 10
    WHEN 'tec_recursos_humanos' THEN 10
    WHEN 'tec_secretariado' THEN 10
    WHEN 'tec_financas' THEN 10
    WHEN 'tec_comercio' THEN 10
    WHEN 'tec_saude_analises' THEN 10
    WHEN 'tec_saude_enfermagem' THEN 10
    WHEN 'tec_saude_estomatologia' THEN 10
    WHEN 'tec_saude_farmacia' THEN 10
    WHEN 'tec_saude_fisioterapia' THEN 10
    WHEN 'tec_saude_nutricao' THEN 10
    WHEN 'tec_saude_radiologia' THEN 10
    WHEN 'tec_construcao_civil' THEN 10
    WHEN 'tec_energia_eletrica' THEN 10
    WHEN 'tec_mecanica_manut' THEN 10
    WHEN 'tec_informatica_sistemas' THEN 10
    WHEN 'tec_desenhador_projectista' THEN 10
    WHEN 'tec_electronica_telecom' THEN 10
    WHEN 'tec_electronica_automacao' THEN 10
    WHEN 'tec_energias_renovaveis' THEN 10
    WHEN 'tec_geologia_petroleo' THEN 10
    WHEN 'tec_perfuracao_producao' THEN 10
    WHEN 'tec_minas' THEN 10
    WHEN 'tec_producao_metalomecanica' THEN 10
    WHEN 'tec_informatica' THEN 10
    WHEN 'tec_gestao_sistemas' THEN 10
    ELSE class_min
  END,
  class_max = CASE id
    WHEN 'primario_generico' THEN 6
    WHEN 'esg_ciclo1' THEN 9
    WHEN 'esg_puniv_cfb' THEN 12
    WHEN 'esg_puniv_cej' THEN 12
    WHEN 'esg_puniv_cch' THEN 12
    WHEN 'esg_puniv_artes' THEN 12
    WHEN 'tec_contabilidade' THEN 13
    WHEN 'tec_informatica_gestao' THEN 13
    WHEN 'tec_recursos_humanos' THEN 13
    WHEN 'tec_secretariado' THEN 13
    WHEN 'tec_financas' THEN 13
    WHEN 'tec_comercio' THEN 13
    WHEN 'tec_saude_analises' THEN 13
    WHEN 'tec_saude_enfermagem' THEN 13
    WHEN 'tec_saude_estomatologia' THEN 13
    WHEN 'tec_saude_farmacia' THEN 13
    WHEN 'tec_saude_fisioterapia' THEN 13
    WHEN 'tec_saude_nutricao' THEN 13
    WHEN 'tec_saude_radiologia' THEN 13
    WHEN 'tec_construcao_civil' THEN 13
    WHEN 'tec_energia_eletrica' THEN 13
    WHEN 'tec_mecanica_manut' THEN 13
    WHEN 'tec_informatica_sistemas' THEN 13
    WHEN 'tec_desenhador_projectista' THEN 13
    WHEN 'tec_electronica_telecom' THEN 13
    WHEN 'tec_electronica_automacao' THEN 13
    WHEN 'tec_energias_renovaveis' THEN 13
    WHEN 'tec_geologia_petroleo' THEN 13
    WHEN 'tec_perfuracao_producao' THEN 13
    WHEN 'tec_minas' THEN 13
    WHEN 'tec_producao_metalomecanica' THEN 13
    WHEN 'tec_informatica' THEN 13
    WHEN 'tec_gestao_sistemas' THEN 13
    ELSE class_max
  END;

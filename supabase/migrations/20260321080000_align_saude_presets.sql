ALTER TABLE public.curriculum_preset_subjects
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

WITH expected AS (
  SELECT * FROM (
    VALUES
      -- Common 10ª Classe for all tec_saude_*
      ('tec_saude_analises','Língua Portuguesa','10ª Classe','SOCIO_CULTURAL',3,'core'),
      ('tec_saude_analises','Língua Estrangeira','10ª Classe','SOCIO_CULTURAL',3,'core'),
      ('tec_saude_analises','Formação de Atitudes Integradoras','10ª Classe','SOCIO_CULTURAL',3,'core'),
      ('tec_saude_analises','Educação Física','10ª Classe','SOCIO_CULTURAL',2,'core'),
      ('tec_saude_analises','Matemática','10ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_analises','Biologia','10ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_analises','Física','10ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_analises','Química Geral','10ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_analises','Informática','10ª Classe','CIENTIFICA',2,'core'),
      ('tec_saude_analises','Introdução à Profissão, Ética e Deontologia','10ª Classe','TECNICA',3,'core'),
      ('tec_saude_analises','Anatomia e Fisiologia Humana','10ª Classe','TECNICA',4,'core'),

      ('tec_saude_enfermagem','Língua Portuguesa','10ª Classe','SOCIO_CULTURAL',3,'core'),
      ('tec_saude_enfermagem','Língua Estrangeira','10ª Classe','SOCIO_CULTURAL',3,'core'),
      ('tec_saude_enfermagem','Formação de Atitudes Integradoras','10ª Classe','SOCIO_CULTURAL',3,'core'),
      ('tec_saude_enfermagem','Educação Física','10ª Classe','SOCIO_CULTURAL',2,'core'),
      ('tec_saude_enfermagem','Matemática','10ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_enfermagem','Biologia','10ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_enfermagem','Física','10ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_enfermagem','Química Geral','10ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_enfermagem','Informática','10ª Classe','CIENTIFICA',2,'core'),
      ('tec_saude_enfermagem','Introdução à Profissão, Ética e Deontologia','10ª Classe','TECNICA',3,'core'),
      ('tec_saude_enfermagem','Anatomia e Fisiologia Humana','10ª Classe','TECNICA',4,'core'),

      ('tec_saude_estomatologia','Língua Portuguesa','10ª Classe','SOCIO_CULTURAL',3,'core'),
      ('tec_saude_estomatologia','Língua Estrangeira','10ª Classe','SOCIO_CULTURAL',3,'core'),
      ('tec_saude_estomatologia','Formação de Atitudes Integradoras','10ª Classe','SOCIO_CULTURAL',3,'core'),
      ('tec_saude_estomatologia','Educação Física','10ª Classe','SOCIO_CULTURAL',2,'core'),
      ('tec_saude_estomatologia','Matemática','10ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_estomatologia','Biologia','10ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_estomatologia','Física','10ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_estomatologia','Química Geral','10ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_estomatologia','Informática','10ª Classe','CIENTIFICA',2,'core'),
      ('tec_saude_estomatologia','Introdução à Profissão, Ética e Deontologia','10ª Classe','TECNICA',3,'core'),
      ('tec_saude_estomatologia','Anatomia e Fisiologia Humana','10ª Classe','TECNICA',4,'core'),

      ('tec_saude_farmacia','Língua Portuguesa','10ª Classe','SOCIO_CULTURAL',3,'core'),
      ('tec_saude_farmacia','Língua Estrangeira','10ª Classe','SOCIO_CULTURAL',3,'core'),
      ('tec_saude_farmacia','Formação de Atitudes Integradoras','10ª Classe','SOCIO_CULTURAL',3,'core'),
      ('tec_saude_farmacia','Educação Física','10ª Classe','SOCIO_CULTURAL',2,'core'),
      ('tec_saude_farmacia','Matemática','10ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_farmacia','Biologia','10ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_farmacia','Física','10ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_farmacia','Química Geral','10ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_farmacia','Informática','10ª Classe','CIENTIFICA',2,'core'),
      ('tec_saude_farmacia','Introdução à Profissão, Ética e Deontologia','10ª Classe','TECNICA',3,'core'),
      ('tec_saude_farmacia','Anatomia e Fisiologia Humana','10ª Classe','TECNICA',4,'core'),

      ('tec_saude_fisioterapia','Língua Portuguesa','10ª Classe','SOCIO_CULTURAL',3,'core'),
      ('tec_saude_fisioterapia','Língua Estrangeira','10ª Classe','SOCIO_CULTURAL',3,'core'),
      ('tec_saude_fisioterapia','Formação de Atitudes Integradoras','10ª Classe','SOCIO_CULTURAL',3,'core'),
      ('tec_saude_fisioterapia','Educação Física','10ª Classe','SOCIO_CULTURAL',2,'core'),
      ('tec_saude_fisioterapia','Matemática','10ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_fisioterapia','Biologia','10ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_fisioterapia','Física','10ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_fisioterapia','Química Geral','10ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_fisioterapia','Informática','10ª Classe','CIENTIFICA',2,'core'),
      ('tec_saude_fisioterapia','Introdução à Profissão, Ética e Deontologia','10ª Classe','TECNICA',3,'core'),
      ('tec_saude_fisioterapia','Anatomia e Fisiologia Humana','10ª Classe','TECNICA',4,'core'),

      ('tec_saude_nutricao','Língua Portuguesa','10ª Classe','SOCIO_CULTURAL',3,'core'),
      ('tec_saude_nutricao','Língua Estrangeira','10ª Classe','SOCIO_CULTURAL',3,'core'),
      ('tec_saude_nutricao','Formação de Atitudes Integradoras','10ª Classe','SOCIO_CULTURAL',3,'core'),
      ('tec_saude_nutricao','Educação Física','10ª Classe','SOCIO_CULTURAL',2,'core'),
      ('tec_saude_nutricao','Matemática','10ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_nutricao','Biologia','10ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_nutricao','Física','10ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_nutricao','Química Geral','10ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_nutricao','Informática','10ª Classe','CIENTIFICA',2,'core'),
      ('tec_saude_nutricao','Introdução à Profissão, Ética e Deontologia','10ª Classe','TECNICA',3,'core'),
      ('tec_saude_nutricao','Anatomia e Fisiologia Humana','10ª Classe','TECNICA',4,'core'),

      ('tec_saude_radiologia','Língua Portuguesa','10ª Classe','SOCIO_CULTURAL',3,'core'),
      ('tec_saude_radiologia','Língua Estrangeira','10ª Classe','SOCIO_CULTURAL',3,'core'),
      ('tec_saude_radiologia','Formação de Atitudes Integradoras','10ª Classe','SOCIO_CULTURAL',3,'core'),
      ('tec_saude_radiologia','Educação Física','10ª Classe','SOCIO_CULTURAL',2,'core'),
      ('tec_saude_radiologia','Matemática','10ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_radiologia','Biologia','10ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_radiologia','Física','10ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_radiologia','Química Geral','10ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_radiologia','Informática','10ª Classe','CIENTIFICA',2,'core'),
      ('tec_saude_radiologia','Introdução à Profissão, Ética e Deontologia','10ª Classe','TECNICA',3,'core'),
      ('tec_saude_radiologia','Anatomia e Fisiologia Humana','10ª Classe','TECNICA',4,'core'),

      -- tec_saude_analises 11ª/12ª/13ª
      ('tec_saude_analises','Língua Portuguesa','11ª Classe','SOCIO_CULTURAL',3,'core'),
      ('tec_saude_analises','Língua Estrangeira','11ª Classe','SOCIO_CULTURAL',2,'core'),
      ('tec_saude_analises','Educação Física','11ª Classe','SOCIO_CULTURAL',2,'core'),
      ('tec_saude_analises','Matemática','11ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_analises','Biologia','11ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_analises','Química Orgânica','11ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_analises','Anatomia e Fisiologia Humana','11ª Classe','TECNICA',3,'core'),
      ('tec_saude_analises','Microbiologia Clínica I','11ª Classe','TECNICA',3,'core'),
      ('tec_saude_analises','Hematologia I','11ª Classe','TECNICA',3,'core'),
      ('tec_saude_analises','Imunologia','11ª Classe','TECNICA',2,'core'),
      ('tec_saude_analises','Urinologia','11ª Classe','TECNICA',3,'core'),
      ('tec_saude_analises','Coprologia','11ª Classe','TECNICA',2,'core'),
      ('tec_saude_analises','Práticas de Análises Clínicas','11ª Classe','TECNICA',3,'core'),

      ('tec_saude_analises','Psicologia Geral','12ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_analises','Informação, Educação e Comunicação - IEC','12ª Classe','TECNICA',2,'core'),
      ('tec_saude_analises','Microbiologia Clínica II','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_analises','Hematologia II','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_analises','Imunohematologia','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_analises','Microbiologia de Água e Alimentos','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_analises','Bioquímica','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_analises','Química Clínica','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_analises','Parasitologia','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_analises','Práticas de Análises Clínicas','12ª Classe','TECNICA',4,'core'),

      ('tec_saude_analises','Gestão em Análises Clínicas','13ª Classe','TECNICA',4,'core'),
      ('tec_saude_analises','Projecto Tecnológico','13ª Classe','TECNICA',4,'projeto'),
      ('tec_saude_analises','Estágio Curricular','13ª Classe','TECNICA',20,'estagio'),

      -- tec_saude_enfermagem 11ª/12ª/13ª
      ('tec_saude_enfermagem','Língua Portuguesa','11ª Classe','SOCIO_CULTURAL',3,'core'),
      ('tec_saude_enfermagem','Língua Estrangeira','11ª Classe','SOCIO_CULTURAL',2,'core'),
      ('tec_saude_enfermagem','Educação Física','11ª Classe','SOCIO_CULTURAL',2,'core'),
      ('tec_saude_enfermagem','Matemática','11ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_enfermagem','Biologia','11ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_enfermagem','Química Orgânica','11ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_enfermagem','Psicologia Geral','11ª Classe','CIENTIFICA',2,'core'),
      ('tec_saude_enfermagem','Anatomia e Fisiologia Humana','11ª Classe','TECNICA',3,'core'),
      ('tec_saude_enfermagem','Epidemiologia e Estatística','11ª Classe','TECNICA',3,'core'),
      ('tec_saude_enfermagem','Enfermagem em Saúde Colectiva','11ª Classe','TECNICA',2,'core'),
      ('tec_saude_enfermagem','Enfermagem e Patologia Médico-Cirúrgica I','11ª Classe','TECNICA',3,'core'),
      ('tec_saude_enfermagem','Técnicas de Enfermagem I','11ª Classe','TECNICA',3,'core'),

      ('tec_saude_enfermagem','Informação, Educação e Comunicação - IEC','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_enfermagem','Enfermagem em Saúde Mental','12ª Classe','TECNICA',2,'core'),
      ('tec_saude_enfermagem','Farmacologia','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_enfermagem','Doenças Correntes','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_enfermagem','Nutrição e Dietética','12ª Classe','TECNICA',2,'core'),
      ('tec_saude_enfermagem','Enfermagem e Patologia Médico-Cirúrgica II','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_enfermagem','Técnicas de Enfermagem II','12ª Classe','TECNICA',4,'core'),
      ('tec_saude_enfermagem','Saúde da Mulher','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_enfermagem','Saúde da Criança','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_enfermagem','Enfermagem em Urgência','12ª Classe','TECNICA',3,'core'),

      ('tec_saude_enfermagem','Gestão em Enfermagem','13ª Classe','TECNICA',4,'core'),
      ('tec_saude_enfermagem','Projecto Tecnológico','13ª Classe','TECNICA',4,'projeto'),
      ('tec_saude_enfermagem','Estágio Curricular','13ª Classe','TECNICA',20,'estagio'),

      -- tec_saude_estomatologia 11ª/12ª/13ª
      ('tec_saude_estomatologia','Língua Portuguesa','11ª Classe','SOCIO_CULTURAL',3,'core'),
      ('tec_saude_estomatologia','Língua Estrangeira','11ª Classe','SOCIO_CULTURAL',2,'core'),
      ('tec_saude_estomatologia','Educação Física','11ª Classe','SOCIO_CULTURAL',2,'core'),
      ('tec_saude_estomatologia','Matemática','11ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_estomatologia','Biologia','11ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_estomatologia','Química Orgânica','11ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_estomatologia','Psicologia Geral','11ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_estomatologia','Anatomia e Fisiologia Humana','11ª Classe','TECNICA',2,'core'),
      ('tec_saude_estomatologia','Anatomia da Cabeça e do Pescoço','11ª Classe','TECNICA',3,'core'),
      ('tec_saude_estomatologia','Patologia e Semiologia','11ª Classe','TECNICA',2,'core'),
      ('tec_saude_estomatologia','Microbiologia e Esterilização','11ª Classe','TECNICA',2,'core'),
      ('tec_saude_estomatologia','Aparelhagem Instrumental','11ª Classe','TECNICA',2,'core'),
      ('tec_saude_estomatologia','Farmacologia','11ª Classe','TECNICA',2,'core'),

      ('tec_saude_estomatologia','Informação, Educação e Comunicação - IEC','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_estomatologia','Anatomia da Cabeça e do Pescoço','12ª Classe','TECNICA',4,'core'),
      ('tec_saude_estomatologia','Exodância','12ª Classe','TECNICA',4,'core'),
      ('tec_saude_estomatologia','Radiologia Dentária','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_estomatologia','Terapêutica Dentária','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_estomatologia','Dentística Restauradora','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_estomatologia','Práticas de Estomatologia','12ª Classe','TECNICA',4,'core'),

      ('tec_saude_estomatologia','Gestão em Estomatologia','13ª Classe','TECNICA',4,'core'),
      ('tec_saude_estomatologia','Projecto Tecnológico','13ª Classe','TECNICA',4,'projeto'),
      ('tec_saude_estomatologia','Estágio Curricular','13ª Classe','TECNICA',20,'estagio'),

      -- tec_saude_farmacia 11ª/12ª/13ª
      ('tec_saude_farmacia','Língua Portuguesa','11ª Classe','SOCIO_CULTURAL',3,'core'),
      ('tec_saude_farmacia','Língua Estrangeira','11ª Classe','SOCIO_CULTURAL',2,'core'),
      ('tec_saude_farmacia','Educação Física','11ª Classe','SOCIO_CULTURAL',2,'core'),
      ('tec_saude_farmacia','Matemática','11ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_farmacia','Biologia','11ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_farmacia','Química Orgânica','11ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_farmacia','Anatomia e Fisiologia Humana','11ª Classe','TECNICA',3,'core'),
      ('tec_saude_farmacia','Patologia','11ª Classe','TECNICA',2,'core'),
      ('tec_saude_farmacia','Botânica','11ª Classe','TECNICA',2,'core'),
      ('tec_saude_farmacia','Microparasitologia','11ª Classe','TECNICA',3,'core'),
      ('tec_saude_farmacia','Farmacologia I','11ª Classe','TECNICA',2,'core'),
      ('tec_saude_farmacia','Farmacognosia','11ª Classe','TECNICA',3,'core'),
      ('tec_saude_farmacia','Química Analítica','11ª Classe','TECNICA',3,'core'),

      ('tec_saude_farmacia','Psicologia Geral','12ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_farmacia','Informação, Educação e Comunicação - IEC','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_farmacia','Bromatologia','12ª Classe','TECNICA',2,'core'),
      ('tec_saude_farmacia','Patologia','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_farmacia','Farmacologia II','12ª Classe','TECNICA',4,'core'),
      ('tec_saude_farmacia','Química Farmacêutica','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_farmacia','Tecnologia de Produção de Medicamentos','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_farmacia','Farmacoterapia','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_farmacia','Toxicologia','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_farmacia','Práticas de Farmácia','12ª Classe','TECNICA',4,'core'),

      ('tec_saude_farmacia','Gestão em Farmácia','13ª Classe','TECNICA',4,'core'),
      ('tec_saude_farmacia','Projecto Tecnológico','13ª Classe','TECNICA',4,'projeto'),
      ('tec_saude_farmacia','Estágio Curricular','13ª Classe','TECNICA',20,'estagio'),

      -- tec_saude_fisioterapia 11ª/12ª/13ª
      ('tec_saude_fisioterapia','Língua Portuguesa','11ª Classe','SOCIO_CULTURAL',3,'core'),
      ('tec_saude_fisioterapia','Língua Estrangeira','11ª Classe','SOCIO_CULTURAL',2,'core'),
      ('tec_saude_fisioterapia','Educação Física','11ª Classe','SOCIO_CULTURAL',2,'core'),
      ('tec_saude_fisioterapia','Matemática','11ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_fisioterapia','Biologia','11ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_fisioterapia','Química Orgânica','11ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_fisioterapia','Psicologia Geral','11ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_fisioterapia','Patologia Geral','11ª Classe','TECNICA',2,'core'),
      ('tec_saude_fisioterapia','Anatomia e Fisiologia Humana','11ª Classe','TECNICA',3,'core'),
      ('tec_saude_fisioterapia','Estudo do Movimento Humano','11ª Classe','TECNICA',2,'core'),
      ('tec_saude_fisioterapia','Fisioterapia Neuro-muscular','11ª Classe','TECNICA',3,'core'),
      ('tec_saude_fisioterapia','Fisioterapia Músculo-esquelética','11ª Classe','TECNICA',3,'core'),

      ('tec_saude_fisioterapia','Patologia Específica','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_fisioterapia','Informação, Educação e Comunicação - IEC','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_fisioterapia','Fisioterapia Cardio-respiratória','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_fisioterapia','Fisioterapia Neuro-muscular','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_fisioterapia','Fisioterapia Músculo-esquelética','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_fisioterapia','Fisioterapia Materno Infantil','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_fisioterapia','Recursos Fisioterapêuticos','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_fisioterapia','Ortoprotesia em Fisioterapia','12ª Classe','TECNICA',4,'core'),
      ('tec_saude_fisioterapia','Prática em Fisioterapia','12ª Classe','TECNICA',4,'core'),
      ('tec_saude_fisioterapia','Estágio Prático Parcelar','12ª Classe','TECNICA',4,'core'),

      ('tec_saude_fisioterapia','Gestão em Fisioterapia','13ª Classe','TECNICA',4,'core'),
      ('tec_saude_fisioterapia','Projecto Tecnológico','13ª Classe','TECNICA',4,'projeto'),
      ('tec_saude_fisioterapia','Estágio Curricular','13ª Classe','TECNICA',20,'estagio'),

      -- tec_saude_nutricao 11ª/12ª/13ª
      ('tec_saude_nutricao','Língua Portuguesa','11ª Classe','SOCIO_CULTURAL',3,'core'),
      ('tec_saude_nutricao','Língua Inglesa','11ª Classe','SOCIO_CULTURAL',2,'core'),
      ('tec_saude_nutricao','Educação Física','11ª Classe','SOCIO_CULTURAL',2,'core'),
      ('tec_saude_nutricao','Matemática','11ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_nutricao','Biologia','11ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_nutricao','Química Orgânica','11ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_nutricao','Anatomia e Fisiologia Humana','11ª Classe','TECNICA',3,'core'),
      ('tec_saude_nutricao','Patologia','11ª Classe','TECNICA',2,'core'),
      ('tec_saude_nutricao','Farmacologia','11ª Classe','TECNICA',2,'core'),
      ('tec_saude_nutricao','Nutrição Humana e Comunitária','11ª Classe','TECNICA',3,'core'),
      ('tec_saude_nutricao','Dietética Geral e Especial','11ª Classe','TECNICA',3,'core'),

      ('tec_saude_nutricao','Psicologia Geral','12ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_nutricao','Informação, Educação e Comunicação - IEC','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_nutricao','Patologia','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_nutricao','Farmacologia','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_nutricao','Nutrição Humana e Comunitária','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_nutricao','Dietética Geral e Especial','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_nutricao','Técnicas Dietéticas','12ª Classe','TECNICA',4,'core'),
      ('tec_saude_nutricao','Dietética Laboratorial','12ª Classe','TECNICA',4,'core'),
      ('tec_saude_nutricao','Microbiologia e Higiene dos Alimentos','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_nutricao','Práticas de Nutrição e Dietética','12ª Classe','TECNICA',4,'core'),

      ('tec_saude_nutricao','Gestão em Nutrição','13ª Classe','TECNICA',4,'core'),
      ('tec_saude_nutricao','Projecto Tecnológico','13ª Classe','TECNICA',4,'projeto'),
      ('tec_saude_nutricao','Estágio Curricular','13ª Classe','TECNICA',20,'estagio'),

      -- tec_saude_radiologia 11ª/12ª/13ª
      ('tec_saude_radiologia','Língua Portuguesa','11ª Classe','SOCIO_CULTURAL',3,'core'),
      ('tec_saude_radiologia','Língua Estrangeira','11ª Classe','SOCIO_CULTURAL',2,'core'),
      ('tec_saude_radiologia','Educação Física','11ª Classe','SOCIO_CULTURAL',2,'core'),
      ('tec_saude_radiologia','Matemática','11ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_radiologia','Biologia','11ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_radiologia','Química Orgânica','11ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_radiologia','Física das Radiações','11ª Classe','TECNICA',3,'core'),
      ('tec_saude_radiologia','Anatomia Radiológica I','11ª Classe','TECNICA',3,'core'),
      ('tec_saude_radiologia','Processamento Radiológico','11ª Classe','TECNICA',3,'core'),
      ('tec_saude_radiologia','Enfermagem em Radiologia','11ª Classe','TECNICA',2,'core'),
      ('tec_saude_radiologia','Métodos e Técnicas em Radiologia I','11ª Classe','TECNICA',3,'core'),
      ('tec_saude_radiologia','Patologia Radiológica I','11ª Classe','TECNICA',2,'core'),

      ('tec_saude_radiologia','Psicologia Geral','12ª Classe','CIENTIFICA',3,'core'),
      ('tec_saude_radiologia','Informação, Educação e Comunicação - IEC','12ª Classe','TECNICA',3,'core'),
      ('tec_saude_radiologia','Anatomia Radiológica II','12ª Classe','TECNICA',4,'core'),
      ('tec_saude_radiologia','Métodos e Técnicas em Radiologia II','12ª Classe','TECNICA',4,'core'),
      ('tec_saude_radiologia','Protecção e Segurança Radiológica','12ª Classe','TECNICA',4,'core'),
      ('tec_saude_radiologia','Patologia Radiológica II','12ª Classe','TECNICA',4,'core'),
      ('tec_saude_radiologia','Métodos e Técnicas Especiais em Radiologia','12ª Classe','TECNICA',4,'core'),
      ('tec_saude_radiologia','Práticas de Radiologia','12ª Classe','TECNICA',4,'core'),

      ('tec_saude_radiologia','Gestão em Radiologia','13ª Classe','TECNICA',4,'core'),
      ('tec_saude_radiologia','Projecto Tecnológico','13ª Classe','TECNICA',4,'projeto'),
      ('tec_saude_radiologia','Estágio Curricular','13ª Classe','TECNICA',20,'estagio')
  ) AS t(preset_id, name, grade_level, component, weekly_hours, subject_type)
),
upsert AS (
  INSERT INTO public.curriculum_preset_subjects (
    preset_id,
    name,
    grade_level,
    component,
    weekly_hours,
    subject_type,
    is_active
  )
  SELECT
    preset_id,
    name,
    grade_level,
    component::public.discipline_component,
    weekly_hours,
    subject_type,
    true
  FROM expected
  ON CONFLICT (preset_id, name, grade_level) DO UPDATE SET
    component = EXCLUDED.component,
    weekly_hours = EXCLUDED.weekly_hours,
    subject_type = EXCLUDED.subject_type,
    is_active = true
  RETURNING 1
),
deactivate AS (
  UPDATE public.curriculum_preset_subjects cps
  SET is_active = false
  WHERE cps.preset_id LIKE 'tec_saude_%'
    AND NOT EXISTS (
      SELECT 1
      FROM expected e
      WHERE e.preset_id = cps.preset_id
        AND e.name = cps.name
        AND e.grade_level = cps.grade_level
    )
  RETURNING 1
),
deleted_expected AS (
  DELETE FROM public.curriculum_preset_subjects_expected
  WHERE preset_id LIKE 'tec_saude_%'
  RETURNING 1
)
INSERT INTO public.curriculum_preset_subjects_expected (
  preset_id,
  name,
  grade_level,
  component,
  weekly_hours,
  subject_type
)
SELECT
  preset_id,
  name,
  grade_level,
  component::public.discipline_component,
  weekly_hours,
  subject_type
FROM expected;

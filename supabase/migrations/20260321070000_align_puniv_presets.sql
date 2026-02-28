DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.curriculum_preset_subjects
    WHERE preset_id = 'esg_puniv_cej'
      AND grade_level = '12ª Classe'
      AND name = 'Desenv. Económico e Social'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM public.curriculum_preset_subjects
      WHERE preset_id = 'esg_puniv_cej'
        AND grade_level = '12ª Classe'
        AND name = 'Desenvolvimento Económico e Social'
    ) THEN
      DELETE FROM public.curriculum_preset_subjects
      WHERE preset_id = 'esg_puniv_cej'
        AND grade_level = '12ª Classe'
        AND name = 'Desenv. Económico e Social';
    ELSE
      UPDATE public.curriculum_preset_subjects
      SET name = 'Desenvolvimento Económico e Social'
      WHERE preset_id = 'esg_puniv_cej'
        AND grade_level = '12ª Classe'
        AND name = 'Desenv. Económico e Social';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.curriculum_preset_subjects_expected
    WHERE preset_id = 'esg_puniv_cej'
      AND grade_level = '12ª Classe'
      AND name = 'Desenv. Económico e Social'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM public.curriculum_preset_subjects_expected
      WHERE preset_id = 'esg_puniv_cej'
        AND grade_level = '12ª Classe'
        AND name = 'Desenvolvimento Económico e Social'
    ) THEN
      DELETE FROM public.curriculum_preset_subjects_expected
      WHERE preset_id = 'esg_puniv_cej'
        AND grade_level = '12ª Classe'
        AND name = 'Desenv. Económico e Social';
    ELSE
      UPDATE public.curriculum_preset_subjects_expected
      SET name = 'Desenvolvimento Económico e Social'
      WHERE preset_id = 'esg_puniv_cej'
        AND grade_level = '12ª Classe'
        AND name = 'Desenv. Económico e Social';
    END IF;
  END IF;
END $$;

DELETE FROM public.curriculum_preset_subjects
WHERE (preset_id = 'esg_puniv_cfb' AND ((name = 'Desenho e Geometria Descritiva' AND grade_level IN ('10ª Classe','11ª Classe','12ª Classe')) OR (name = 'Geologia' AND grade_level = '10ª Classe') OR (name = 'Filosofia' AND grade_level = '10ª Classe') OR (name = 'Informática' AND grade_level IN ('11ª Classe','12ª Classe'))))
   OR (preset_id = 'esg_puniv_cej' AND ((name = 'Informática' AND grade_level IN ('11ª Classe','12ª Classe')) OR (name = 'Matemática' AND grade_level = '12ª Classe') OR (name IN ('Form. Atitudes Integradoras','Formação de Atitudes Integradoras') AND grade_level = '12ª Classe')))
   OR (preset_id = 'esg_puniv_artes' AND ((name = 'Informática' AND grade_level IN ('11ª Classe','12ª Classe')) OR (name = 'Matemática' AND grade_level IN ('11ª Classe','12ª Classe'))));

DELETE FROM public.curriculum_preset_subjects_expected
WHERE (preset_id = 'esg_puniv_cfb' AND ((name = 'Desenho e Geometria Descritiva' AND grade_level IN ('10ª Classe','11ª Classe','12ª Classe')) OR (name = 'Geologia' AND grade_level = '10ª Classe') OR (name = 'Filosofia' AND grade_level = '10ª Classe') OR (name = 'Informática' AND grade_level IN ('11ª Classe','12ª Classe'))))
   OR (preset_id = 'esg_puniv_cej' AND ((name = 'Informática' AND grade_level IN ('11ª Classe','12ª Classe')) OR (name = 'Matemática' AND grade_level = '12ª Classe') OR (name IN ('Form. Atitudes Integradoras','Formação de Atitudes Integradoras') AND grade_level = '12ª Classe')))
   OR (preset_id = 'esg_puniv_artes' AND ((name = 'Informática' AND grade_level IN ('11ª Classe','12ª Classe')) OR (name = 'Matemática' AND grade_level IN ('11ª Classe','12ª Classe'))));

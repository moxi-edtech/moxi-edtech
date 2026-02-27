UPDATE public.school_subjects AS ss
SET custom_weekly_hours = cps.weekly_hours
FROM public.curriculum_preset_subjects AS cps
WHERE ss.preset_subject_id = cps.id
  AND ss.custom_weekly_hours <= 0
  AND cps.weekly_hours > 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'chk_school_subjects_weekly_hours_positive'
  ) THEN
    ALTER TABLE public.school_subjects
      ADD CONSTRAINT chk_school_subjects_weekly_hours_positive
      CHECK (custom_weekly_hours IS NULL OR custom_weekly_hours > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'chk_curriculum_preset_subjects_weekly_hours_positive'
  ) THEN
    ALTER TABLE public.curriculum_preset_subjects
      ADD CONSTRAINT chk_curriculum_preset_subjects_weekly_hours_positive
      CHECK (weekly_hours > 0);
  END IF;
END $$;

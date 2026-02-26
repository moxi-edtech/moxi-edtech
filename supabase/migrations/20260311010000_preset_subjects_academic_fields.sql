ALTER TABLE public.curriculum_preset_subjects
  ADD COLUMN IF NOT EXISTS conta_para_media_med boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_avaliavel boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS avaliacao_mode text DEFAULT 'inherit_school';

UPDATE public.curriculum_preset_subjects
SET
  conta_para_media_med = COALESCE(conta_para_media_med, true),
  is_avaliavel = COALESCE(is_avaliavel, true),
  avaliacao_mode = COALESCE(avaliacao_mode, 'inherit_school');

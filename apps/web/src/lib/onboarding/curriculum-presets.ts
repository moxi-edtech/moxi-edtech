import {
  CURRICULUM_PRESETS as CORE_PRESETS,
  type CurriculumKey,
  type CurriculumDisciplineBlueprint,
} from "@/lib/academico/curriculum-presets";

export type { CurriculumKey, CurriculumDisciplineBlueprint };

// Reexport as onboarding presets to keep a single source of truth
export const CURRICULUM_PRESETS = CORE_PRESETS;


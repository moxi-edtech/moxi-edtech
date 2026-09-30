export type NoRebuildConfirmInput = {
  rebuildTurmas: boolean;
  existingTurmasCount: number;
  confirmNoRebuildWithExistingTurmas: boolean;
};

export function requiresNoRebuildConfirmation(input: NoRebuildConfirmInput): boolean {
  return !input.rebuildTurmas && input.existingTurmasCount > 0 && !input.confirmNoRebuildWithExistingTurmas;
}

export type SyncTurmasSummaryInput = {
  rebuildTurmas: boolean;
  existingTurmasCount: number;
  turmasCountAfter: number;
  shouldGenerateTurmas: boolean;
  autoGenerateExecuted: boolean;
  autoGenerateSkippedReason: string | null;
  confirmNoRebuildWithExistingTurmas: boolean;
};

export function buildSyncTurmasSummary(input: SyncTurmasSummaryInput) {
  const generatedByFlow = Math.max(0, input.turmasCountAfter - input.existingTurmasCount);
  return {
    requested_rebuild: input.rebuildTurmas,
    rebuild_executado: input.rebuildTurmas,
    existing_turmas_before_publish: input.existingTurmasCount,
    existing_turmas_after_publish: input.turmasCountAfter,
    turmas_afetadas: input.rebuildTurmas ? input.existingTurmasCount : generatedByFlow,
    auto_generate_requested: input.shouldGenerateTurmas,
    auto_generate_executado: input.autoGenerateExecuted,
    auto_generate_skipped_reason: input.autoGenerateSkippedReason,
    confirm_no_rebuild_used: Boolean(input.confirmNoRebuildWithExistingTurmas),
  };
}

export function buildInstallPresetSkippedAppliedPayload(escolaId: string) {
  return {
    skipped: true,
    reason: 'already_published',
    reason_code: 'CURRICULO_JA_PUBLICADO',
    message: 'Ja existe curriculo publicado para este curso/ano letivo. Nenhuma alteracao foi aplicada.',
    recommended_action: {
      type: 'review_publish_flow',
      label: 'Revise no Academic Setup (Disciplinas/Publicar)',
      path: `/escola/${escolaId}/admin/configuracoes/turmas`,
    },
  };
}

export async function ensureCurriculumCourseOffering(
  supabase: any,
  escolaId: string,
  cursoId: string,
  presetKey: string,
) {
  const { data, error } = await supabase.rpc('ensure_k12_course_offering', {
    p_escola_id: escolaId,
    p_course_id: cursoId,
    p_curriculum_preset_id: presetKey,
  });

  if (error) {
    return { offeringId: null as string | null, error: error.message || 'Falha ao associar o calendário do curso.' };
  }

  const offeringId = Array.isArray(data) ? data[0] : data;
  return { offeringId: typeof offeringId === 'string' ? offeringId : null, error: null };
}

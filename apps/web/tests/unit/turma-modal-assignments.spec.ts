import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { planTurmaModalBatch, selectedProfessorForLegacyId } from '../../src/lib/professores/turma-modal-assignment'
import type { AssignmentCandidate } from '../../src/lib/professores/assignment-candidates'

const candidates: AssignmentCandidate[] = [
  { turma_id: '8-A', nome: '8.ª Classe A', turno: 'Manhã', curso_matriz_id: 'bio-8', professor_id: null },
  { turma_id: '5-A', nome: '5.ª Classe A', turno: 'Manhã', curso_matriz_id: 'bio-5', professor_id: null },
  { turma_id: '9-A', nome: '9.ª Classe A', turno: 'Tarde', curso_matriz_id: 'bio-9', professor_id: null },
]
const teacher = { user_id: 'profile-joao', professor_id: 'legacy-joao', nome: 'João' }
const args = {
  turmaId: '8-A',
  cursoMatrizId: 'bio-8',
  assignedProfessorId: null,
  selectedProfessor: teacher,
  candidates,
  selectedTurmaIds: ['8-A', '5-A', '9-A'],
}

describe('Turmas: atribuição múltipla no modal contextual', () => {
  it('constrói um único lote para 5.ª, 8.ª e 9.ª, respeitando a matriz de cada turma', () => {
    assert.deepEqual(planTurmaModalBatch(args), [
      { turma_id: '8-A', curso_matriz_id: 'bio-8' },
      { turma_id: '5-A', curso_matriz_id: 'bio-5' },
      { turma_id: '9-A', curso_matriz_id: 'bio-9' },
    ])
  })

  it('mantém atribuição já existente na turma de origem e inclui apenas turmas livres', () => {
    const occupied = candidates.map((item) => item.turma_id === '8-A' ? { ...item, professor_id: 'legacy-joao' } : item)
    assert.deepEqual(planTurmaModalBatch({
      ...args, assignedProfessorId: 'legacy-joao', candidates: occupied,
      selectedTurmaIds: ['5-A', '9-A'],
    }), [
      { turma_id: '5-A', curso_matriz_id: 'bio-5' },
      { turma_id: '9-A', curso_matriz_id: 'bio-9' },
    ])
  })

  it('impede trocar o docente da origem em lote', () => {
    assert.throws(() => planTurmaModalBatch({
      ...args, assignedProfessorId: 'legacy-outro',
      candidates: [{ ...candidates[0], professor_id: 'legacy-outro' }, ...candidates.slice(1)],
    }), /outro professor/)
  })

  it('bloqueia mudanças concorrentes da origem', () => {
    assert.throws(() => planTurmaModalBatch({
      ...args, candidates: [{ ...candidates[0], professor_id: 'legacy-outro' }, ...candidates.slice(1)],
    }), /mudou/)
  })

  it('não inclui turma de outro ano ou oferta diferente da matriz publicada', () => {
    assert.throws(() => planTurmaModalBatch({
      ...args, candidates: candidates.filter((item) => item.turma_id !== '8-A'),
    }), /matriz publicada/)
    assert.throws(() => planTurmaModalBatch({
      ...args, candidates: [{ ...candidates[0], curso_matriz_id: 'draft-bio-8' }, ...candidates.slice(1)],
    }), /matriz publicada/)
  })

  it('rejeita seleção que omite a turma atual ainda livre', () => {
    assert.throws(() => planTurmaModalBatch({
      ...args, selectedTurmaIds: ['5-A'],
    }), /turma de origem/)
  })

  it('bloqueia turmas já atribuídas a outro docente', () => {
    assert.throws(() => planTurmaModalBatch({
      ...args, candidates: [...candidates.slice(0, 2), { ...candidates[2], professor_id: 'outro' }],
    }), /já tem professor/)
  })

  it('rejeita duplicados, turmas desconhecidas e lotes acima de 30', () => {
    assert.throws(() => planTurmaModalBatch({ ...args, selectedTurmaIds: ['8-A', '8-A'] }), /repetidas/)
    assert.throws(() => planTurmaModalBatch({ ...args, selectedTurmaIds: ['8-A', '10-A'] }), /disponível/)
    assert.throws(() => planTurmaModalBatch({
      ...args, selectedTurmaIds: ['8-A', ...Array.from({ length: 30 }, (_, index) => 'extra-' + index)],
    }), /entre 1 e 30/)
  })

  it('usa exclusivamente user_id na API e professor_id canónico para comparar vínculos', () => {
    const found = selectedProfessorForLegacyId('legacy-joao', [
      { user_id: 'outro-profile', professor_id: 'legacy-outro' }, teacher,
    ])
    assert.equal(found?.user_id, 'profile-joao')
    assert.equal(selectedProfessorForLegacyId('profile-joao', [teacher]), null)
    assert.equal(selectedProfessorForLegacyId(null, [teacher]), null)
    assert.throws(() => planTurmaModalBatch({ ...args, selectedProfessor: { professor_id: 'legacy-joao' } }), /professor válido/)
  })
})

const modal = readFileSync(
  new URL('../../src/components/secretaria/TurmaAtribuirProfessoresModal.tsx', import.meta.url), 'utf8',
)
describe('Modal: integração com API existente e ausência de substituição implícita', () => {
  it('usa a API transacional, restringe atribuição simples e permite recarregar estado', () => {
    assert.match(modal, /\/professores\/atribuicoes-em-massa/)
    assert.match(modal, /planTurmaModalBatch/)
    assert.match(modal, /replace_existing: false/)
    assert.doesNotMatch(modal, /replace_existing: true/)
    assert.match(modal, /await refreshDisciplinas\(\)/)
    assert.match(modal, /sourceAlreadyAssigned/)
  })
})


const teachersRoute = readFileSync(
  new URL('../../src/app/api/secretaria/professores/route.ts', import.meta.url), 'utf8',
)
const singleAssignRoute = readFileSync(
  new URL('../../src/app/api/secretaria/turmas/[id]/atribuir-professor/route.ts', import.meta.url), 'utf8',
)
const readDisciplinasRoute = readFileSync(
  new URL('../../src/app/api/secretaria/turmas/[id]/disciplinas/route.ts', import.meta.url), 'utf8',
)
describe('Secretaria: paginação e autorização consistentes', () => {
  it('não pagina novamente depois de aplicar limit/offset no banco', () => {
    assert.match(teachersRoute, /const paged = filtered/)
    assert.doesNotMatch(teachersRoute, /filtered\.slice\(from, from \+ pageSize\)/)
  })
  it('permite atribuição e leitura ao papel Secretaria sem conceder edição curricular', () => {
    assert.match(singleAssignRoute, /authorizeTeacherManage\(supabase as any, escolaId, user.id\)/)
    assert.match(readDisciplinasRoute, /authorizeTeacherManage\(supabase as any, escolaId, user.id\)/)
  })
})

const replaceRoute = readFileSync(
  new URL('../../src/app/api/escolas/[id]/professores/trocar-atribuicao/route.ts', import.meta.url), 'utf8',
)
const replaceMigration = readFileSync(
  new URL('../../../../supabase/migrations/20271117172000_trocar_professor_turma_disciplina_atomic.sql', import.meta.url), 'utf8',
)

describe('Troca explícita de docente: segurança e UI', () => {
  it('apresenta confirmação específica e não mistura substituições no lote', () => {
    assert.match(modal, /Trocar professor/)
    assert.match(modal, /Rever troca/)
    assert.match(modal, /Confirmar troca/)
    assert.match(modal, /setReplaceReviewed\(false\)/)
    assert.match(modal, /professor_anterior_id: previousId/)
    assert.match(modal, /professor_novo_user_id: next\.user_id/)
    assert.doesNotMatch(modal, /replace_existing: true/)
  })

  it('autentica escola e autoriza só operadores de docentes no endpoint', () => {
    assert.match(replaceRoute, /resolveEscolaIdForUser\(supabase as any, user.id, escolaId\)/)
    assert.match(replaceRoute, /authorizeTeacherManage\(supabase as any, escolaId, user.id\)/)
    assert.match(replaceRoute, /professor_anterior_id: UUID/)
    assert.match(replaceRoute, /professor_novo_user_id: UUID/)
    assert.match(replaceRoute, /\.eq\('escola_id', escolaId\)/)
    assert.match(replaceRoute, /trocar_professor_turma_disciplina_atomic/)
  })

  it('utiliza a mesma lock e CAS do modelo individual e em lote', () => {
    assert.match(replaceMigration, /klasse:teacher-assign:/)
    assert.match(replaceMigration, /TEACHER_REPLACE_PREVIOUS_MISMATCH/)
    assert.match(replaceMigration, /cc\.status = 'published'/)
    assert.match(replaceMigration, /tu\.session_id = v_ano_id/)
  })

  it('valida carga horária e horários publicados antes de alterar os vínculos', () => {
    assert.match(replaceMigration, /TEACHER_REPLACE_WORKLOAD_EXCEEDED/)
    assert.match(replaceMigration, /TEACHER_REPLACE_SCHEDULE_CONFLICT/)
    assert.match(replaceMigration, /ov\.status='publicada'/)
    assert.match(replaceMigration, /os\.inicio<ts\.fim AND ts\.inicio<os\.fim/)
  })

  it('preserva identificadores, historial de notas e auditoria no mesmo commit', () => {
    assert.match(replaceMigration, /UPDATE public\.turma_disciplinas_professores tdp/)
    assert.match(replaceMigration, /UPDATE public\.quadro_horarios qh/)
    assert.match(replaceMigration, /INSERT INTO public\.audit_logs/)
    assert.doesNotMatch(replaceMigration, /UPDATE public\.notas|DELETE FROM public\.notas/)
    assert.doesNotMatch(replaceMigration, /DELETE FROM public\.turma_disciplinas_professores/)
    assert.match(replaceMigration, /REVOKE ALL ON FUNCTION public\.trocar_professor_turma_disciplina_atomic/)
  })
})

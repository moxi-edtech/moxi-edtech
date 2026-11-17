import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { buildTeacherAssignmentCandidates } from '../../src/lib/professores/assignment-candidates'

const turma = (id: string, classe_id: string) => ({
  id, nome: id, turno: 'M', curso_id: 'curso-escola', classe_id,
})
const matrix = (id: string, courseYear: string, classe_id: string) => ({
  id, curso_curriculo_id: courseYear, curso_id: 'curso-escola',
  classe_id, ativo: true,
})
const offer = (turma_id: string, curso_matriz_id: string, professor_id: string | null = null) => ({
  turma_id, curso_matriz_id, professor_id,
})
const base = {
  turmas: [turma('5-M-A', '5'), turma('8-T-A', '8'), turma('9-M-A', '9')],
  currentPublishedCurriculoIds: ['pub-5', 'pub-8', 'pub-9'],
  matrizes: [matrix('bio-5', 'pub-5', '5'), matrix('bio-8', 'pub-8', '8'), matrix('bio-9', 'pub-9', '9')],
  ofertas: [offer('5-M-A', 'bio-5'), offer('8-T-A', 'bio-8'), offer('9-M-A', 'bio-9')],
  links: [] as Array<{ turma_id: string; professor_id: string | null }>,
}

describe('Professor: atribuição múltipla por ano e versão curricular', () => {
  it('oferece a mesma disciplina nas 5ª, 8ª e 9ª classes, mantendo as matrizes corretas', () => {
    const result = buildTeacherAssignmentCandidates(base)
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.items.map((x) => [x.turma_id, x.curso_matriz_id]), [
      ['5-M-A', 'bio-5'], ['8-T-A', 'bio-8'], ['9-M-A', 'bio-9'],
    ])
  })

  it('não reaproveita versões antigas, draft ou matrizes de outras classes', () => {
    const result = buildTeacherAssignmentCandidates({
      ...base,
      matrizes: [
        ...base.matrizes,
        matrix('old-5', 'pub-2025', '5'),
        matrix('draft-8', 'draft-2026', '8'),
        matrix('wrong-class', 'pub-5', '9'),
      ],
      ofertas: [
        ...base.ofertas,
        offer('5-M-A', 'old-5'),
        offer('8-T-A', 'draft-8'),
        offer('5-M-A', 'wrong-class'),
      ],
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.items.length, 3)
    assert.equal(result.items[0].curso_matriz_id, 'bio-5')
  })

  it('marca atribuições existentes como ocupadas, inclusive em vínculo partilhado', () => {
    const result = buildTeacherAssignmentCandidates({
      ...base,
      ofertas: [
        offer('5-M-A', 'bio-5', 'docente-outro'),
        offer('8-T-A', 'bio-8'),
        offer('9-M-A', 'bio-9'),
      ],
      links: [{ turma_id: '8-T-A', professor_id: 'outro-partilhado' }],
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.items[0].professor_id, 'docente-outro')
    assert.equal(result.items[1].professor_id, 'outro-partilhado')
    assert.equal(result.items[2].professor_id, null)
  })

  it('não escolhe arbitrariamente quando duas matrizes publicadas disputam a mesma turma', () => {
    const result = buildTeacherAssignmentCandidates({
      ...base,
      matrizes: [...base.matrizes, matrix('bio-5-duplicate', 'pub-5', '5')],
      ofertas: [...base.ofertas, offer('5-M-A', 'bio-5-duplicate')],
    })
    assert.deepEqual(result, { ok: false, reason: 'DUPLICATE_PUBLISHED_OFFERING' })
  })
})

const migration = readFileSync(new URL('../../../../supabase/migrations/20271117110000_assign_professor_multiplas_turmas.sql', import.meta.url), 'utf8')

describe('RPC: contratos de segurança antes da homologação Postgres', () => {
  it('serializa chamadas individuais e em lote com a MESMA chave da escola', () => {
    const key = /hashtextextended\('klasse:teacher-assign:' \|\| p_escola_id::text, 0\)/g
    assert.equal([...migration.matchAll(key)].length, 2)
    assert.match(migration, /FOR UPDATE OF td/)
  })
  it('não substitui vínculo existente e torna o upsert condicional', () => {
    assert.match(migration, /ASSIGN_PROF_ALREADY_ASSIGNED/)
    assert.match(migration, /ON CONFLICT ON CONSTRAINT uq_tdp_unique_escola/)
    assert.match(migration, /WHERE public\.turma_disciplinas_professores\.professor_id = EXCLUDED\.professor_id/)
    assert.doesNotMatch(migration, /DO UPDATE SET\s+professor_id = EXCLUDED\.professor_id/)
  })
  it('confere publicação e ano escolar na RPC, não apenas no browser', () => {
    assert.match(migration, /tu\.session_id = v_ano_id/)
    assert.match(migration, /cc\.status = 'published'/)
    assert.match(migration, /cc\.ano_letivo_id = v_ano_id/)
    assert.match(migration, /GROUP BY td\.turma_id, cm\.disciplina_id/)
    assert.match(migration, /v_carga_atual \+ v_carga_nova > v_carga_maxima/)
  })
  it('confere horários publicados entre turmas por dia e intervalo sobreposto', () => {
    assert.match(migration, /ov\.status = 'publicada'/)
    assert.match(migration, /os\.dia_semana = ts\.dia_semana/)
    assert.match(migration, /os\.inicio < ts\.fim AND ts\.inicio < os\.fim/)
  })
  it('autorização da Secretaria existe no DB sem conceder direito anónimo', () => {
    assert.match(migration, /'secretaria'/)
    assert.match(migration, /REVOKE ALL ON FUNCTION public\.assign_professor_turmas_disciplina_batch/)
  })
})

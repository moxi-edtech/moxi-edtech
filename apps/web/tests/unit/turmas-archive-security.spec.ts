import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const route = readFileSync(
  fileURLToPath(new URL('../../src/app/api/escolas/[id]/turmas/[turmaId]/delete/route.ts', import.meta.url)),
  'utf8',
)
const marketplace = readFileSync(
  fileURLToPath(new URL('../../src/components/escola/settings/StructureMarketplace.tsx', import.meta.url)),
  'utf8',
)

test('debug RPC endpoint is not deployed', () => {
  assert.equal(
    existsSync(resolve(fileURLToPath(new URL('../../src/app/api', import.meta.url)), 'teste-rpc/route.ts')),
    false,
  )
})

test('legacy turma DELETE archives instead of cascading academic records', () => {
  assert.match(route, /export async function DELETE\(/)
  assert.match(route, /\.update\(\{ status_validacao: 'arquivado' \}\)/)
  assert.doesNotMatch(route, /\.delete\(|createAdminClient|SUPABASE_SERVICE_ROLE_KEY|getSupabaseAdmin/)
  assert.match(route, /turmas_audit_update/)
})

test('archive requires authenticated, tenant-scoped management authorization', () => {
  const session = route.indexOf('supabase.auth.getUser()')
  const tenant = route.indexOf('resolveEscolaIdForUser(')
  const permission = route.indexOf('authorizeTurmasManage(')
  const change = route.indexOf(".update({ status_validacao: 'arquivado' })")

  assert.ok(session !== -1 && session < tenant)
  assert.ok(tenant < permission && permission < change)
  assert.match(route, /\.eq\('escola_id', escolaId\)/)
  assert.match(route, /\.eq\('status_validacao', currentStatus\)/)
})

test('archive fails closed on enrollment lookup errors and linked enrollments', () => {
  assert.match(route, /\.from\('matriculas'\)/)
  assert.match(route, /if \(enrollmentError\)/)
  assert.match(route, /if \(matriculas\?\.length\)/)
  assert.match(route, /\{ status: 409 \}/)
  assert.ok(route.indexOf('if (matriculas?.length)') < route.indexOf(".update({ status_validacao: 'arquivado' })"))
})

test('interface labels the operation as archiving, not permanent deletion', () => {
  assert.match(marketplace, /Arquivar turmas excedentes/)
  assert.match(marketplace, /Arquivar selecionadas/)
  assert.match(marketplace, /arquivada\(s\)/)
})

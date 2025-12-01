import { test, expect } from '@playwright/test'

// This test documents that manual price/day overrides are not respected by the
// matrícula endpoint; pricing must come from financeiro_tabelas via
// resolveTabelaPreco.
test.describe('API /api/secretaria/matriculas', () => {
  test('rejects manual mensalidade override values', async ({ request }) => {
    const response = await request.post('/api/secretaria/matriculas', {
      data: {
        aluno_id: '00000000-0000-0000-0000-000000000000',
        session_id: '00000000-0000-0000-0000-000000000000',
        turma_id: '00000000-0000-0000-0000-000000000000',
        valor_mensalidade: 10,
        dia_vencimento: 5,
      },
    })

    expect(response.status()).toBeGreaterThanOrEqual(400)

    const json = await response.json().catch(() => ({ ok: false }))
    expect(json.ok).not.toBe(true)
  })
})

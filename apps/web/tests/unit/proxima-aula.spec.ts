import test from 'node:test'
import assert from 'node:assert/strict'
import { escolherProximaAula } from '../../src/lib/agenda/proximaAula'

test('segunda: escolhe slot do mesmo dia ainda em curso/futuro', () => {
  const now = new Date('2026-03-09T08:20:00') // Monday
  const result = escolherProximaAula(
    [
      { slot_id: 's1', weekday: 1, inicio: '08:00:00', fim: '08:45:00', sala: 'A1', ordem: 1 },
      { slot_id: 's2', weekday: 1, inicio: '09:00:00', fim: '09:45:00', sala: 'A1', ordem: 2 },
      { slot_id: 's3', weekday: 2, inicio: '08:00:00', fim: '08:45:00', sala: 'A1', ordem: 1 },
    ],
    now
  )

  assert.equal(result?.slot_id, 's1')
})

test('sábado à noite: fallback para próxima semana', () => {
  const now = new Date('2026-03-14T23:10:00') // Saturday
  const result = escolherProximaAula(
    [
      { slot_id: 's1', weekday: 1, inicio: '07:30:00', fim: '08:15:00', sala: 'B2', ordem: 1 },
      { slot_id: 's2', weekday: 6, inicio: '09:00:00', fim: '09:45:00', sala: 'B2', ordem: 2 },
    ],
    now
  )

  assert.equal(result?.slot_id, 's1')
})

test('domingo: normalização ISO 1..7 e escolha de segunda', () => {
  const now = new Date('2026-03-15T10:00:00') // Sunday
  const result = escolherProximaAula(
    [
      { slot_id: 's1', weekday: 1, inicio: '08:00:00', fim: '08:45:00', sala: 'C3', ordem: 1 },
      { slot_id: 's2', weekday: 7, inicio: '09:00:00', fim: '09:45:00', sala: 'C3', ordem: 2 },
    ],
    now
  )

  assert.equal(result?.slot_id, 's1')
})

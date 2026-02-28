import { z } from 'zod'

export const PAPEIS_ESCOLA_VALIDOS = [
  'admin_escola',
  'admin',
  'staff_admin',
  'secretaria',
  'financeiro',
  'secretaria_financeiro',
  'admin_financeiro',
  'professor',
  'aluno',
] as const

export type PapelEscola = (typeof PAPEIS_ESCOLA_VALIDOS)[number]

export const papelEscolaSchema = z.enum(PAPEIS_ESCOLA_VALIDOS)

export const allowedPapeisSet = new Set<string>(PAPEIS_ESCOLA_VALIDOS)

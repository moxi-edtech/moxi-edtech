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
  'formacao_admin',
  'formacao_secretaria',
  'formacao_financeiro',
  'formador',
  'formando',
] as const

export type PapelEscola = (typeof PAPEIS_ESCOLA_VALIDOS)[number]

export const papelEscolaSchema = z.enum(PAPEIS_ESCOLA_VALIDOS)

export const allowedPapeisSet = new Set<string>(PAPEIS_ESCOLA_VALIDOS)

export const K12_ADMIN_ROLE_GROUP = [
  'admin',
  'staff_admin',
  'admin_escola',
] as const satisfies readonly PapelEscola[]

export const K12_SECRETARIA_ROLE_GROUP = [
  'secretaria',
  'secretaria_financeiro',
  'admin_financeiro',
] as const satisfies readonly PapelEscola[]

export const K12_FINANCEIRO_ROLE_GROUP = [
  'financeiro',
  'secretaria_financeiro',
  'admin_financeiro',
] as const satisfies readonly PapelEscola[]

export const K12_OPERACOES_PRIMARY_ROLE = 'admin_financeiro' as const satisfies PapelEscola

export const K12_OPERACOES_ROLE_GROUP = [
  ...K12_ADMIN_ROLE_GROUP,
  ...K12_SECRETARIA_ROLE_GROUP,
] as const satisfies readonly PapelEscola[]

export const K12_SECRETARIA_OPERACIONAL_ROLE_GROUP = [
  'secretaria',
  'secretaria_financeiro',
  'admin_financeiro',
  'admin',
  'admin_escola',
  'staff_admin',
] as const satisfies readonly PapelEscola[]

export const K12_FINANCEIRO_OPERACIONAL_ROLE_GROUP = [
  'secretaria',
  'financeiro',
  'secretaria_financeiro',
  'admin_financeiro',
  'admin',
  'admin_escola',
  'staff_admin',
] as const satisfies readonly PapelEscola[]

export const K12_ADMIN_SECRETARIA_ROLE_GROUP = [
  'admin_escola',
  'secretaria',
  'admin',
  'staff_admin',
  'admin_financeiro',
] as const satisfies readonly PapelEscola[]

export const K12_ADMIN_GESTAO_ROLE_GROUP = [
  'admin',
  'admin_escola',
  'admin_financeiro',
  'staff_admin',
] as const satisfies readonly PapelEscola[]

export const K12_ESCOLA_MANAGE_ROLE_GROUP = [
  ...K12_ADMIN_ROLE_GROUP,
  ...K12_FINANCEIRO_ROLE_GROUP,
  'secretaria',
] as const satisfies readonly PapelEscola[]

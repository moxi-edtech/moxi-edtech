// Centralized role-permission mapping and helpers
// Source: roles and permissions provided by product spec

export type Papel =
  | 'admin'
  | 'staff_admin'
  | 'financeiro'
  | 'secretaria'
  | 'secretaria_financeiro'
  | 'admin_financeiro'
  | 'aluno'
  | 'professor'
  | 'admin_escola'
  | 'encarregado'
  | 'formacao_admin'
  | 'formacao_secretaria'
  | 'formacao_financeiro'
  | 'formador'
  | 'formando'

// Enumerate known permissions to get type-safety across the app
export type Permission =
  | 'criar_usuario'
  | 'editar_usuario'
  | 'remover_usuario'
  | 'configurar_escola'
  | 'gerenciar_turmas'
  | 'gerenciar_disciplinas'
  | 'visualizar_relatorios_globais'
  | 'visualizar_financeiro'
  | 'visualizar_academico'
  | 'criar_cobranca'
  | 'editar_cobranca'
  | 'registrar_pagamento'
  | 'emitir_recibo'
  | 'emitir_nota_fiscal'
  | 'gerenciar_despesas'
  | 'visualizar_fluxo_caixa'
  | 'exportar_relatorios_contabeis'
  | 'criar_matricula'
  | 'editar_matricula'
  | 'gerenciar_transferencias'
  | 'lançar_notas'
  | 'registrar_frequencia'
  | 'emitir_documentos'
  | 'enviar_comunicado'
  | 'visualizar_relatorios_academicos'
  | 'visualizar_boletim'
  | 'visualizar_frequencia'
  | 'consultar_calendario'
  | 'consultar_horarios'
  | 'visualizar_situacao_financeira'
  | 'baixar_documentos'
  | 'enviar_mensagem'
  | 'gerir_cohorts'
  | 'emitir_certificados'
  | 'gerir_faturas_b2b'
  | 'gerir_honorarios'
  | 'lancar_avaliacoes_formacao'
  | 'registar_presencas_formacao'
  | 'consultar_turmas_formador'
  | 'consultar_honorarios'
  | 'consultar_progresso_formando'
  | 'consultar_pagamentos_formando'
  | 'comprar_cursos'

// Global role enum as used in profiles/app_metadata
export type GlobalRole =
  | 'super_admin'
  | 'admin'
  | 'professor'
  | 'aluno'
  | 'secretaria'
  | 'financeiro'
  | 'secretaria_financeiro'
  | 'admin_financeiro'
  | 'admin_escola'
  | 'staff_admin'
  | 'encarregado'
  | 'formacao_admin'
  | 'formacao_secretaria'
  | 'formacao_financeiro'
  | 'formador'
  | 'formando'
  | 'global_admin'
  | 'guest'

export type ProductContext = 'k12' | 'formacao'

const K12_ADMIN_ROLE_GROUP = ['admin', 'staff_admin', 'admin_escola'] as const

const K12_COMPOSITE_ROLE_INHERITANCE: Record<string, ReadonlyArray<string>> = {
  admin: K12_ADMIN_ROLE_GROUP,
  staff_admin: K12_ADMIN_ROLE_GROUP,
  admin_escola: K12_ADMIN_ROLE_GROUP,
  secretaria_financeiro: ['secretaria_financeiro', 'secretaria', 'financeiro'],
  admin_financeiro: ['admin_financeiro', 'financeiro'],
}

export function normalizePapel(papel: Papel | string | null | undefined): Papel | null {
  if (!papel || typeof papel !== 'string') return null

  const map: Record<string, Papel> = {
    admin: 'admin',
    admin_escola: 'admin_escola',
    staff_admin: 'staff_admin',
    staff: 'staff_admin',
    administrador: 'admin_escola',
    diretor: 'admin_escola',
    gestor: 'admin_escola',
    secretaria: 'secretaria',
    secretario: 'secretaria',
    financeiro: 'financeiro',
    secretaria_financeiro: 'secretaria_financeiro',
    admin_financeiro: 'admin_financeiro',
    professor: 'professor',
    aluno: 'aluno',
    encarregado: 'encarregado',
    formacao_admin: 'formacao_admin',
    formacao_secretaria: 'formacao_secretaria',
    formacao_financeiro: 'formacao_financeiro',
    formador: 'formador',
    formando: 'formando',
  }

  const key = papel.trim().toLowerCase()
  return map[key] ?? null
}

export const PAPEL_GROUP_ESCOLA_ADMIN_SETUP: ReadonlyArray<Papel> = [
  'admin',
  'staff_admin',
  'admin_escola',
  'secretaria',
]

export function hasSomePapel(
  papel: Papel | string | null | undefined,
  allowed: ReadonlyArray<Papel>
): boolean {
  const normalized = normalizePapel(papel)
  return Boolean(normalized && allowed.includes(normalized))
}

const ADMIN_PERMISSIONS = new Set<Permission>([
  'criar_usuario',
  'editar_usuario',
  'remover_usuario',
  'configurar_escola',
  'gerenciar_disciplinas',
  'visualizar_relatorios_globais',
  'visualizar_financeiro',
  'visualizar_academico',
  'registrar_pagamento',
  'criar_matricula',
])

const ALUNO_PERMISSIONS = new Set<Permission>([
  'visualizar_boletim',
  'visualizar_frequencia',
  'consultar_calendario',
  'consultar_horarios',
  'visualizar_situacao_financeira',
  'baixar_documentos',
  'enviar_mensagem',
])

const FORMANDO_PERMISSIONS = new Set<Permission>([
  'consultar_calendario',
  'consultar_horarios',
  'consultar_progresso_formando',
  'consultar_pagamentos_formando',
  'baixar_documentos',
  'comprar_cursos',
])

// Mapping derived directly from the provided matrix.
const ROLE_PERMISSIONS: Record<Papel, ReadonlySet<Permission>> = {
  admin: ADMIN_PERMISSIONS,
  staff_admin: ADMIN_PERMISSIONS,
  admin_escola: ADMIN_PERMISSIONS,

  financeiro: new Set<Permission>([
    'criar_cobranca',
    'editar_cobranca',
    'registrar_pagamento',
    'emitir_recibo',
    'emitir_nota_fiscal',
    'gerenciar_despesas',
    'visualizar_fluxo_caixa',
    'exportar_relatorios_contabeis',
  ]),

  secretaria: new Set<Permission>([
    'criar_matricula',
    'editar_matricula',
    'gerenciar_transferencias',
    'gerenciar_turmas',
    'lançar_notas',
    'registrar_frequencia',
    'emitir_documentos',
    'enviar_comunicado',
    'visualizar_relatorios_academicos',
  ]),

  secretaria_financeiro: new Set<Permission>([
    'criar_cobranca',
    'editar_cobranca',
    'registrar_pagamento',
    'emitir_recibo',
    'emitir_nota_fiscal',
    'gerenciar_despesas',
    'visualizar_fluxo_caixa',
    'exportar_relatorios_contabeis',
    'criar_matricula',
    'editar_matricula',
    'gerenciar_transferencias',
    'gerenciar_turmas',
    'lançar_notas',
    'registrar_frequencia',
    'emitir_documentos',
    'enviar_comunicado',
    'visualizar_relatorios_academicos',
  ]),

  admin_financeiro: new Set<Permission>([
    'criar_usuario',
    'editar_usuario',
    'remover_usuario',
    'configurar_escola',
    'gerenciar_disciplinas',
    'visualizar_relatorios_globais',
    'visualizar_financeiro',
    'visualizar_academico',
    'registrar_pagamento',
    'criar_matricula',
    'criar_cobranca',
    'editar_cobranca',
    'emitir_recibo',
    'emitir_nota_fiscal',
    'gerenciar_despesas',
    'visualizar_fluxo_caixa',
    'exportar_relatorios_contabeis',
    'editar_matricula',
    'gerenciar_transferencias',
    'gerenciar_turmas',
    'lançar_notas',
    'registrar_frequencia',
    'emitir_documentos',
    'enviar_comunicado',
    'visualizar_relatorios_academicos',
  ]),

  professor: new Set<Permission>([
    'lançar_notas',
    'registrar_frequencia',
    'visualizar_academico',
  ]),

  aluno: ALUNO_PERMISSIONS,
  encarregado: ALUNO_PERMISSIONS,
  formando: FORMANDO_PERMISSIONS,

  formacao_admin: new Set<Permission>([
    'criar_usuario',
    'editar_usuario',
    'remover_usuario',
    'configurar_escola',
    'visualizar_relatorios_globais',
    'visualizar_financeiro',
    'visualizar_academico',
    'gerir_cohorts',
    'emitir_certificados',
    'gerir_faturas_b2b',
    'gerir_honorarios',
  ]),

  formacao_secretaria: new Set<Permission>([
    'criar_matricula',
    'editar_matricula',
    'gerenciar_turmas',
    'emitir_documentos',
    'emitir_certificados',
    'gerir_cohorts',
    'enviar_comunicado',
  ]),

  formacao_financeiro: new Set<Permission>([
    'criar_cobranca',
    'editar_cobranca',
    'registrar_pagamento',
    'emitir_recibo',
    'emitir_nota_fiscal',
    'visualizar_fluxo_caixa',
    'exportar_relatorios_contabeis',
    'gerir_faturas_b2b',
    'gerir_honorarios',
  ]),

  formador: new Set<Permission>([
    'lançar_notas',
    'registrar_frequencia',
    'lancar_avaliacoes_formacao',
    'registar_presencas_formacao',
    'consultar_turmas_formador',
    'consultar_honorarios',
  ]),
}

export function getPermissionsForRole(papel: Papel | string | null | undefined): ReadonlySet<Permission> {
  const normalized = normalizePapel(papel)
  if (!normalized) return new Set()
  return ROLE_PERMISSIONS[normalized] ?? new Set()
}

export function expandAllowedRolesForProduct(
  roles: ReadonlyArray<string>,
  product: ProductContext = 'k12'
): string[] {
  const normalized = roles
    .map((role) => String(role ?? '').trim().toLowerCase())
    .filter(Boolean)

  if (product !== 'k12') {
    return Array.from(new Set(normalized))
  }

  const expanded = new Set<string>()
  for (const role of normalized) {
    expanded.add(role)
    if (K12_ADMIN_ROLE_GROUP.includes(role as (typeof K12_ADMIN_ROLE_GROUP)[number])) {
      for (const inheritedRole of K12_ADMIN_ROLE_GROUP) expanded.add(inheritedRole)
    }
    if (role === 'financeiro') {
      expanded.add('secretaria_financeiro')
      expanded.add('admin_financeiro')
    }
    if (role === 'secretaria') {
      expanded.add('secretaria_financeiro')
    }
  }

  return Array.from(expanded)
}

export function roleMatchesAllowedRoles(
  role: Papel | GlobalRole | string | null | undefined,
  allowedRoles: ReadonlyArray<string>,
  product: ProductContext = 'k12'
): boolean {
  const normalizedRole = String(role ?? '').trim().toLowerCase()
  if (!normalizedRole) return false

  const expandedAllowed = new Set(expandAllowedRolesForProduct(allowedRoles, product))
  if (expandedAllowed.has(normalizedRole)) return true

  if (product !== 'k12') return false

  const inherited = K12_COMPOSITE_ROLE_INHERITANCE[normalizedRole] ?? [normalizedRole]
  return inherited.some((candidate) => expandedAllowed.has(candidate))
}

export function hasPermission(papel: Papel | string | null | undefined, perm: Permission): boolean {
  const set = getPermissionsForRole(papel)
  return set.has(perm)
}

// Convenience for common checks with multiple alternative permissions
export function hasAnyPermission(papel: Papel | string | null | undefined, perms: Permission[]): boolean {
  const set = getPermissionsForRole(papel)
  for (const p of perms) if (set.has(p)) return true
  return false
}


export function temAcessoFinanceiro(role: GlobalRole | string | null | undefined): boolean {
  return roleMatchesAllowedRoles(role, [
    'financeiro',
    'formacao_financeiro',
    'formacao_admin',
    'admin',
    'super_admin',
    'global_admin',
  ])
}

export function temAcessoSecretaria(role: GlobalRole | string | null | undefined): boolean {
  return roleMatchesAllowedRoles(role, [
    'secretaria',
    'formacao_secretaria',
    'formacao_admin',
    'admin',
    'super_admin',
    'global_admin',
  ])
}

// Map papel (vínculo na escola) to global role to keep middleware/portals consistent
export function mapPapelToGlobalRole(papel: Papel | string | null | undefined): GlobalRole {
  const normalized = normalizePapel(papel)
  switch (normalized) {
    case 'admin':
    case 'staff_admin':
    case 'admin_escola':
      return 'admin'
    case 'secretaria':
      return 'secretaria'
    case 'financeiro':
      return 'financeiro'
    case 'secretaria_financeiro':
      return 'secretaria_financeiro'
    case 'admin_financeiro':
      return 'admin_financeiro'
    case 'professor':
      return 'professor'
    case 'aluno':
      return 'aluno'
    case 'encarregado':
      return 'encarregado'
    case 'formacao_admin':
      return 'formacao_admin'
    case 'formacao_secretaria':
      return 'formacao_secretaria'
    case 'formacao_financeiro':
      return 'formacao_financeiro'
    case 'formador':
      return 'formador'
    case 'formando':
      return 'formando'
    default:
      return 'guest'
  }
}

export function getDefaultK12PortalPathForRole(
  role: GlobalRole | Papel | string | null | undefined,
  escolaParam?: string | null
): string {
  const normalized = String(role ?? '').trim().toLowerCase()
  const escolaSegment = escolaParam ? `/escola/${escolaParam}` : null

  switch (normalized) {
    case 'super_admin':
      return '/super-admin'
    case 'admin':
    case 'admin_escola':
    case 'staff_admin':
    case 'admin_financeiro':
      return escolaSegment ? `${escolaSegment}/admin/dashboard` : '/admin'
    case 'secretaria':
    case 'secretaria_financeiro':
      return escolaSegment ? `${escolaSegment}/secretaria` : '/secretaria'
    case 'financeiro':
      return escolaSegment ? `${escolaSegment}/financeiro` : '/financeiro'
    case 'professor':
      return escolaSegment ? `${escolaSegment}/professor` : '/professor'
    case 'aluno':
      return escolaSegment ? `${escolaSegment}/aluno` : '/aluno'
    default:
      return escolaSegment ? `${escolaSegment}/dashboard` : '/dashboard'
  }
}

const K12_ROLE_SET = new Set<string>([
  'admin',
  'staff_admin',
  'admin_escola',
  'secretaria',
  'secretaria_financeiro',
  'admin_financeiro',
  'financeiro',
  'professor',
  'aluno',
  'encarregado',
  'super_admin',
  'global_admin',
])

const FORMACAO_ROLE_SET = new Set<string>([
  'formacao_admin',
  'formacao_secretaria',
  'formacao_financeiro',
  'formador',
  'formando',
  'super_admin',
  'global_admin',
])

export function isRoleAllowedForProduct(
  role: GlobalRole | string | null | undefined,
  product: ProductContext
): boolean {
  const normalized = String(role ?? '').trim().toLowerCase()
  if (!normalized) return false
  if (product === 'k12') return K12_ROLE_SET.has(normalized)
  return FORMACAO_ROLE_SET.has(normalized)
}

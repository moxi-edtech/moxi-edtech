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
  | 'global_admin'
  | 'guest'

export function normalizePapel(papel: Papel | string | null | undefined): Papel | null {
  if (!papel || typeof papel !== 'string') return null

  const map: Record<string, Papel> = {
    admin: 'admin',
    admin_escola: 'admin_escola',
    staff_admin: 'staff_admin',
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
  }

  const key = papel.trim().toLowerCase()
  return map[key] ?? null
}

// Mapping derived directly from the provided matrix.
// Note: current app also uses 'admin' and 'staff_admin' for papel; we alias them to 'admin_escola'.
const ROLE_PERMISSIONS: Record<Papel, ReadonlySet<Permission>> = {
  // Alias roles map to the same permission set
  admin: new Set<Permission>([]), // will be replaced below
  staff_admin: new Set<Permission>([]), // will be replaced below

  admin_escola: new Set<Permission>([
    'criar_usuario',
    'editar_usuario',
    'remover_usuario',
    'configurar_escola',
    'gerenciar_disciplinas',
    'visualizar_relatorios_globais',
    'visualizar_financeiro',
    'visualizar_academico',
    // Extend to preserve current behavior where admins can act across modules
    'registrar_pagamento',
    'criar_matricula',
  ]),

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
  ]),

  professor: new Set<Permission>([
    'lançar_notas',
    'registrar_frequencia',
    'visualizar_academico',
  ]),

  aluno: new Set<Permission>([
    'visualizar_boletim',
    'visualizar_frequencia',
    'consultar_calendario',
    'consultar_horarios',
    'visualizar_situacao_financeira',
    'baixar_documentos',
    'enviar_mensagem',
  ]),
}

// Alias papel 'admin' and 'staff_admin' to the 'admin_escola' set
// This preserves current behavior where 'admin'/'staff_admin' are used
;(ROLE_PERMISSIONS as any).admin = ROLE_PERMISSIONS.admin_escola
;(ROLE_PERMISSIONS as any).staff_admin = ROLE_PERMISSIONS.admin_escola

export function getPermissionsForRole(papel: Papel | string | null | undefined): ReadonlySet<Permission> {
  const normalized = normalizePapel(papel)
  if (!normalized) return new Set()
  return ROLE_PERMISSIONS[normalized] ?? new Set()
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
  return [
    'financeiro',
    'secretaria_financeiro',
    'admin_financeiro',
    'admin',
    'super_admin',
    'global_admin',
  ].includes(String(role ?? ''))
}

export function temAcessoSecretaria(role: GlobalRole | string | null | undefined): boolean {
  return [
    'secretaria',
    'secretaria_financeiro',
    'admin_financeiro',
    'admin',
    'super_admin',
    'global_admin',
  ].includes(String(role ?? ''))
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
    default:
      return 'guest'
  }
}

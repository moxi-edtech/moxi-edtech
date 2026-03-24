import { NextResponse } from 'next/server'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import type { Database } from '~types/supabase'
import { recordAuditServer } from '@/lib/audit'
import { isSuperAdminRole } from '@/lib/auth/requireSuperAdminAccess'
import { allowedPapeisSet } from '@/lib/roles'
import { PayloadLimitError, readJsonWithLimit } from '@/lib/http/readJsonWithLimit'
import { z } from 'zod'

const SUPER_ADMIN_USERS_UPDATE_MAX_JSON_BYTES = 64 * 1024 // 64KB
const UserUpdatesSchema = z.object({
  nome: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  telefone: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  escola_id: z.string().uuid().nullable().optional(),
  papel_escola: z.string().nullable().optional(),
})
const UpdateBodySchema = z.object({
  userId: z.string().uuid(),
  updates: UserUpdatesSchema.default({}),
})
type EscolaUserPapel = Exclude<Database['public']['Tables']['escola_users']['Insert']['papel'], null | undefined>
type ProfileUpdate = Database['public']['Tables']['profiles']['Update']
type EscolaUserLink = { escola_id: string }

export async function POST(request: Request) {
  try {
    const rawBody = await readJsonWithLimit(request, {
      maxBytes: SUPER_ADMIN_USERS_UPDATE_MAX_JSON_BYTES,
    })
    const parsedBody = UpdateBodySchema.safeParse(rawBody)
    if (!parsedBody.success) {
      return NextResponse.json({ ok: false, error: parsedBody.error.issues[0]?.message ?? 'Payload inválido' }, { status: 400 })
    }
    const { userId, updates } = parsedBody.data

    // AuthZ: somente super_admin
    const s = await supabaseServerTyped<Database>()
    const { data: sess } = await s.auth.getUser()
    const current = sess?.user
    if (!current) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    const { data: rows } = await s.from('profiles').select('role').eq('user_id', current.id).order('created_at', { ascending: false }).limit(1)
    const role = rows?.[0]?.role as string | undefined
    if (!isSuperAdminRole(role)) {
      return NextResponse.json({ ok: false, error: 'Somente Super Admin' }, { status: 403 })
    }

    // Campos do profile que podemos atualizar diretamente
    const profilePatch: ProfileUpdate = {}
    if (updates.nome !== undefined) profilePatch.nome = updates.nome ?? undefined
    if (updates.email !== undefined) profilePatch.email = updates.email?.toString().trim().toLowerCase() ?? null
    if (updates.telefone !== undefined) profilePatch.telefone = updates.telefone
    if (updates.role !== undefined && updates.role !== null) profilePatch.role = updates.role as Database['public']['Enums']['user_role']
    if (updates.escola_id !== undefined) profilePatch.escola_id = updates.escola_id

    // Manter vínculo com escola e papel
    // Helper: normalize papel_escola to match DB constraint and validate
    const normalizePapel = (p: string | null | undefined): EscolaUserPapel | null => {
      if (!p) return null
      const legacyMap: Record<string, string> = {
        diretor: 'admin_escola',
        administrador: 'admin',
        secretario: 'secretaria',
        coordenador: 'admin_escola',
      }
      return (legacyMap[p] || p) as EscolaUserPapel
    }
    const allowedPapeis = allowedPapeisSet

    if (updates.escola_id !== undefined) {
      const escolaId = updates.escola_id
      const normalizedRole = normalizePapel(updates.role)
      const papel =
        normalizePapel(updates.papel_escola) ??
        (normalizedRole && allowedPapeis.has(normalizedRole) ? normalizedRole : null)
      if (papel && !allowedPapeis.has(papel)) {
        return NextResponse.json({ ok: false, error: `Papel inválido: ${papel}` }, { status: 400 })
      }
      if (escolaId && !papel) {
        return NextResponse.json({ ok: false, error: 'Papel da escola é obrigatório.' }, { status: 400 })
      }

      if (papel) profilePatch.role = papel as Database['public']['Enums']['user_role']

      // Busca vínculos existentes
      const { data: vincs, error: vErr } = await s
        .from('escola_users')
        .select('escola_id')
        .eq('user_id', userId)
      if (vErr) return NextResponse.json({ ok: false, error: vErr.message }, { status: 400 })
      const links = (vincs ?? []) as EscolaUserLink[]

      if (!escolaId) {
        // Remover todos os vínculos e limpar escola do profile
        if (links.length > 0) {
          const { error: delV } = await s.from('escola_users').delete().eq('user_id', userId)
          if (delV) return NextResponse.json({ ok: false, error: delV.message }, { status: 400 })
        }
        profilePatch.escola_id = null
      } else {
        const hasSame = links.some((v) => String(v.escola_id) === String(escolaId))
        // Remove vínculos de outras escolas, mantendo/ajustando apenas a atual
        if (links.length > 0) {
          const others = links.filter((v) => String(v.escola_id) !== String(escolaId))
          if (others.length > 0) {
            const ids = others.map((v) => v.escola_id)
            await s.from('escola_users').delete().eq('user_id', userId).in('escola_id', ids)
          }
        }
        if (!hasSame) {
          const { error: insV } = await s
            .from('escola_users')
            .insert([{ escola_id: escolaId, user_id: userId, papel: papel || 'secretaria' }])
          if (insV) return NextResponse.json({ ok: false, error: insV.message }, { status: 400 })
        } else if (papel !== null) {
          // Atualiza papel se fornecido
          const { error: upV } = await s
            .from('escola_users')
            .update({ papel })
            .eq('user_id', userId)
            .eq('escola_id', escolaId)
          if (upV) return NextResponse.json({ ok: false, error: upV.message }, { status: 400 })
        }

        // Garante escola_id no profile
        profilePatch.escola_id = escolaId
      }
    } else if (updates.papel_escola !== undefined) {
      // Se apenas papel mudar, tenta aplicar no vínculo atual (se existir)
      const normalizedRole = normalizePapel(updates.role)
      const papelFromPayload = normalizePapel(updates.papel_escola)
      const papelToUse =
        papelFromPayload ?? (normalizedRole && allowedPapeis.has(normalizedRole) ? normalizedRole : null)

      const { data: vinc, error: vErr } = await s
        .from('escola_users')
        .select('escola_id')
        .eq('user_id', userId)
        .limit(1)
      if (vErr) return NextResponse.json({ ok: false, error: vErr.message }, { status: 400 })
      const escolaId = vinc?.[0]?.escola_id
      if (escolaId) {
        if (papelToUse && !allowedPapeis.has(papelToUse)) {
          return NextResponse.json({ ok: false, error: `Papel inválido: ${papelToUse}` }, { status: 400 })
        }
        if (papelToUse) profilePatch.role = papelToUse as Database['public']['Enums']['user_role']
        const { error: upV } = await s
          .from('escola_users')
          .update({ papel: papelToUse ?? undefined })
          .eq('user_id', userId)
          .eq('escola_id', escolaId)
        if (upV) return NextResponse.json({ ok: false, error: upV.message }, { status: 400 })
      }
    }

    if (Object.keys(profilePatch).length > 0) {
      const { error: upErr } = await s
        .from('profiles')
        .update(profilePatch)
        .eq('user_id', userId)
      if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 })
    }

    recordAuditServer({
      escolaId: updates.escola_id ?? null,
      portal: 'super_admin',
      acao: 'USUARIO_ATUALIZADO',
      entity: 'usuario',
      entityId: userId,
      details: { updates },
    }).catch(() => null)

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof PayloadLimitError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      )
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Erro ao atualizar usuário' },
      { status: 500 }
    )
  }
}

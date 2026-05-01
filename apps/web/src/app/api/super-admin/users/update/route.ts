import { NextResponse } from 'next/server'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import type { Database } from '~types/supabase'
import { recordAuditServer } from '@/lib/audit'
import { isSuperAdminRole } from '@/lib/auth/requireSuperAdminAccess'
import { callAuthAdminJob } from '@/lib/auth-admin-job'
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
type AuthUserLookup = { user?: { id?: string | null } | null }

const normalizeEmail = (value: string | null | undefined) => {
  const email = value?.toString().trim().toLowerCase() ?? ''
  return email.length > 0 ? email : null
}

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

    const { data: targetProfile, error: targetProfileErr } = await s
      .from('profiles')
      .select('user_id,email,email_real,email_auth,role,escola_id,current_escola_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (targetProfileErr) return NextResponse.json({ ok: false, error: targetProfileErr.message }, { status: 400 })
    if (!targetProfile) {
      return NextResponse.json({ ok: false, error: 'Usuário não encontrado.' }, { status: 404 })
    }

    const emailAudit: {
      old_email: string | null
      new_email: string | null
      auth_email_updated: boolean
    } = {
      old_email: targetProfile.email_auth ?? targetProfile.email_real ?? targetProfile.email ?? null,
      new_email: null,
      auth_email_updated: false,
    }

    // Campos do profile que podemos atualizar diretamente
    const profilePatch: ProfileUpdate = {}
    if (updates.nome !== undefined) profilePatch.nome = updates.nome ?? undefined
    if (updates.email !== undefined) {
      const nextEmail = normalizeEmail(updates.email)
      if (!nextEmail) {
        return NextResponse.json({ ok: false, error: 'E-mail é obrigatório para usuários com acesso ao sistema.' }, { status: 400 })
      }

      const currentEmail = normalizeEmail(emailAudit.old_email)
      if (nextEmail !== currentEmail) {
        const found = (await callAuthAdminJob(request, 'findUserByEmail', { email: nextEmail })) as AuthUserLookup
        const foundUserId = found.user?.id ? String(found.user.id) : null
        if (foundUserId && foundUserId !== userId) {
          return NextResponse.json({ ok: false, error: 'Este e-mail já pertence a outro usuário.' }, { status: 409 })
        }

        const { data: profileEmailConflicts, error: profileEmailConflictErr } = await s
          .from('profiles')
          .select('user_id')
          .or(`email.eq.${nextEmail},email_real.eq.${nextEmail},email_auth.eq.${nextEmail}`)
          .neq('user_id', userId)
          .limit(1)
        if (profileEmailConflictErr) {
          return NextResponse.json({ ok: false, error: profileEmailConflictErr.message }, { status: 400 })
        }
        if ((profileEmailConflicts ?? []).length > 0) {
          return NextResponse.json({ ok: false, error: 'Este e-mail já está registado noutro perfil.' }, { status: 409 })
        }

        await callAuthAdminJob(request, 'updateUserById', {
          userId,
          attributes: { email: nextEmail, email_confirm: true },
        })
        emailAudit.auth_email_updated = true
      }

      profilePatch.email = nextEmail
      profilePatch.email_real = nextEmail
      profilePatch.email_auth = nextEmail
      emailAudit.new_email = nextEmail
    }
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

    if (emailAudit.new_email) {
      const { data: formacaoLinks, error: formacaoLinksErr } = await s
        .from('escola_users')
        .select('escola_id,papel')
        .eq('user_id', userId)
        .in('papel', ['formacao_admin'])
      if (formacaoLinksErr) {
        return NextResponse.json({ ok: false, error: formacaoLinksErr.message }, { status: 400 })
      }

      const linkedCentroIds = Array.from(
        new Set((formacaoLinks ?? []).map((link) => link.escola_id).filter((id): id is string => Boolean(id)))
      )

      if (linkedCentroIds.length > 0) {
        const { data: centros, error: centrosErr } = await s
          .from('centros_formacao')
          .select('escola_id,email')
          .in('escola_id', linkedCentroIds)
        if (centrosErr) return NextResponse.json({ ok: false, error: centrosErr.message }, { status: 400 })

        const oldEmail = normalizeEmail(emailAudit.old_email)
        const centroIdsToSync = (centros ?? [])
          .filter((centro) => {
            const currentCentroEmail = normalizeEmail(centro.email)
            return !currentCentroEmail || currentCentroEmail === oldEmail
          })
          .map((centro) => centro.escola_id)
          .filter((id): id is string => Boolean(id))

        if (centroIdsToSync.length > 0) {
          const { error: centroEmailErr } = await s
            .from('centros_formacao')
            .update({ email: emailAudit.new_email })
            .in('escola_id', centroIdsToSync)
          if (centroEmailErr) return NextResponse.json({ ok: false, error: centroEmailErr.message }, { status: 400 })
        }
      }
    }

    recordAuditServer({
      escolaId: updates.escola_id ?? null,
      portal: 'super_admin',
      acao: 'USUARIO_ATUALIZADO',
      entity: 'usuario',
      entityId: userId,
      details: {
        updates,
        email_sync: emailAudit.new_email ? emailAudit : null,
      },
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

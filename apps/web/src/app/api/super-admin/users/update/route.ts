import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import type { Database } from '~types/supabase'
import { recordAuditServer } from '@/lib/audit'
import { isSuperAdminRole } from '@/lib/auth/requireSuperAdminAccess'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const userId = String(body?.userId || '')
    const updates = (body?.updates || {}) as Partial<{
      nome: string | null
      email: string | null
      telefone: string | null
      role: Database['public']['Enums']['user_role'] | string | null
      numero_login: string | null
      escola_id: string | null
      papel_escola: string | null
    }>

    if (!userId) return NextResponse.json({ ok: false, error: 'userId ausente' }, { status: 400 })

    // AuthZ: somente super_admin
    const s = await supabaseServer()
    const { data: sess } = await s.auth.getUser()
    const current = sess?.user
    if (!current) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    const { data: rows } = await s.from('profiles').select('role').eq('user_id', current.id).order('created_at', { ascending: false }).limit(1)
    const role = (rows?.[0] as any)?.role as string | undefined
    if (!isSuperAdminRole(role)) {
      return NextResponse.json({ ok: false, error: 'Somente Super Admin' }, { status: 403 })
    }

    // Campos do profile que podemos atualizar diretamente
    const profilePatch: Record<string, any> = {}
    if (updates.nome !== undefined) profilePatch.nome = updates.nome
    if (updates.email !== undefined) profilePatch.email = updates.email?.toString().trim().toLowerCase() ?? null
    if (updates.telefone !== undefined) profilePatch.telefone = updates.telefone
    if (updates.role !== undefined && updates.role !== null) profilePatch.role = updates.role as any
    if (updates.numero_login !== undefined) profilePatch.numero_login = updates.numero_login
    if (updates.escola_id !== undefined) profilePatch.escola_id = updates.escola_id

    if (Object.keys(profilePatch).length > 0) {
      const { error: upErr } = await (s as any)
        .from('profiles' as any)
        .update(profilePatch)
        .eq('user_id', userId)
      if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 })
    }

    // Manter vínculo com escola e papel
    // Helper: normalize papel_escola to match DB constraint and validate
    const normalizePapel = (p: string | null | undefined): string | null => {
      if (!p) return null
      const legacyMap: Record<string, string> = {
        diretor: 'admin_escola',
        administrador: 'admin',
        secretario: 'secretaria',
        coordenador: 'admin_escola',
      }
      return (legacyMap[p] || p)
    }
    const allowedPapeis = new Set(['admin','staff_admin','financeiro','secretaria','aluno','professor','admin_escola'])

    if (updates.escola_id !== undefined) {
      const escolaId = updates.escola_id
      const papel = normalizePapel(updates.papel_escola) ?? null
      if (papel && !allowedPapeis.has(papel)) {
        return NextResponse.json({ ok: false, error: `Papel inválido: ${papel}` }, { status: 400 })
      }

      // Busca vínculos existentes
      const { data: vincs, error: vErr } = await (s as any)
        .from('escola_users' as any)
        .select('escola_id')
        .eq('user_id', userId)
      if (vErr) return NextResponse.json({ ok: false, error: vErr.message }, { status: 400 })

      if (!escolaId) {
        // Remover todos os vínculos e limpar escola do profile
        if ((vincs || []).length > 0) {
          const { error: delV } = await (s as any).from('escola_users' as any).delete().eq('user_id', userId)
          if (delV) return NextResponse.json({ ok: false, error: delV.message }, { status: 400 })
        }
        await (s as any).from('profiles' as any).update({ escola_id: null as any }).eq('user_id', userId)
      } else {
        const hasSame = (vincs || []).some((v: any) => String(v.escola_id) === String(escolaId))
        // Remove vínculos de outras escolas, mantendo/ajustando apenas a atual
        if ((vincs || []).length > 0) {
          const others = (vincs || []).filter((v: any) => String(v.escola_id) !== String(escolaId))
          if (others.length > 0) {
            const ids = others.map((v: any) => v.escola_id)
            await (s as any).from('escola_users' as any).delete().eq('user_id', userId).in('escola_id', ids as any)
          }
        }
        if (!hasSame) {
          const { error: insV } = await (s as any)
            .from('escola_users' as any)
            .insert([{ escola_id: escolaId, user_id: userId, papel: papel || 'secretaria' }])
          if (insV) return NextResponse.json({ ok: false, error: insV.message }, { status: 400 })
        } else if (papel !== null) {
          // Atualiza papel se fornecido
          const { error: upV } = await (s as any)
            .from('escola_users' as any)
            .update({ papel })
            .eq('user_id', userId)
            .eq('escola_id', escolaId)
          if (upV) return NextResponse.json({ ok: false, error: upV.message }, { status: 400 })
        }

        // Garante escola_id no profile
        await (s as any).from('profiles' as any).update({ escola_id: escolaId } as any).eq('user_id', userId)
      }
    } else if (updates.papel_escola !== undefined) {
      // Se apenas papel mudar, tenta aplicar no vínculo atual (se existir)
      const { data: vinc, error: vErr } = await (s as any)
        .from('escola_users' as any)
        .select('escola_id')
        .eq('user_id', userId)
        .limit(1)
      if (vErr) return NextResponse.json({ ok: false, error: vErr.message }, { status: 400 })
      const escolaId = vinc?.[0]?.escola_id
      if (escolaId) {
        const papel = normalizePapel(updates.papel_escola)
        if (papel && !allowedPapeis.has(papel)) {
          return NextResponse.json({ ok: false, error: `Papel inválido: ${papel}` }, { status: 400 })
        }
        const { error: upV } = await (s as any)
          .from('escola_users' as any)
          .update({ papel })
          .eq('user_id', userId)
          .eq('escola_id', escolaId)
        if (upV) return NextResponse.json({ ok: false, error: upV.message }, { status: 400 })
      }
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
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Erro ao atualizar usuário' },
      { status: 500 }
    )
  }
}

import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { recordAuditServer } from '@/lib/audit'
import { isSuperAdminRole } from '@/lib/auth/requireSuperAdminAccess'
import { PayloadLimitError, readJsonWithLimit } from '@/lib/http/readJsonWithLimit'
import type { Database } from '~types/supabase'
import { z } from 'zod'

const SUPER_ADMIN_USERS_DELETE_MAX_JSON_BYTES = 64 * 1024 // 64KB
const DeleteBodySchema = z.object({ userId: z.string().uuid() })
type RpcErrorLike = { message?: string } | null
type RpcResult<T> = { data: T | null; error: RpcErrorLike }

export async function POST(request: Request) {
  try {
    const rawBody = await readJsonWithLimit(request, {
      maxBytes: SUPER_ADMIN_USERS_DELETE_MAX_JSON_BYTES,
    })
    const parsedBody = DeleteBodySchema.safeParse(rawBody)
    if (!parsedBody.success) {
      return NextResponse.json({ ok: false, error: parsedBody.error.issues[0]?.message ?? 'Payload inválido' }, { status: 400 })
    }
    const { userId } = parsedBody.data

    // AuthZ: somente super_admin
    const s = await supabaseServerTyped<Database>()
    const { data: { user: currentUser }, error: authError } = await s.auth.getUser()
    
    if (authError || !currentUser) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    }

    // Verificar se o usuário atual é super_admin
    const { data: profile, error: profileError } = await s
      .from('profiles')
      .select('role')
      .eq('user_id', currentUser.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ ok: false, error: 'Perfil não encontrado' }, { status: 403 })
    }

    if (!isSuperAdminRole(profile.role)) {
      return NextResponse.json({ ok: false, error: 'Somente Super Admin' }, { status: 403 })
    }

    console.log(`[Super Admin] Iniciando exclusão do usuário: ${userId}`)

    // 0. Opcional: obter export dos dados via RPC antes de qualquer modificação
    const { data: exportData, error: exportError } =
      (await s.rpc('get_user_export_json', { p_user_id: userId })) as unknown as RpcResult<unknown>

    if (exportError) {
      console.error('[Super Admin] Erro ao exportar dados do usuário:', exportError.message ?? exportError)
      // Não abortamos por padrão; apenas logamos. Se preferires abortar, devolve 500 aqui.
      // return NextResponse.json({ ok: false, error: 'Erro ao exportar dados do usuário' }, { status: 500 })
    } else {
      console.log('[Super Admin] Dados exportados (preparados para backup).')
      // Se quiseres salvar no Storage supabase, descomenta e configure o bucket:
      /*
      try {
        const bucket = 'user-exports' // <-- atualiza para o bucket que preferires
        const filename = `exports/${userId}_${new Date().toISOString()}.json`
        const payload = JSON.stringify(exportData)
        const { error: uploadError } = await admin.storage.from(bucket).upload(filename, new Blob([payload], { type: 'application/json' }), { upsert: true })
        if (uploadError) {
          console.warn('[Super Admin] Falha ao gravar export no Storage:', uploadError.message)
        } else {
          console.log('[Super Admin] Export gravado em storage:', filename)
        }
      } catch (e) {
        console.warn('[Super Admin] Exceção ao gravar export no Storage:', e)
      }
      */
    }

    // 1. Arquivar profile no DB (move para profiles_archive + marca deleted_at)
    const { error: archiveError } =
      (await s.rpc('move_profile_to_archive', {
        p_user_id: userId,
        p_performed_by: currentUser.id,
      })) as unknown as RpcResult<unknown>

    if (archiveError) {
      console.error('[Super Admin] Erro ao arquivar profile:', archiveError.message ?? archiveError)
      return NextResponse.json({ ok: false, error: 'Erro ao arquivar profile', details: archiveError.message ?? String(archiveError) }, { status: 500 })
    } else {
      console.log('[Super Admin] Profile arquivado com sucesso')
    }

    // 2. Limpeza de dados dependentes (mantive a sequência que tinhas)
    // 2.1 atribuicoes_prof
    try {
      const { error: atribuicoesError } = await s
        .from('atribuicoes_prof')
        .delete()
        .eq('professor_user_id', userId)
      if (atribuicoesError) {
        console.error(`[Super Admin] Erro ao excluir de atribuicoes_prof: ${atribuicoesError.message}`)
      } else {
        console.log(`[Super Admin] Usuário removido de atribuicoes_prof: ${userId}`)
      }
    } catch (e) {
      console.error('[Super Admin] Exceção ao limpar atribuicoes_prof:', e)
    }

    // 2.2 rotinas
    try {
      const { error: rotinasError } = await s
        .from('rotinas')
        .delete()
        .eq('professor_user_id', userId)
      if (rotinasError) {
        console.error(`[Super Admin] Erro ao excluir de rotinas: ${rotinasError.message}`)
      } else {
        console.log(`[Super Admin] Usuário removido de rotinas: ${userId}`)
      }
    } catch (e) {
      console.error('[Super Admin] Exceção ao limpar rotinas:', e)
    }

    // 3. Remover de escola_users (se existir)
    try {
      const { error: escolaUsuariosError } = await s
        .from('escola_users')
        .delete()
        .eq('user_id', userId)
      if (escolaUsuariosError) {
        console.error(`[Super Admin] Erro ao excluir de escola_users: ${escolaUsuariosError.message}`)
        return NextResponse.json(
          { ok: false, error: 'Erro ao remover usuário de escola_users', details: escolaUsuariosError.message },
          { status: 500 }
        )
      } else {
        console.log(`[Super Admin] Usuário removido de escola_users: ${userId}`)
      }
    } catch (e) {
      console.error('[Super Admin] Exceção ao limpar escola_users:', e)
    }

    // 4. (Opcional) Se ainda quiseres excluir a linha profiles permanentemente:
    // Como já arquivámos e marcámos deleted_at, não é obrigatório deletar; mas se quiseres:
    /*
    try {
      const { error: profilesErrorDelete } = await admin
        .from('profiles')
        .delete()
        .eq('user_id', userId)
      if (profilesErrorDelete) {
        console.error(`[Super Admin] Erro ao excluir de profiles: ${profilesErrorDelete.message}`)
        return NextResponse.json(
          { ok: false, error: 'Erro ao remover usuário de profiles', details: profilesErrorDelete.message },
          { status: 500 }
        )
      } else {
        console.log(`[Super Admin] Usuário removido de profiles: ${userId}`)
      }
    } catch (e) {
      console.error('[Super Admin] Exceção ao excluir profiles:', e)
    }
    */

    // 5. Operações Auth requerem service role; manter apenas limpeza em DB
    const authDeletionSuccess = false
    const authDeletionMessage = 'Usuário no Auth não foi removido (service role banido).'

    // 6. Revalidar cache para atualizar a UI
    revalidatePath('/super-admin/usuarios')
    revalidatePath('/super-admin')

    console.log(`[Super Admin] Processo concluído para usuário: ${userId}`)

    recordAuditServer({
      escolaId: null,
      portal: 'super_admin',
      acao: 'USUARIO_ARQUIVADO',
      entity: 'usuario',
      entityId: userId,
      details: { authDeleted: authDeletionSuccess },
    }).catch(() => null)

    return NextResponse.json({ 
      ok: true, 
      message: 'Operação completada (export + archive + limpeza).',
      authDeleted: authDeletionSuccess,
      authMessage: authDeletionMessage,
    })

  } catch (error) {
    if (error instanceof PayloadLimitError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      )
    }
    console.error(`[Super Admin] Erro inesperado ao processar exclusão:`, error)
    
    return NextResponse.json(
      { 
        ok: false, 
        error: 'Erro interno ao excluir usuário',
        ...(process.env.NODE_ENV === 'development' && {
          debug: error instanceof Error ? error.message : String(error),
        }),
      },
      { status: 500 }
    )
  }
}

// Adicionar método DELETE para seguir padrões REST
export async function DELETE(request: Request) {
  return POST(request)
}

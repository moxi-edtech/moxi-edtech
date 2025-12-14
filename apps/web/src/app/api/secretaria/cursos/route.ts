//app/api/escolas/[id]/cursos/route.ts
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser, authorizeEscolaAction } from '@/lib/escola/disciplinas'
import type { Database } from "~types/supabase"

// --- HELPERS PARA PADRONIZAÇÃO ---
const normalizeNome = (nome: string): string =>
  nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")

const makeCursoCodigo = (nome: string, escolaId: string): string => {
  // Pega os primeiros 8 chars do ID da escola para criar um prefixo único
  const prefix = escolaId.replace(/-/g, "").slice(0, 8)
  return `${prefix}_${normalizeNome(nome)}`
}

// --- GET: Listar Cursos ---
export async function GET() {
  try {
    const s = await supabaseServer()
    const headers = new Headers()
    const { data: userRes } = await s.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const escolaId = await resolveEscolaIdForUser(s as any, user.id)
    if (!escolaId) return NextResponse.json({ ok: true, items: [] }, { headers })

    const authz = await authorizeEscolaAction(s as any, escolaId, user.id, [])
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 })

    headers.set('Deprecation', 'true')
    headers.set('Link', `</api/escolas/${escolaId}/cursos>; rel="successor-version"`)

    // Tenta usar Admin Client para ler a View (bypass RLS se necessário para views complexas)
    const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (adminUrl && serviceRole) {
      const admin = createAdminClient<Database>(adminUrl, serviceRole)
      const { data, error } = await (admin as any)
        .from('vw_cursos_reais')
        .select('id, nome, tipo')
        .eq('escola_id', escolaId)
        .order('nome')
      if (!error) return NextResponse.json({ ok: true, items: data || [] }, { headers })
    }

    // Fallback cliente normal
    const { data, error } = await s
      .from('vw_cursos_reais')
      .select('id, nome, tipo')
      .eq('escola_id', escolaId)
      .order('nome')
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400, headers })
    return NextResponse.json({ ok: true, items: data || [] }, { headers })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

// --- POST: Criar Curso Manualmente (COM BLINDAGEM) ---
export async function POST(req: NextRequest) {
  try {
    const s = await supabaseServer()
    const headers = new Headers()
    
    // 1. Auth e Escola
    const { data: userRes } = await s.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const escolaId = await resolveEscolaIdForUser(s as any, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 })

    const authz = await authorizeEscolaAction(s as any, escolaId, user.id, ['configurar_escola'])
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Acesso negado' }, { status: 403 })

    headers.set('Deprecation', 'true')
    headers.set('Link', `</api/escolas/${escolaId}/cursos>; rel="successor-version"`)

    // 2. Parse do Body
    const body = await req.json()
    const { nome, tipo } = body

    if (!nome || !tipo) {
      return NextResponse.json({ ok: false, error: 'Nome e Tipo são obrigatórios' }, { status: 400 })
    }

    // 3. Gerar código único para o curso (Consistência com o Wizard)
    const codigo = makeCursoCodigo(nome, escolaId)

    // 4. Inserção com Tratamento de Erro
    // Nota: Como não temos 'curso_global_id' na criação manual simples, 
    // assumimos is_custom = true (Curso próprio da escola)
    const { data, error } = await s
      .from('cursos')
      .insert({
        escola_id: escolaId,
        nome,
        tipo,
        codigo,
        is_custom: true // Manualmente criado = Customizado
      })
      .select()
      .single()

    if (error) {
      // [BLINDAGEM] Tratamento de Duplicidade (23505)
      if (error.code === '23505') {
        return NextResponse.json(
          { 
            ok: false, 
            error: `O curso "${nome}" já existe nesta escola.` 
          }, 
          { status: 409 } // Conflict
        )
      }
      throw error
    }

    return NextResponse.json({ 
      ok: true, 
      data, 
      message: 'Curso criado com sucesso' 
    }, { headers })

  } catch (e: any) {
    console.error("Erro POST Cursos:", e)
    return NextResponse.json({ ok: false, error: e.message || String(e) }, { status: 500 })
  }
}

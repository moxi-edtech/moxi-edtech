//app/api/escolas/[id]/disciplinas/route.ts
import { NextResponse } from 'next/server'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { authorizeDisciplinaManage, resolveEscolaIdForUser } from '@/lib/escola/disciplinas'

// --- GET: Listar Disciplinas ---
export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>()
    const headers = new Headers()
    
    // 1. Auth
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    // 2. Resolve escola via shared helper
    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id)
    if (!escolaId) return NextResponse.json({ ok: true, items: [] }, { headers })

    // 3. Permission gate aligned to escola routes
    const authz = await authorizeDisciplinaManage(supabase as any, escolaId, user.id)
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 })

    headers.set('Deprecation', 'true')
    headers.set('Link', `</api/escolas/${escolaId}/disciplinas>; rel="successor-version"`)

    // 3. Filtros opcionais (Ex: filtrar disciplinas de um curso específico)
    const { searchParams } = new URL(req.url)
    const cursoId = searchParams.get('curso_id')
    const classeNome = searchParams.get('classe_nome')

    let query = supabase
        .from('disciplinas')
        .select('*') // Retornar tudo para ter acesso a curso_id e classe_nome
        .eq('escola_id', escolaId)
        .order('nome', { ascending: true });

    if (cursoId) query = query.eq('curso_escola_id', cursoId)
    if (classeNome) query = query.eq('classe_nome', classeNome)

    const { data, error } = await query

    if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 400, headers });
    }

    return NextResponse.json({ ok: true, items: data }, { headers });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

// --- POST: Criar Disciplina (COM BLINDAGEM) ---
export async function POST(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>()
    const headers = new Headers()
    
    // 1. Auth
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    // 2. Escola
    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 })

    // 3. Permission gate
    const authz = await authorizeDisciplinaManage(supabase as any, escolaId, user.id)
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 })

    headers.set('Deprecation', 'true')
    headers.set('Link', `</api/escolas/${escolaId}/disciplinas>; rel="successor-version"`)

    const body = await req.json()
    const { 
      nome, 
      curso_id, // Front deve mandar o ID do curso
      classe_nome, // Ex: "10ª Classe"
      nivel_ensino, // Ex: "secundario1"
      tipo // Ex: "core"
    } = body

    if (!nome || !curso_id || !classe_nome) {
        return NextResponse.json({ ok: false, error: "Nome, Curso e Classe são obrigatórios" }, { status: 400 })
    }

    // 3. Insert com tratamento de erro
    const { data, error } = await supabase
        .from('disciplinas')
        .insert({
            escola_id: escolaId,
            nome,
            curso_escola_id: curso_id, // Mapeando curso_id do front para curso_escola_id do banco
            classe_nome,
            nivel_ensino: nivel_ensino || 'geral',
            tipo: tipo || 'core'
        })
        .select()
        .single()

    if (error) {
        // [BLINDAGEM] Tratamento de Duplicidade (23505)
        if (error.code === '23505') {
            return NextResponse.json(
                { ok: false, error: `A disciplina "${nome}" já existe nesta classe e curso.` },
                { status: 409, headers } // Conflict
            )
        }
        return NextResponse.json({ ok: false, error: error.message }, { status: 400, headers })
    }

    return NextResponse.json({ ok: true, data, message: "Disciplina criada com sucesso" }, { headers })

  } catch (e: any) {
    console.error("Erro POST Disciplina:", e)
    return NextResponse.json({ ok: false, error: e.message || String(e) }, { status: 500 })
  }
}

//app/api/escolas/[id]/disciplinas/route.ts
import { NextResponse } from 'next/server'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { authorizeDisciplinaManage } from '@/lib/escola/disciplinas'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { applyKf2ListInvariants } from '@/lib/kf2'

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
    const classeId = searchParams.get('classe_id')

    let query = supabase
        .from('curso_matriz')
        .select(`
          id,
          curso_id,
          classe_id,
          disciplina_id,
          obrigatoria,
          ordem,
          carga_horaria,
          disciplina:disciplinas_catalogo(id, nome, sigla),
          classe:classes(id, nome),
          curso:cursos(id, nome)
        `)
        .eq('escola_id', escolaId)

    query = applyKf2ListInvariants(query, { defaultLimit: 200 });

    if (cursoId) query = query.eq('curso_id', cursoId)
    if (classeId) query = query.eq('classe_id', classeId)

    const { data, error } = await query

    if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 400, headers });
    }

    const items = (data || []).map((r: any) => ({
      id: r.id,
      nome: r.disciplina?.nome ?? '',
      sigla: r.disciplina?.sigla ?? null,
      curso_id: r.curso_id,
      curso_nome: r.curso?.nome ?? null,
      classe_id: r.classe_id,
      classe_nome: r.classe?.nome ?? null,
      carga_horaria: r.carga_horaria ?? null,
      obrigatoria: r.obrigatoria !== false,
      ordem: r.ordem ?? null,
      disciplina_id: r.disciplina_id,
    }));

    return NextResponse.json({ ok: true, items }, { headers });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

//app/api/escolas/[id]/classes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { authorizeEscolaAction } from '@/lib/escola/disciplinas'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { applyKf2ListInvariants } from '@/lib/kf2'

export const dynamic = 'force-dynamic'

// Helper para listar classes (mantido igual)
async function listarClassesBase(client: any, escolaId: string) {
  let query = client
    .from('classes')
    .select('id, nome')
    .eq('escola_id', escolaId)
    .order('nome')

  query = applyKf2ListInvariants(query, { defaultLimit: 50 })

  const { data, error } = await query

  if (error) throw new Error(error.message)
  return data || []
}

export async function GET(req: NextRequest) {
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
    headers.set('Link', `</api/escolas/${escolaId}/classes>; rel="successor-version"`)

    const { searchParams } = new URL(req.url)
    const cursoId = searchParams.get('curso_id')

    // Lógica complexa de filtro por curso (Mantida original)
    if (cursoId) {
      try {
        const classeIdsSet = new Set<string>()

        const { data: viewData } = await s
          .from('vw_turmas_para_matricula')
          .select('classe_id')
          .eq('escola_id', escolaId)
          .eq('curso_id', cursoId)
          .not('classe_id', 'is', null)

        ;(viewData || []).forEach((row: any) => {
          if (row?.classe_id) classeIdsSet.add(row.classe_id)
        })

        if (classeIdsSet.size === 0) {
            // Se a lógica complexa não achou nada, tentamos buscar direto na tabela classes
            // Caso as classes tenham sido criadas mas ainda não tenham turmas/ofertas
            let directQuery = s
                .from('classes')
                .select('id, nome')
                .eq('escola_id', escolaId)
                .eq('curso_id', cursoId)
                .order('nome');

            directQuery = applyKf2ListInvariants(directQuery, { defaultLimit: 50 });

            const { data: directClasses } = await directQuery;
            
            if (directClasses && directClasses.length > 0) {
                return NextResponse.json({ ok: true, items: directClasses })
            }
            return NextResponse.json({ ok: true, items: [] })
        }

        const classeIds = Array.from(classeIdsSet)

        let classesQuery = s
          .from('classes')
          .select('id, nome')
          .in('id', classeIds)
          .order('nome')

        classesQuery = applyKf2ListInvariants(classesQuery, { defaultLimit: 50 });

        const { data, error } = await classesQuery

        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400, headers })
        return NextResponse.json({ ok: true, items: data || [] }, { headers })
      } catch (err: any) {
        try {
          const items = await listarClassesBase(s as any, escolaId)
          return NextResponse.json({ ok: true, items }, { headers })
        } catch (fallbackErr: any) {
          const message = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)
          return NextResponse.json({ ok: false, error: message }, { status: 400, headers })
        }
      }
    }

    // Listagem padrão
    try {
      const data = await listarClassesBase(s as any, escolaId)
      return NextResponse.json({ ok: true, items: data }, { headers })
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error)
      return NextResponse.json({ ok: false, error: message }, { status: 400, headers })
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

// --- NOVO MÉTODO POST (Para criar classes manualmente) ---
export async function POST(req: NextRequest) {
  try {
    const s = await supabaseServer()
    const headers = new Headers()
    
    // 1. Auth
    const { data: userRes } = await s.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    // 2. Escola
    const escolaId = await resolveEscolaIdForUser(s as any, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 })

    const authz = await authorizeEscolaAction(s as any, escolaId, user.id, ['configurar_escola', 'gerenciar_disciplinas'])
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 })

    headers.set('Deprecation', 'true')
    headers.set('Link', `</api/escolas/${escolaId}/classes>; rel="successor-version"`)

    const body = await req.json()
    const { nome, curso_id, ordem } = body // Captura curso_id, pois a constraint exige (escola+curso+nome)

    if (!nome) {
        return NextResponse.json({ ok: false, error: "Nome da classe é obrigatório" }, { status: 400 })
    }

    // 3. Insert com tratamento de duplicidade
    const { data, error } = await s
        .from('classes')
        .insert({
            escola_id: escolaId,
            nome,
            curso_id: curso_id || null, // Importante passar o curso se houver
            ordem: ordem || 0
        })
        .select()
        .single()

    if (error) {
        // [TRATAMENTO DE DUPLICIDADE]
        if (error.code === '23505') {
            return NextResponse.json(
                { ok: false, error: `A classe "${nome}" já existe neste curso/escola.` },
                { status: 409, headers }
            )
        }
        throw error
    }

    return NextResponse.json({ ok: true, data, message: "Classe criada com sucesso" }, { headers })

  } catch (e: any) {
    console.error("Erro POST Classes:", e)
    return NextResponse.json({ ok: false, error: e.message || String(e) }, { status: 500 })
  }
}

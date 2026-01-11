//app/api/escolas/[id]/disciplinas/route.ts
import { NextResponse } from 'next/server'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { authorizeDisciplinaManage } from '@/lib/escola/disciplinas'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'

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
        .order('classe_id', { ascending: true });

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
      curso_id, // ID do curso
      classe_id, // ID da classe
      obrigatoria = true,
      carga_horaria = null,
      ordem = null,
      sigla = null,
    } = body

    if (!nome || !curso_id || !classe_id) {
        return NextResponse.json({ ok: false, error: "Nome, Curso e Classe são obrigatórios" }, { status: 400 })
    }

    // Resolve/insere no catálogo
    let disciplinaId: string | null = null;
    {
      const { data: exist } = await supabase
        .from('disciplinas_catalogo')
        .select('id')
        .eq('escola_id', escolaId)
        .eq('nome', nome)
        .maybeSingle();
      if (exist?.id) disciplinaId = exist.id;
      else {
        const { data: nova, error: discErr } = await supabase
          .from('disciplinas_catalogo')
          .insert({ escola_id: escolaId, nome, sigla } as any)
          .select('id')
          .single();
        if (discErr) return NextResponse.json({ ok: false, error: discErr.message }, { status: 400, headers });
        disciplinaId = (nova as any)?.id ?? null;
      }
    }

    // Upsert na matriz
    const { data, error } = await supabase
        .from('curso_matriz')
        .upsert({
            escola_id: escolaId,
            curso_id,
            classe_id,
            disciplina_id: disciplinaId,
            obrigatoria,
            carga_horaria,
            ordem,
        } as any, { onConflict: 'escola_id,curso_id,classe_id,disciplina_id' } as any)
        .select('id, curso_id, classe_id, disciplina_id, obrigatoria, carga_horaria, ordem')
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

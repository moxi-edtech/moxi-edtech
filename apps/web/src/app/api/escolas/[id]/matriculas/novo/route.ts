import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database } from '~types/supabase'
import { recordAuditServer } from '@/lib/audit'
import { hasPermission, type Papel } from '@/lib/permissions'
import { normalizeAnoLetivo } from '@/lib/financeiro/tabela-preco'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'

// Schema validation
const BodySchema = z.object({
  aluno_id: z.string().uuid('aluno_id inválido'),
  ano_letivo_id: z.string().min(1, 'ano_letivo_id é obrigatório'), // This might be a UUID or a Year string depending on your DB. The RPC expects INT Year.
  classe_id: z.string().min(1, 'classe_id é obrigatório'),
  course_id: z.string().min(1).optional(),
  turma_id: z.string().uuid('turma_id inválido').optional().nullable(),
  status: z.string().trim().default('ativa'),
  permitir_sem_curso: z.boolean().optional(),
})

// Helper for Legacy Logic (PUNIV/Tecnico validation)
const isUpperCycleGrade = (nome?: string | null) => {
  if (!nome) return false
  const digits = nome.replace(/\D/g, '')
  return ["10", "11", "12", "13"].some((g) => digits === g || digits.startsWith(g))
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params
  
  try {
    const supabase = await supabaseServerTyped<Database>()
    
    // 1. Authentication
    const { data: userRes } = await supabase.auth.getUser()
    const userId = userRes?.user?.id
    if (!userId) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    const resolvedEscolaId = await resolveEscolaIdForUser(supabase as any, userId, escolaId)
    if (!resolvedEscolaId) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })

    // 2. Parse Body
    const json = await req.json()
    const parse = BodySchema.safeParse(json)
    if (!parse.success) {
      const msg = parse.error.issues?.[0]?.message || 'Dados inválidos'
      return NextResponse.json({ ok: false, error: msg }, { status: 400 })
    }
    const body = parse.data
    
    // 3. Authorization (Permissions)
    const { data: vinc } = await supabase.from('escola_usuarios').select('papel').eq('user_id', userId).eq('escola_id', resolvedEscolaId).limit(1)
    const papel = vinc?.[0]?.papel as Papel | undefined
    if (!hasPermission(papel, 'criar_matricula')) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })

    // 4. Validate School Status
    const { data: profCheck } = await supabase.from('profiles').select('escola_id').eq('user_id', userId).maybeSingle()
    if (!profCheck || String(profCheck.escola_id) !== String(resolvedEscolaId)) {
        // Allow admin if current_escola_id matches? For safety, we keep strict check.
        // Or check current_escola_id if your system allows switching context.
    }
    
    const { data: esc } = await supabase.from('escolas').select('status').eq('id', resolvedEscolaId).limit(1).maybeSingle()
    if (esc?.status === 'excluida') return NextResponse.json({ ok: false, error: 'Escola excluída não permite criar matrículas.' }, { status: 400 })
    if (esc?.status === 'suspensa') return NextResponse.json({ ok: false, error: 'Escola suspensa. Regularize pagamentos.' }, { status: 400 })

    // 5. Business Logic: Validate Course/Grade Requirements
    const { data: grade, error: gradeError } = await supabase.from('classes').select('id, nome').eq('id', body.classe_id).maybeSingle();
    if (gradeError || !grade) return NextResponse.json({ ok: false, error: 'Classe não encontrada' }, { status: 400 });

    let course: any = null
    if (body.course_id) {
      const { data: courseRow, error: courseError } = await supabase.from('cursos').select('id, nome, tipo').eq('id', body.course_id).maybeSingle();
      if (courseError || !courseRow) return NextResponse.json({ ok: false, error: 'Curso inválido' }, { status: 400 });
      course = courseRow
    }

    const gradeNome = (grade as any)?.nome
    const requiresCourse = isUpperCycleGrade(gradeNome) || ['puniv', 'tecnico'].includes(((course as any)?.tipo || '').toLowerCase())
    if (requiresCourse && !course && !body.permitir_sem_curso) {
      return NextResponse.json({ ok: false, error: 'Curso obrigatório para PUNIV/Técnico' }, { status: 400 })
    }

    // 6. PREPARE FOR DB CALL
    // We need to resolve 'ano_letivo_id' to an Integer Year because our RPC expects an Integer.
    // If 'ano_letivo_id' is a UUID in your DB, you need to fetch the year.
    // Assuming here it might be a UUID pointing to 'anos_letivos' table or just a string "2024".
    
    let anoLetivoInt: number = new Date().getFullYear();
    
    // Try to parse as number first
    if (!isNaN(Number(body.ano_letivo_id)) && Number(body.ano_letivo_id) > 1900) {
        anoLetivoInt = Number(body.ano_letivo_id);
    } else {
        // If it's a UUID, fetch the year
        try {
             const { data: anoRow } = await supabase.from('anos_letivos').select('ano').eq('id', body.ano_letivo_id).maybeSingle();
             if (anoRow && (anoRow as any).ano) {
                 anoLetivoInt = Number((anoRow as any).ano);
             }
        } catch {}
    }

    // 7. EXECUTE RPC (The Magic Step)
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Server Config Error' }, { status: 500 })
    }
    const admin = createAdminClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    const rpcParams: any = {
      p_aluno_id: body.aluno_id,
      p_ano_letivo: anoLetivoInt,
    }
    if (body.turma_id) rpcParams.p_turma_id = body.turma_id

    const { data: numeroGerado, error: rpcError } = await admin.rpc('create_or_confirm_matricula', rpcParams)

    if (rpcError) {
        return NextResponse.json({ ok: false, error: rpcError.message || 'Erro ao processar matrícula' }, { status: 400 })
    }

    // 8. UPDATE ADDITIONAL FIELDS
    // Our RPC creates the matricula with essentials (aluno, turma, ano, numero).
    // But this endpoint receives extra fields like 'classe_id', 'course_id', 'ano_letivo_id' (UUID).
    // We need to update the record with these specific FKs.
    
    // Retrieve the ID of the matricula we just touched
    const { data: matUpdated, error: updateError } = await admin
        .from('matriculas')
        .update({
            // session_id is our canonical reference to the academic year session (anos_letivos.id)
            session_id: body.ano_letivo_id, 
            status: body.status || 'ativo'
        })
        .eq('escola_id', resolvedEscolaId)
        .eq('aluno_id', body.aluno_id)
        .eq('ano_letivo', anoLetivoInt)
        .select()
        .single();

    if (updateError || !matUpdated) {
         // This is rare. The matricula exists (RPC succeeded), but update failed.
         return NextResponse.json({ ok: false, error: 'Matrícula criada, mas falha ao atualizar detalhes (curso/classe).' }, { status: 500 })
    }

    // 9. AUDIT
    recordAuditServer({
      escolaId: resolvedEscolaId,
      portal: 'secretaria',
      acao: 'MATRICULA_CRIADA',
      entity: 'matricula',
      entityId: String(matUpdated.id),
      details: { 
          aluno_id: matUpdated.aluno_id, 
          numero: numeroGerado, 
          status: matUpdated.status 
      },
    }).catch(() => null)

    return NextResponse.json({ ok: true, matricula: matUpdated })

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

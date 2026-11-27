import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { authorizeTeacherManage } from '@/lib/escola/disciplinas'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'

export const dynamic = 'force-dynamic'
const UUID = z.string().uuid()
const Body = z.object({
  unidade: z.enum(['tempos', 'minutos']),
  limite: z.number().int().positive().max(10080),
  contratual_minutos: z.number().int().positive().max(10080).nullable(),
}).strict().superRefine((value, ctx) => {
  if (value.unidade === 'tempos' && value.limite > 100)
    ctx.addIssue({ code: 'custom', path: ['limite'], message: 'Limite máximo de 100 tempos.' })
  if (value.unidade === 'minutos' && value.contratual_minutos !== null && value.limite > value.contratual_minutos)
    ctx.addIssue({ code: 'custom', path: ['limite'], message: 'Carga lectiva superior à carga contratual.' })
})

type Context = { params: Promise<{ id: string; profileId: string }> }
async function handle(req: Request, ctx: Context, write: boolean) {
  try {
    const { id: escolaId, profileId } = await ctx.params
    if (!UUID.safeParse(escolaId).success || !UUID.safeParse(profileId).success)
      return NextResponse.json({ ok: false, error: 'Dados inválidos.' }, { status: 400 })
    const supabase = await supabaseServerTyped<any>()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth?.user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 })
    const resolved = await resolveEscolaIdForUser(supabase as any, auth.user.id, escolaId)
    const permission = await authorizeTeacherManage(supabase as any, escolaId, auth.user.id)
    if (resolved !== escolaId || !permission.allowed)
      return NextResponse.json({ ok: false, error: 'Sem permissão.' }, { status: 403 })
    const { data: teacher, error: lookupError } = await supabase.from('professores').select('id')
      .eq('escola_id', escolaId).eq('profile_id', profileId).maybeSingle()
    if (lookupError) throw lookupError
    if (!teacher?.id) return NextResponse.json({ ok: false, error: 'Professor não encontrado.' }, { status: 404 })
    const params = { p_escola_id: escolaId, p_professor_id: teacher.id }
    if (write) {
      const parsed = Body.safeParse(await req.json().catch(() => null))
      if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Dados inválidos.' }, { status: 400 })
      const { error } = await supabase.rpc('configure_teacher_workload_atomic', {
        ...params, p_unidade: parsed.data.unidade, p_limite: parsed.data.limite,
        p_contratual_minutos: parsed.data.contratual_minutos,
      })
      if (error) {
        const message = /BELOW_ASSIGNED/.test(error.message) ? 'O novo limite é inferior à carga já atribuída ao professor.'
          : /DURATION_UNCONFIGURED/.test(error.message) ? 'Não foi possível determinar a carga das turmas atribuídas. Reveja os horários.'
          : 'Não foi possível configurar o limite lectivo.'
        return NextResponse.json({ ok: false, error: message }, { status: 409 })
      }
      return NextResponse.json({ ok: true })
    }
    const { data, error } = await supabase.rpc('get_teacher_workload_config', params)
    if (error) throw error
    const item = Array.isArray(data) ? data[0] : data
    if (!item) return NextResponse.json({ ok: false, error: 'Cadastro docente incompleto.' }, { status: 404 })
    return NextResponse.json({ ok: true, item }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ ok: false, error: 'Não foi possível consultar a carga lectiva.' }, { status: 500 })
  }
}

export const GET = (req: Request, ctx: Context) => handle(req, ctx, false)
export const POST = (req: Request, ctx: Context) => handle(req, ctx, true)

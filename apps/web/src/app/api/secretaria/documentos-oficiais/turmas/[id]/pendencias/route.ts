import { NextResponse } from "next/server"
import { supabaseServerTyped } from "@/lib/supabaseServer"
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser"
import { authorizeTurmasManage } from "@/lib/escola/disciplinas"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await supabaseServerTyped<any>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 })

    const { id: turmaId } = await ctx.params
    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 })

    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id)
    if (!authz.allowed) {
      return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 })
    }

    const { data, error } = await supabase
      .from("vw_professor_pendencias")
      .select(
        "turma_id, turma_disciplina_id, disciplina_id, disciplina_nome, tipo, trimestre, avaliacao_id, total_alunos, notas_lancadas, pendentes"
      )
      .eq("escola_id", escolaId)
      .eq("turma_id", turmaId)
      .order("disciplina_nome", { ascending: true })
      .order("trimestre", { ascending: true })

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    const items = (data || [])
      .map((row: any) => {
        const total = row.total_alunos ?? 0
        const pendentes = row.pendentes ?? 0
        const hasPending = total > 0 && (!row.avaliacao_id || pendentes > 0)
        return {
          turma_disciplina_id: row.turma_disciplina_id,
          disciplina_id: row.disciplina_id ?? null,
          disciplina_nome: row.disciplina_nome ?? "—",
          tipo: row.tipo ?? "—",
          trimestre: row.trimestre ?? null,
          avaliacao_id: row.avaliacao_id ?? null,
          total_alunos: total,
          notas_lancadas: row.notas_lancadas ?? 0,
          pendentes,
          status: !row.avaliacao_id ? "SEM_AVALIACAO" : pendentes > 0 ? "NOTAS_PENDENTES" : "OK",
          has_pending: hasPending,
        }
      })
      .filter((row: any) => row.has_pending)

    return NextResponse.json({
      ok: true,
      items,
      resumo: {
        total_pendencias: items.length,
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

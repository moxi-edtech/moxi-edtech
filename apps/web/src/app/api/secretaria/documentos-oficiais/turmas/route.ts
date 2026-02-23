import { NextResponse } from "next/server"
import { supabaseServerTyped } from "@/lib/supabaseServer"
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser"
import { authorizeTurmasManage } from "@/lib/escola/disciplinas"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

export async function GET() {
  try {
    const supabase = await supabaseServerTyped<any>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 })

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 })

    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id)
    if (!authz.allowed) {
      return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 })
    }

    const { data: anoLetivo } = await supabase
      .from("anos_letivos")
      .select("ano")
      .eq("escola_id", escolaId)
      .eq("ativo", true)
      .maybeSingle()

    let turmasQuery = supabase
      .from("turmas")
      .select("id, nome, turma_codigo, turma_code, ano_letivo, turno, status_validacao, status_fecho, classe_id, classes(nome), cursos(nome)")
      .eq("escola_id", escolaId)

    if (anoLetivo?.ano) {
      turmasQuery = turmasQuery.eq("ano_letivo", anoLetivo.ano)
    }

    const { data: turmas, error: turmasError } = await turmasQuery
    if (turmasError) {
      return NextResponse.json({ ok: false, error: turmasError.message }, { status: 500 })
    }

    const turmaIds = (turmas || []).map((t: any) => t.id)
    const pendenciasMap = new Map<string, number>()
    const alunosMap = new Map<string, number>()

    if (turmaIds.length > 0) {
      const [pendenciasRes, alunosRes] = await Promise.all([
        supabase
          .from("vw_professor_pendencias")
          .select("turma_id, total_alunos, pendentes, avaliacao_id")
          .eq("escola_id", escolaId)
          .in("turma_id", turmaIds)
          .limit(500),
        supabase
          .from("matriculas")
          .select("turma_id")
          .eq("escola_id", escolaId)
          .in("turma_id", turmaIds)
          .in("status", ["ativo", "ativa", "active"]),
      ])

      if (pendenciasRes.error) {
        return NextResponse.json({ ok: false, error: pendenciasRes.error.message }, { status: 500 })
      }
      if (alunosRes.error) {
        return NextResponse.json({ ok: false, error: alunosRes.error.message }, { status: 500 })
      }

      for (const row of pendenciasRes.data || []) {
        const total = row.total_alunos ?? 0
        const pendente = row.pendentes ?? 0
        const hasPending = total > 0 && (!row.avaliacao_id || pendente > 0)
        if (!hasPending) continue
        pendenciasMap.set(row.turma_id, (pendenciasMap.get(row.turma_id) ?? 0) + 1)
      }

      for (const row of (alunosRes.data || []) as Array<{ turma_id: string }>) {
        alunosMap.set(row.turma_id, (alunosMap.get(row.turma_id) ?? 0) + 1)
      }
    }

    const items = (turmas || []).map((t: any) => ({
      id: t.id,
      nome: t.nome ?? "Turma",
      turma_codigo: t.turma_codigo ?? t.turma_code ?? null,
      curso: t?.cursos?.nome ?? "—",
      turno: t.turno ?? "—",
      ano_letivo: t.ano_letivo ?? null,
      classe: t?.classes?.nome ?? "—",
      status_validacao: t.status_validacao ?? null,
      status_fecho: t.status_fecho ?? "ABERTO",
      pendencias: pendenciasMap.get(t.id) ?? 0,
      alunos: alunosMap.get(t.id) ?? 0,
    }))

    return NextResponse.json({ ok: true, items })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

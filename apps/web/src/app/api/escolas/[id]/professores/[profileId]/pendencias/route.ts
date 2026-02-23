import { NextResponse } from "next/server"
import { createRouteClient } from "@/lib/supabase/route-client"
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser"
import { hasAnyPermission, normalizePapel } from "@/lib/permissions"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

const TIPOS_AVALIACAO = ["MAC", "NPP", "NPT"] as const

type PendenciaTipo = {
  tipo: string
  avaliacao_id: string | null
  notas_lancadas: number
  pendentes: number
  status: "ok" | "pendente" | "sem_avaliacao" | "sem_alunos"
}

export async function GET(req: Request, context: { params: Promise<{ id: string; profileId: string }> }) {
  try {
    const { id: escolaId, profileId } = await context.params
    const supabase = await createRouteClient()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 })

    const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, escolaId)
    if (!userEscolaId || userEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 })
    }

    const { data: vinc } = await supabase
      .from("escola_users")
      .select("papel, role")
      .eq("user_id", user.id)
      .eq("escola_id", escolaId)
      .limit(1)

    const papelReq = normalizePapel(vinc?.[0]?.papel ?? (vinc?.[0] as any)?.role)
    const allowed = hasAnyPermission(papelReq, ["visualizar_academico", "gerenciar_turmas", "editar_usuario"])
    if (!allowed) return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 })

    const { data: rows, error } = await supabase
      .from("vw_professor_pendencias")
      .select(
        "turma_disciplina_id, turma_id, turma_nome, disciplina_id, disciplina_nome, trimestre, tipo, avaliacao_id, total_alunos, notas_lancadas, pendentes"
      )
      .eq("escola_id", escolaId)
      .eq("profile_id", profileId)

    if (error) throw error

    const normalizeTipo = (tipo?: string | null) => (tipo ?? "").trim().toUpperCase()
    const rowsSafe = (rows || []).map((row) => ({
      ...row,
      tipo: normalizeTipo(row.tipo as string | null),
      trimestre: row.trimestre ?? null,
      total_alunos: row.total_alunos ?? 0,
      notas_lancadas: row.notas_lancadas ?? 0,
      pendentes: row.pendentes ?? 0,
    }))

    const groupMap = new Map<string, PendenciaItem>()
    for (const row of rowsSafe) {
      if (!row.turma_disciplina_id) continue
      const trimestre = typeof row.trimestre === "number" ? row.trimestre : null
      const groupKey = `${row.turma_disciplina_id}:${trimestre ?? "-"}`
      const current = groupMap.get(groupKey) ?? {
        turma_disciplina_id: row.turma_disciplina_id as string,
        turma_id: row.turma_id as string,
        turma_nome: (row.turma_nome as string | null) ?? null,
        disciplina_id: (row.disciplina_id as string | null) ?? null,
        disciplina_nome: (row.disciplina_nome as string | null) ?? null,
        trimestre,
        total_alunos: row.total_alunos as number,
        tipos: [] as PendenciaTipo[],
      }

      const totalAlunos = row.total_alunos as number
      const pendentes = row.pendentes as number
      let status: PendenciaTipo["status"]
      if (totalAlunos === 0) status = "sem_alunos"
      else if (!row.avaliacao_id) status = "sem_avaliacao"
      else if (pendentes > 0) status = "pendente"
      else status = "ok"

      current.tipos.push({
        tipo: row.tipo as string,
        avaliacao_id: (row.avaliacao_id as string | null) ?? null,
        notas_lancadas: row.notas_lancadas as number,
        pendentes,
        status,
      })

      groupMap.set(groupKey, current)
    }

    const groupList = Array.from(groupMap.values()).map((group) => {
      const orderedTipos = TIPOS_AVALIACAO.map((tipo) => group.tipos.find((t) => t.tipo === tipo))
        .filter(Boolean) as PendenciaTipo[]
      return { ...group, tipos: orderedTipos.length ? orderedTipos : group.tipos }
    })

    const countPendencias = (item: PendenciaItem) =>
      item.tipos.filter((tipo) => tipo.status === "pendente" || tipo.status === "sem_avaliacao").length

    let activeTrimestre: number | null = null
    if (rowsSafe.length > 0) {
      const { data: anoLetivo } = await supabase
        .from("anos_letivos")
        .select("id")
        .eq("escola_id", escolaId)
        .eq("ativo", true)
        .maybeSingle()

      const hoje = new Date().toISOString().slice(0, 10)
      const periodosQuery = anoLetivo?.id
        ? await supabase
            .from("periodos_letivos")
            .select("numero, data_inicio, data_fim")
            .eq("escola_id", escolaId)
            .eq("ano_letivo_id", anoLetivo.id)
            .eq("tipo", "TRIMESTRE")
            .order("numero", { ascending: true })
        : { data: [] as any[] }

      const periodos = (periodosQuery as any).data || []
      const periodoAtivo = periodos.find((p: any) => p.data_inicio <= hoje && p.data_fim >= hoje)
      const periodoFallback = periodos.length ? periodos[periodos.length - 1] : null
      activeTrimestre = periodoAtivo?.numero ?? periodoFallback?.numero ?? null
    }

    const byTurmaDisciplina = new Map<string, PendenciaItem[]>()
    for (const group of groupList) {
      const list = byTurmaDisciplina.get(group.turma_disciplina_id) ?? []
      list.push(group)
      byTurmaDisciplina.set(group.turma_disciplina_id, list)
    }

    const items = Array.from(byTurmaDisciplina.values()).map((list) => {
      if (activeTrimestre !== null) {
        const activeMatch = list.find((item) => item.trimestre === activeTrimestre)
        if (activeMatch) return activeMatch
      }
      return list.sort((a, b) => {
        const diff = countPendencias(b) - countPendencias(a)
        if (diff !== 0) return diff
        return (b.trimestre ?? 0) - (a.trimestre ?? 0)
      })[0]
    })

    const totalPendencias = items.reduce((acc, item) => acc + countPendencias(item), 0)
    const turmasAfetadas = new Set(
      items.filter((item) => countPendencias(item) > 0).map((item) => item.turma_id)
    ).size

    return NextResponse.json({ ok: true, items, resumo: { total_pendencias: totalPendencias, turmas_afetadas: turmasAfetadas } })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 })
  }
}

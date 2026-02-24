import { NextResponse } from "next/server"
import { createRouteClient } from "@/lib/supabase/route-client"
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser"
import { hasAnyPermission, normalizePapel } from "@/lib/permissions"

export const dynamic = "force-dynamic"

const FUNCIONARIO_PAPEIS = ["admin", "staff_admin", "secretaria", "financeiro"] as const

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: escolaId } = await context.params
    const url = new URL(req.url)
    const q = (url.searchParams.get("q") || "").trim()
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1)
    const pageSize = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get("pageSize") || "20", 10) || 20))

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
    const allowed = hasAnyPermission(papelReq, ["criar_usuario", "editar_usuario"])
    if (!allowed) return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 })

    const queryClient = supabase as any

    const { data: vinculos, error: vincErr } = await queryClient
      .from("escola_users")
      .select("id, user_id, created_at, papel")
      .eq("escola_id", escolaId)
      .in("papel", FUNCIONARIO_PAPEIS)

    if (vincErr) return NextResponse.json({ ok: false, error: vincErr.message }, { status: 500 })

    const vincList = (vinculos || []) as Array<{
      id: string
      user_id: string
      created_at: string
      papel: string
    }>

    const userIds = vincList.map((row) => row.user_id)
    if (userIds.length === 0) return NextResponse.json({ ok: true, items: [], total: 0 })

    const { data: rows, error: rowsErr } = await queryClient
      .rpc("tenant_profiles_by_ids", { p_user_ids: userIds })

    if (rowsErr) return NextResponse.json({ ok: false, error: rowsErr.message }, { status: 500 })

    const list = (rows || []) as Array<{
      user_id: string
      nome: string | null
      email: string | null
      telefone: string | null
      numero_login: string | null
      last_login: string | null
      created_at: string | null
    }>

    const filtered = q
      ? list.filter((row) => {
          const term = q.toLowerCase()
          return [row.nome, row.email, row.telefone, row.numero_login]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(term))
        })
      : list

    filtered.sort((a, b) => {
      const aDate = a.created_at ? Date.parse(a.created_at) : 0
      const bDate = b.created_at ? Date.parse(b.created_at) : 0
      if (aDate !== bDate) return bDate - aDate
      return String(b.user_id).localeCompare(String(a.user_id))
    })

    const from = (page - 1) * pageSize
    const paged = filtered.slice(from, from + pageSize)
    const vincMap = new Map(vincList.map((row) => [row.user_id, row]))

    const items = paged.map((row) => {
      const vincData = vincMap.get(row.user_id)
      return {
        id: vincData?.id ?? null,
        user_id: row.user_id,
        nome: row.nome,
        email: row.email,
        telefone: row.telefone,
        numero_login: row.numero_login,
        papel: vincData?.papel ?? null,
        created_at: vincData?.created_at ?? row.created_at,
        last_login: row.last_login ?? null,
      }
    })

    return NextResponse.json({ ok: true, items, total: filtered.length })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 })
  }
}

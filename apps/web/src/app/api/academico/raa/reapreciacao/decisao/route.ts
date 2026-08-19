import { NextResponse } from "next/server"
import { z } from "zod"
import { requireRoleInSchool } from "@/lib/authz"
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser"
import { supabaseServerTyped } from "@/lib/supabaseServer"

export const dynamic = "force-dynamic"
export const revalidate = 0

const bodySchema = z.object({
  id: z.string().uuid(),
  estado: z.enum(["em_analise", "deferido", "indeferido", "cancelado"]),
  decisao_motivo: z.string().trim().min(5).max(2000),
})

const decisionRoles = ["admin", "admin_escola", "staff_admin", "admin_financeiro", "diretor", "secretaria"] as const

export async function PATCH(request: Request) {
  const supabase = await supabaseServerTyped<any>()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 })
  const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id)
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 400 })
  const authz = await requireRoleInSchool({ supabase, escolaId, roles: [...decisionRoles] })
  if (authz.error) return authz.error

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 })

  const { data: current } = await supabase
    .from("reapreciacao_pedidos")
    .select("id, estado, prazo_em")
    .eq("id", parsed.data.id)
    .eq("escola_id", escolaId)
    .maybeSingle()
  if (!current) return NextResponse.json({ ok: false, error: "Pedido de reapreciação não encontrado." }, { status: 404 })
  if (["deferido", "indeferido", "expirado", "cancelado"].includes(current.estado)) {
    return NextResponse.json({ ok: false, error: "Este pedido já foi concluído e não pode ser alterado.", code: "RAA_REAPRECIACAO_FINAL" }, { status: 409 })
  }
  if (new Date(current.prazo_em).getTime() <= Date.now()) {
    await supabase.from("reapreciacao_pedidos").update({ estado: "expirado", updated_at: new Date().toISOString() }).eq("id", current.id).eq("escola_id", escolaId).in("estado", ["pendente", "em_analise"])
    return NextResponse.json({ ok: false, error: "O prazo de reapreciação expirou.", code: "RAA_REAPRECIACAO_EXPIRED" }, { status: 409 })
  }

  const { data, error } = await supabase
    .from("reapreciacao_pedidos")
    .update({ estado: parsed.data.estado, decisao_motivo: parsed.data.decisao_motivo, decidido_por: auth.user.id, decidido_em: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", current.id)
    .eq("escola_id", escolaId)
    .in("estado", ["pendente", "em_analise"])
    .select("*")
    .maybeSingle()
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ ok: false, error: "O pedido mudou de estado. Atualize a fila.", code: "RAA_REAPRECIACAO_CONFLICT" }, { status: 409 })
  return NextResponse.json({ ok: true, item: data })
}

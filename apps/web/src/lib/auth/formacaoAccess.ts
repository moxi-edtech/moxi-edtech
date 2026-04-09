import { supabaseServer } from '@/lib/supabaseServer'

export type FormacaoContext = {
  role: string | null
  modeloEnsino: string | null
  escolaId: string | null
}

export async function getFormacaoContext(): Promise<FormacaoContext | null> {
  const supabase = await supabaseServer()

  const { data } = await supabase.auth.getUser()
  const user = data?.user
  if (!user) return null

  const appMetadata = (user.app_metadata ?? {}) as Record<string, unknown>

  const { data: profileRows } = await supabase
    .from("profiles")
    .select("role,current_escola_id,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
  const profile = profileRows?.[0] ?? null

  const { data: membershipRows } = await supabase
    .from("escola_users")
    .select("escola_id,papel,tenant_type,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
  const selectedMembership =
    membershipRows?.find((row) => row.escola_id === profile?.current_escola_id) ??
    membershipRows?.find((row) => row.tenant_type === "formacao") ??
    membershipRows?.[0] ??
    null

  return {
    role: (selectedMembership?.papel ?? profile?.role ?? appMetadata.role ?? null) as string | null,
    modeloEnsino: (selectedMembership?.tenant_type ?? appMetadata.modelo_ensino ?? null) as string | null,
    escolaId: (selectedMembership?.escola_id ?? profile?.current_escola_id ?? appMetadata.escola_id ?? null) as string | null,
  }
}

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { buildOnboardingEmail } from "@/lib/mailer";
import { callAuthAdminJob } from "@/lib/auth-admin-job";
import type { Database } from "~types/supabase";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type EscolaRow = Database["public"]["Tables"]["escolas"]["Row"];
type EscolaUserRow = Database["public"]["Tables"]["escola_users"]["Row"];
type LinkData = { properties?: { action_link?: string | null }; action_link?: string | null };

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const escolaId = url.searchParams.get("escolaId") || url.searchParams.get("id")
    const providedEmail = url.searchParams.get("adminEmail")?.trim() || null
    const mode = (url.searchParams.get("mode") || "invite").toLowerCase() as "invite" | "magic"

    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Informe escolaId" }, { status: 400 })
    }

    // Auth + super_admin check
    const s = await supabaseServer()
    const { data: { session } } = await s.auth.getSession()
    const user = session?.user
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 })
    const { data: prof } = await s
      .from("profiles").select("role").eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
    const role = (prof?.[0] as ProfileRow | undefined)?.role || null
    if (role !== "super_admin") return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 })

    const origin = url.origin
    // Use centralized redirect that routes user based on role/escola/onboarding
    const redirectTo = `${origin}/redirect`

    // Fetch escola nome e plano
    let escolaNome = ""
    let plano: string | null = null
    const { data: esc } = await s.from("escolas").select("nome, plano, plano_atual").eq("id", escolaId).limit(1)
    const escolaRow = (esc?.[0] as (EscolaRow & { plano?: string | null; plano_atual?: string | null }) | undefined) ?? null
    escolaNome = escolaRow?.nome || ""
    plano = escolaRow?.plano_atual || escolaRow?.plano || null

    // Resolve admin email/nome (provided or lookup first admin vinculo)
    let adminEmail = providedEmail
    let adminNome: string | null = null
    if (!adminEmail) {
      const { data: vinc } = await s
        .from("escola_users")
        .select("user_id,papel")
        .eq("escola_id", escolaId)
        .in("papel", ["admin", "staff_admin"])
        .limit(1)
      const uid = (vinc?.[0] as EscolaUserRow | undefined)?.user_id as string | undefined
      if (uid) {
        const { data: p } = await s.from("profiles").select("email, nome").eq("user_id", uid).limit(1)
        const profileRow = (p?.[0] as ProfileRow | undefined) ?? null
        adminEmail = profileRow?.email || null
        adminNome = profileRow?.nome || null
      }
    }

    if (!adminEmail) {
      return NextResponse.json({ ok: false, error: "Não foi possível determinar o email do administrador. Informe ?adminEmail=..." }, { status: 400 })
    }

    // Try generating action link
    let actionLink: string | null = null
    try {
      const linkDataRaw = await callAuthAdminJob(req, "generateLink", {
        type: mode === "magic" ? "magiclink" : "invite",
        email: adminEmail,
        options: { redirectTo },
      })
      const linkData = linkDataRaw as LinkData | null
      actionLink = linkData?.properties?.action_link || linkData?.action_link || null
    } catch {
      actionLink = null
    }

    const link = actionLink || redirectTo
    const { subject, html, text } = buildOnboardingEmail({ escolaNome: escolaNome || "sua escola", onboardingUrl: link, adminEmail, adminNome: adminNome || undefined, plano: plano || undefined })

    return NextResponse.json({
      ok: true,
      preview: { subject, html, text },
      meta: {
        escolaId,
        escolaNome: escolaNome || null,
        adminEmail,
        mode,
        actionLink,
        redirectTo,
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

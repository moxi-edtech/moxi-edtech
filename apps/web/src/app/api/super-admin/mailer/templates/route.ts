import { NextResponse } from "next/server"
import { EMAIL_TEMPLATES, getTemplatePreview, type EmailTemplateId } from "@/lib/mailer"
import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess"
import { supabaseServer } from "@/lib/supabaseServer"

export async function GET(req: Request) {
  try {
    const s = await supabaseServer()
    const { data: { session } } = await s.auth.getSession()
    if (!session?.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 })
    
    const { data: prof } = await s.from('profiles').select('role').eq('user_id', session.user.id).single()
    if (!isSuperAdminRole((prof as any)?.role)) return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const templateId = searchParams.get("id") as EmailTemplateId | null

    if (templateId) {
      const preview = getTemplatePreview(templateId)
      return NextResponse.json({ ok: true, template: preview })
    }

    return NextResponse.json({ ok: true, templates: EMAIL_TEMPLATES })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}

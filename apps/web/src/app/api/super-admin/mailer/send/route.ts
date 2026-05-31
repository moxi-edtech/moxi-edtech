import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabaseServer"
import { sendMail } from "@/lib/mailer"
import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess"

export async function POST(req: Request) {
  try {
    const s = await supabaseServer()
    const { data: { session } } = await s.auth.getSession()
    const user = session?.user
    
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 })
    }

    const { data: prof } = await s
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
    
    const role = (prof?.[0] as any)?.role || null
    if (!isSuperAdminRole(role)) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 })
    }

    const formData = await req.formData()
    const to = formData.get("to") as string
    const cc = formData.get("cc") as string
    const bcc = formData.get("bcc") as string
    const subject = formData.get("subject") as string
    const message = formData.get("message") as string
    const isHtml = formData.get("isHtml") === "true"

    if (!to || !subject || !message) {
      return NextResponse.json({ ok: false, error: "Campos obrigatórios ausentes (Para, Assunto, Mensagem)" }, { status: 400 })
    }

    const toList = to.split(",").map(e => e.trim()).filter(Boolean)
    const ccList = cc ? cc.split(",").map(e => e.trim()).filter(Boolean) : undefined
    const bccList = bcc ? bcc.split(",").map(e => e.trim()).filter(Boolean) : undefined

    const files = formData.getAll("attachments") as File[]
    const attachments: { filename: string; content: Buffer }[] = []

    for (const file of files) {
      if (file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer())
        attachments.push({
          filename: file.name,
          content: buffer
        })
      }
    }

    const result = await sendMail({
      to: toList,
      cc: ccList,
      bcc: bccList,
      subject,
      html: isHtml ? message : `<div style="white-space: pre-wrap; font-family: sans-serif;">${message}</div>`,
      text: message,
      attachments
    })

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
    }

    return NextResponse.json({ ok: true, message: "E-mail enviado com sucesso!" })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

// @kf2 allow-scan
import { NextResponse } from "next/server"
import { supabaseServerTyped } from "@/lib/supabaseServer"
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser"
import { authorizeTurmasManage } from "@/lib/escola/disciplinas"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
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

    const { id: jobId } = await ctx.params
    const { data: job, error } = await supabase
      .from("pautas_lote_jobs")
      .select("zip_path, manifest_path, zip_checksum_sha256, status")
      .eq("id", jobId)
      .eq("escola_id", escolaId)
      .maybeSingle()

    if (error || !job) {
      return NextResponse.json({ ok: false, error: error?.message || "Lote não encontrado" }, { status: 404 })
    }

    if (!job.zip_path || job.status !== "SUCCESS") {
      return NextResponse.json({ ok: false, error: "ZIP ainda não disponível" }, { status: 409 })
    }

    const expiresInSec = 60 * 30
    const { data: signed, error: signError } = await supabase.storage
      .from("pautas_zip")
      .createSignedUrl(job.zip_path, expiresInSec)

    if (signError || !signed?.signedUrl) {
      return NextResponse.json({ ok: false, error: signError?.message || "Falha ao gerar link" }, { status: 500 })
    }

    const expiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString()
    await supabase
      .from("pautas_lote_jobs")
      .update({ signed_url_expires_at: expiresAt })
      .eq("id", jobId)

    const wantsJson = new URL(req.url).searchParams.get("format") === "json"
    if (wantsJson) {
      return NextResponse.json({
        ok: true,
        download_url: signed.signedUrl,
        expires_at: expiresAt,
        checksum_sha256: job.zip_checksum_sha256,
        manifest_path: job.manifest_path,
      })
    }

    const response = NextResponse.redirect(signed.signedUrl, 307)
    response.headers.set("X-Artifact-Checksum", String(job.zip_checksum_sha256 ?? ""))
    response.headers.set("X-Link-Expires-At", expiresAt)
    return response
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

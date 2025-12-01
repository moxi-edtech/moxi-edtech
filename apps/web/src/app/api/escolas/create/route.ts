import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import type { DBWithRPC } from '@/types/supabase-augment'
import { createClient } from '@supabase/supabase-js'

const BodySchema = z.object({
  nome: z.string().trim().min(1, 'Nome da escola é obrigatório'),
  nif: z.string().trim().optional().nullable(),
  endereco: z.string().trim().optional().nullable(),
  admin: z
    .object({
      email: z.string().email('Email do administrador inválido').optional().nullable(),
      telefone: z.string().trim().optional().nullable(),
      nome: z.string().trim().optional().nullable(),
    })
    .optional()
    .nullable(),
})

export async function POST(request: Request) {
  try {
    // 1) Check caller role via session-bound client
    const supabase = await supabaseServerTyped<DBWithRPC>()
    // Early auth/role guard to provide clearer errors than raw RLS violations
    try {
      const { data: u } = await (supabase as any).auth.getUser()
      const role = (u?.user?.app_metadata as any)?.role || (u?.user?.user_metadata as any)?.role || null
      if (role !== 'super_admin') {
        return NextResponse.json({ ok: false, error: 'Somente Super Admin pode criar escolas.' }, { status: 403 })
      }
    } catch (_) {
      // ignore and fall through; RLS will still protect
    }
    const json = await request.json()
    const parsed = BodySchema.safeParse(json)
    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message || 'Dados inválidos'
      return NextResponse.json({ ok: false, error: msg }, { status: 400 })
    }

    const body = parsed.data

    // Normaliza NIF para apenas dígitos (RPC também valida)
    const nif = body.nif ? body.nif.replace(/\D/g, '') : null

    // 2) Use service-role client for RPC to bypass RLS reliably
    const adminUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!adminUrl || !serviceKey) {
      return NextResponse.json(
        { ok: false, error: 'Server misconfigured: falta SUPABASE_SERVICE_ROLE_KEY (e URL).' },
        { status: 500 }
      )
    }

    const admin = createClient<DBWithRPC>(adminUrl, serviceKey)

    const { data, error } = await (admin as any).rpc('create_escola_with_admin', {
      p_nome: body.nome,
      p_nif: nif,
      p_endereco: body.endereco ?? null,
      p_admin_email: body.admin?.email ?? null,
      p_admin_telefone: body.admin?.telefone ?? null,
      p_admin_nome: body.admin?.nome ?? null,
    })

    if (error) {
      // Mapear mensagens comuns para status mais claros
      const msg = error.message || 'Falha ao criar escola'
      const isRLS = /row-level security|RLS|permission/i.test(msg)
      const isValidation = /obrigatório|inválido|invalid|violates|duplicate/i.test(msg)
      const status = isRLS ? 403 : isValidation ? 400 : 500
      return NextResponse.json({ ok: false, error: msg }, { status })
    }

    // A função retorna um JSON com { ok, escolaId, escolaNome, mensagemAdmin }
    // Supabase tipa como Json; garantir objeto
    const payload = typeof data === 'string' ? safeParseJSON(data) : data
    return NextResponse.json(payload)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

function safeParseJSON(input: string) {
  try {
    return JSON.parse(input)
  } catch {
    return { ok: false, error: 'Resposta inválida do servidor' }
  }
}

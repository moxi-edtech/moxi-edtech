import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import type { DBWithRPC } from '@/types/supabase-augment'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

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
    const adminEmail = body.admin?.email ? body.admin.email.trim().toLowerCase() : null
    const adminTelefone = body.admin?.telefone ? body.admin.telefone.replace(/\D/g, '') : null
    const adminNome = body.admin?.nome ? body.admin.nome.trim() : null

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
      p_admin_email: adminEmail,
      p_admin_telefone: adminTelefone,
      p_admin_nome: adminNome,
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

    // 3) Garantir criação/vínculo do admin (sem convite; retorna senha gerada)
    let adminPassword: string | null = null
    let adminUserCreated = false
    let adminError: string | null = null

    const escolaId = (payload as any)?.escolaId || (payload as any)?.escola_id || null

    if (adminEmail && escolaId) {
      try {
        const provision = await ensureAdminUser(admin, {
          email: adminEmail,
          nome: adminNome,
          telefone: adminTelefone,
          escolaId,
        })
        adminPassword = provision.password
        adminUserCreated = provision.createdNew
      } catch (e: any) {
        adminError = e?.message || 'Falha ao provisionar admin'
      }
    }

    return NextResponse.json({
      ...payload,
      adminEmail,
      adminPassword,
      adminUserCreated,
      adminError,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

function generateStrongPassword(len = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[]{};:,.?'
  let pwd = ''
  for (let i = 0; i < len; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return pwd
}

async function ensureAdminUser(
  admin: SupabaseClient,
  params: { email: string; nome?: string | null; telefone?: string | null; escolaId: string }
) {
  const email = params.email.toLowerCase()
  const telefone = params.telefone ? params.telefone.replace(/\D/g, '') : null

  // Verifica se já existe usuário com este email
  const { data: list, error: listErr } = await (admin as any).auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listErr) throw listErr
  const existing = list?.users?.find((u: any) => (u.email || '').toLowerCase() === email)

  let userId: string | null = existing?.id || existing?.user?.id || null
  let password: string | null = null
  let createdNew = false

  if (!userId) {
    password = generateStrongPassword(12)
    const { data: created, error: cErr } = await (admin as any).auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'admin', must_change_password: true, nome: params.nome ?? undefined },
    })
    if (cErr) throw cErr
    userId = created?.user?.id ?? null
    createdNew = true
  }

  if (!userId) throw new Error('Não foi possível obter user_id para o admin')

  await (admin as any).from('profiles').upsert(
    {
      user_id: userId,
      email,
      nome: params.nome ?? null,
      telefone,
      role: 'admin',
      escola_id: params.escolaId,
      current_escola_id: params.escolaId,
    },
    { onConflict: 'user_id' }
  )

  await (admin as any).from('escola_administradores').upsert(
    {
      escola_id: params.escolaId,
      user_id: userId,
      cargo: 'administrador_principal',
    },
    { onConflict: 'escola_id,user_id' }
  )

  return { userId, createdNew, password }
}

function safeParseJSON(input: string) {
  try {
    return JSON.parse(input)
  } catch {
    return { ok: false, error: 'Resposta inválida do servidor' }
  }
}

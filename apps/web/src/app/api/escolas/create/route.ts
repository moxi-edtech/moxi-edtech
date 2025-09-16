// apps/web/src/app/api/escolas/create/route.ts
import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { z } from "zod";
import type { DBWithRPC } from "@/types/supabase-augment";

const BodySchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome da escola."),
  nif: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.replace(/\D/g, "") : undefined))
    .refine((v) => (v ? /^\d{9}$/.test(v) : true), {
      message: "NIF inválido. Use 9 dígitos.",
    })
    .nullable()
    .optional(),
  endereco: z.string().trim().nullable().optional(),
  admin: z
    .object({
      email: z
        .string()
        .email("Email do administrador inválido.")
        .transform((v) => v.toLowerCase())
        .nullable()
        .optional(),
      telefone: z
        .string()
        .transform((v) => v.replace(/\D/g, ""))
        .refine((v) => (v ? /^9\d{8}$/.test(v) : true), {
          message: "Telefone inválido. Use o formato 9XXXXXXXX.",
        })
        .nullable()
        .optional(),
      nome: z.string().trim().nullable().optional(),
    })
    .nullable()
    .optional(),
});

export async function POST(req: Request) {
  try {
    const parse = BodySchema.safeParse(await req.json())
    if (!parse.success) {
      const msg = parse.error.errors[0]?.message || "Dados inválidos"
      return NextResponse.json({ ok: false, error: msg }, { status: 400 })
    }

    const body = parse.data
    const nome = body.nome
    const nif = body.nif ?? null
    const endereco = body.endereco ?? null
    const adminEmail = body.admin?.email ?? null
    const adminTelefone = body.admin?.telefone ?? null
    const adminNome = body.admin?.nome ?? null

    const supabase = await supabaseServerTyped<DBWithRPC>()
    const { data, error } = await supabase.rpc('create_escola_with_admin', {
      p_nome: nome,
      p_nif: nif,
      p_endereco: endereco,
      p_admin_email: adminEmail,
      p_admin_telefone: adminTelefone,
      p_admin_nome: adminNome,
    })

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }

    // data is JSON from the function
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

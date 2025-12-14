import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { authorizeEscolaAction } from "@/lib/escola/disciplinas";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

async function authorize(escolaId: string) {
  const s = await supabaseServer();
  const { data: auth } = await s.auth.getUser();
  const user = auth?.user;
  if (!user)
    return { ok: false as const, status: 401, error: "Não autenticado" };
  const authz = await authorizeEscolaAction(s as any, escolaId, user.id, ['configurar_escola', 'gerenciar_disciplinas']);
  if (!authz.allowed)
    return { ok: false as const, status: 403, error: authz.reason || "Sem permissão" };

  // Hard check: perfil deve pertencer à escola
  try {
    const { data: profCheck } = await s
      .from("profiles" as any)
      .select("escola_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profCheck || (profCheck as any).escola_id !== escolaId) {
      return {
        ok: false as const,
        status: 403,
        error: "Perfil não vinculado à escola",
      };
    }
  } catch {}
  return { ok: true as const };
}

// PUT /api/escolas/[id]/classes/[classId]
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string; classId: string }> }
) {
  const { id: escolaId, classId } = await context.params;

  const authz = await authorize(escolaId);
  if (!authz.ok)
    return NextResponse.json(
      { ok: false, error: authz.error },
      { status: authz.status }
    );

  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { ok: false, error: "Configuração Supabase ausente." },
      { status: 500 }
    );
  }

  const admin = createAdminClient<Database>(supabaseUrl, serviceRoleKey);

  try {
    const raw = await req.json();
    const schema = z.object({
      nome: z.string().trim().min(1).optional(),
      descricao: z.string().nullable().optional(),
      ordem: z.number().int().positive().nullable().optional(),
      nivel: z.string().nullable().optional(),
    });
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || "Dados inválidos";
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    const updates = parsed.data as any;
    const { data, error } = await (admin as any)
      .from("classes")
      .update(updates)
      .eq("id", classId)
      .eq("escola_id", escolaId)
      .select("id, nome, descricao, ordem, nivel")
      .single();
    if (error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// DELETE /api/escolas/[id]/classes/[classId]
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; classId: string }> }
) {
  const { id: escolaId, classId } = await context.params;

  const authz = await authorize(escolaId);
  if (!authz.ok)
    return NextResponse.json(
      { ok: false, error: authz.error },
      { status: authz.status }
    );

  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { ok: false, error: "Configuração Supabase ausente." },
      { status: 500 }
    );
  }
  const admin = createAdminClient<Database>(supabaseUrl, serviceRoleKey);

  try {
    const { error } = await (admin as any)
      .from("classes")
      .delete()
      .eq("id", classId)
      .eq("escola_id", escolaId);
    if (error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

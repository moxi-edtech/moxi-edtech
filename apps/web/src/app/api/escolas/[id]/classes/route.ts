import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { hasPermission } from "@/lib/permissions";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

// POST /api/escolas/[id]/classes
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;
  try {
    const raw = await req.json();
    const bodySchema = z.object({
      nome: z.string().trim().min(1, "Nome é obrigatório"),
      descricao: z.string().optional().nullable(),
      ordem: z.number().int().positive().optional().nullable(),
      nivel: z.string().optional().nullable(),
    });
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message || "Dados inválidos";
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }
    const { nome, descricao, ordem, nivel } = parsed.data;

    const s = await supabaseServer();
    const { data: auth } = await s.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    // Autorização: configurar escola ou gerenciar disciplinas
    let allowed = false;
    try {
      const { data: vinc } = await s
        .from("escola_usuarios")
        .select("papel")
        .eq("escola_id", escolaId)
        .eq("user_id", user.id)
        .maybeSingle();
      const papel = (vinc as any)?.papel as any | undefined;
      allowed = !!papel && (hasPermission(papel, "configurar_escola") || hasPermission(papel, "gerenciar_disciplinas"));
    } catch {}
    if (!allowed) {
      try {
        const { data: adminLink } = await s
          .from("escola_administradores")
          .select("user_id")
          .eq("escola_id", escolaId)
          .eq("user_id", user.id)
          .limit(1);
        allowed = Boolean(adminLink && (adminLink as any[]).length > 0);
      } catch {}
    }
    if (!allowed) {
      try {
        const { data: prof } = await s
          .from("profiles")
          .select("user_id, role, escola_id")
          .eq("user_id", user.id)
          .eq("escola_id", escolaId)
          .limit(1);
        allowed = Boolean(prof && (prof as any[]).length > 0 && (prof as any)[0]?.role === 'admin');
      } catch {}
    }
    if (!allowed) return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Configuração Supabase ausente." }, { status: 500 });
    }
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Verifica duplicidade por escola+nome
    const { data: existing } = await (admin as any)
      .from('classes')
      .select('id, nome')
      .eq('escola_id', escolaId)
      .eq('nome', nome)
      .maybeSingle();

    let classId: string;
    if (existing?.id) {
      classId = existing.id as string;
    } else {
      // Tenta inserir com colunas opcionais e faz fallback
      let insId: string | null = null;
      let err1: any | null = null;
      {
        const { data: ins, error } = await (admin as any)
          .from('classes')
          .insert({ escola_id: escolaId, nome, descricao: descricao ?? null, ordem: ordem ?? null, nivel: nivel ?? null } as any)
          .select('id')
          .single();
        insId = ins?.id ?? null;
        err1 = error;
      }
      if (!insId && err1) {
        const { data: ins2, error: err2 } = await (admin as any)
          .from('classes')
          .insert({ escola_id: escolaId, nome } as any)
          .select('id')
          .single();
        if (err2) return NextResponse.json({ ok: false, error: err2.message }, { status: 400 });
        insId = ins2.id;
      }
      classId = insId!;
    }

    const payload = { id: classId, nome, descricao: descricao ?? undefined, ordem: ordem ?? 0, nivel: nivel ?? undefined };
    return NextResponse.json({ ok: true, data: payload });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// GET /api/escolas/[id]/classes
// Lista classes da escola (usa service role com autorização)
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;
  try {
    const s = await supabaseServer();
    const { data: auth } = await s.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    let allowed = false;
    try {
      const { data: prof } = await s
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      const role = (prof?.[0] as any)?.role as string | undefined;
      if (role === 'super_admin') allowed = true;
    } catch {}
    if (!allowed) {
      try {
        const { data: vinc } = await s
          .from('escola_usuarios')
          .select('papel')
          .eq('escola_id', escolaId)
          .eq('user_id', user.id)
          .maybeSingle();
        allowed = Boolean((vinc as any)?.papel);
      } catch {}
    }
    if (!allowed) {
      try {
        const { data: adminLink } = await s
          .from('escola_administradores')
          .select('user_id')
          .eq('escola_id', escolaId)
          .eq('user_id', user.id)
          .limit(1);
        allowed = Boolean(adminLink && (adminLink as any[]).length > 0);
      } catch {}
    }
    if (!allowed) {
      try {
        const { data: prof } = await s
          .from('profiles')
          .select('role, escola_id')
          .eq('user_id', user.id)
          .eq('escola_id', escolaId)
          .limit(1);
        allowed = Boolean(prof && (prof as any[]).length > 0 && (prof as any)[0]?.role === 'admin');
      } catch {}
    }
    if (!allowed) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 });

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Configuração Supabase ausente.' }, { status: 500 });
    }
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let rows: any[] = [];
    {
      const { data, error } = await (admin as any)
        .from('classes')
        .select('id, nome, descricao, ordem, nivel')
        .eq('escola_id', escolaId)
        .order('ordem', { ascending: true });
      if (!error) rows = data || [];
      else {
        const retry = await (admin as any)
          .from('classes')
          .select('id, nome, ordem')
          .eq('escola_id', escolaId)
          .order('ordem', { ascending: true });
        if (retry.error) return NextResponse.json({ ok: false, error: retry.error.message }, { status: 400 });
        rows = retry.data || [];
      }
    }
    const payload = rows.map((r: any) => ({
      id: r.id,
      nome: r.nome,
      descricao: r.descricao ?? undefined,
      ordem: r.ordem ?? 0,
      nivel: r.nivel ?? undefined,
    }));
    return NextResponse.json({ ok: true, data: payload });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

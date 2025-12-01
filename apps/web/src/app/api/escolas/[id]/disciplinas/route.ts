import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { hasPermission } from "@/lib/permissions";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";



// GET /api/escolas/[id]/disciplinas
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await params;
  try {
    const s = await supabaseServer();
    const { data: auth } = await s.auth.getUser();
    const user = auth?.user;
    if (!user)
      return NextResponse.json(
        { ok: false, error: "Não autenticado" },
        { status: 401 }
      );

    let allowed = false;
    try {
      const { data: prof } = await s
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);
      const role = (prof?.[0] as any)?.role as string | undefined;
      if (role === "super_admin") allowed = true;
    } catch {}
    if (!allowed) {
      try {
        const { data: vinc } = await s
          .from("escola_usuarios")
          .select("papel")
          .eq("escola_id", escolaId)
          .eq("user_id", user.id)
          .maybeSingle();
        allowed = Boolean((vinc as any)?.papel);
      } catch {}
    }
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
          .select("role, escola_id")
          .eq("user_id", user.id)
          .eq("escola_id", escolaId)
          .limit(1);
        allowed = Boolean(
          prof && (prof as any[]).length > 0 && (prof as any)[0]?.role === "admin"
        );
      } catch {}
    }
    if (!allowed)
      return NextResponse.json(
        { ok: false, error: "Sem permissão" },
        { status: 403 }
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

    let rows: any[] = [];
    {
      const { data, error } = await (admin as any)
        .from("disciplinas")
        .select("id, nome, tipo, curso_id, classe_id, descricao")
        .eq("escola_id", escolaId)
        .order("nome", { ascending: true });
      if (!error) rows = data || [];
      else {
        const retry = await (admin as any)
          .from("disciplinas")
          .select("id, nome")
          .eq("escola_id", escolaId)
          .order("nome", { ascending: true });
        if (retry.error)
          return NextResponse.json(
            { ok: false, error: retry.error.message },
            { status: 400 }
          );
        rows = retry.data || [];
      }
    }

    const payload = rows.map((r: any) => ({
      id: r.id,
      nome: r.nome,
      tipo: r.tipo ?? "core",
      curso_id: r.curso_id ?? undefined,
      classe_id: r.classe_id ?? undefined,
      descricao: r.descricao ?? undefined,
    }));
    return NextResponse.json({ ok: true, data: payload });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// POST /api/escolas/[id]/disciplinas
// Cria uma disciplina (opcionalmente vinculada a curso e/ou classe)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await params;
  try {
    const s = await supabaseServer();
    const { data: auth } = await s.auth.getUser();
    const user = auth?.user;
    if (!user)
      return NextResponse.json(
        { ok: false, error: "Não autenticado" },
        { status: 401 }
      );

    // Autoriza criar: super_admin, configurar_escola, admin vinculado
    let allowed = false;
    try {
      const { data: prof } = await s
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);
      const role = (prof?.[0] as any)?.role as string | undefined;
      if (role === "super_admin") allowed = true;
    } catch {}
    if (!allowed) {
      try {
        const { data: vinc } = await s
          .from("escola_usuarios")
          .select("papel")
          .eq("escola_id", escolaId)
          .eq("user_id", user.id)
          .maybeSingle();
        allowed = Boolean((vinc as any)?.papel);
      } catch {}
    }
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
    if (!allowed)
      return NextResponse.json(
        { ok: false, error: "Sem permissão" },
        { status: 403 }
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

    const body = await req.json().catch(() => ({}));
    const schema = z.object({
      nome: z.string().trim().min(1),
      tipo: z.enum(["core", "eletivo"]).optional().default("core"),
      curso_id: z.string().uuid().nullable().optional(),
      classe_id: z.string().uuid().nullable().optional(),
      descricao: z.string().trim().nullable().optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message || "Dados inválidos";
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    const payload: any = {
      escola_id: escolaId,
      nome: parsed.data.nome,
      tipo: parsed.data.tipo,
    };
    if (parsed.data.curso_id !== undefined) payload.curso_id = parsed.data.curso_id;
    if (parsed.data.classe_id !== undefined) payload.classe_id = parsed.data.classe_id;
    if (parsed.data.descricao !== undefined) payload.descricao = parsed.data.descricao;

    const { data: ins, error } = await (admin as any)
      .from("disciplinas")
      .insert(payload)
      .select("id, nome, tipo, curso_id, classe_id, descricao")
      .single();
    if (error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, data: ins });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

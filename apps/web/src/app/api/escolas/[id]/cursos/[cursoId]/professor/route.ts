import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { authorizeEscolaAction } from "@/lib/escola/disciplinas";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

// POST /api/escolas/[id]/cursos
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;

  try {
    const raw = await req.json();
    const base = z.object({
      nome: z.string().trim().min(1),
      tipo: z.enum(["core", "eletivo"]).default("core"),
      descricao: z.string().optional().nullable(),
      nivel: z.string().optional().nullable(),
    });
    const extendIds = base.and(
      z.object({
        periodo_id: z.string().uuid().optional(),
        semestre_id: z.string().uuid().optional(),
        sessao_id: z.string().uuid().optional(),
      })
    );
    const parse = extendIds.safeParse(raw);
    if (!parse.success) {
      const msg = parse.error.issues[0]?.message || "Dados inválidos";
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }
    const { nome, tipo, descricao, nivel } = parse.data as any;
    const periodo_id: string | undefined =
      (parse.data as any).periodo_id || (parse.data as any).semestre_id;

    const s = await supabaseServer();
    const { data: auth } = await s.auth.getUser();
    const user = auth?.user;
    if (!user)
      return NextResponse.json(
        { ok: false, error: "Não autenticado" },
        { status: 401 }
      );

    const authz = await authorizeEscolaAction(s as any, escolaId, user.id, ['configurar_escola', 'gerenciar_disciplinas']);
    if (!authz.allowed)
      return NextResponse.json(
        { ok: false, error: authz.reason || "Sem permissão" },
        { status: 403 }
      );

    // Hard check: perfil deve pertencer à escola
    const { data: profCheck } = await s
      .from("profiles" as any)
      .select("escola_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profCheck || (profCheck as any).escola_id !== escolaId) {
      return NextResponse.json(
        { ok: false, error: "Perfil não vinculado à escola" },
        { status: 403 }
      );
    }

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

    // Evita curso duplicado
    const { data: existing } = await (admin as any)
      .from("cursos")
      .select("id, nome")
      .eq("escola_id", escolaId)
      .eq("nome", nome)
      .maybeSingle();

    let cursoId: string;
    if (existing?.id) {
      cursoId = existing.id as string;
    } else {
      const codigo =
        nome.slice(0, 3).toUpperCase() +
        Math.floor(100 + Math.random() * 900);

      let insertId: string | null = null;
      let insertErr: any | null = null;

      const insertObj: any = {
        escola_id: escolaId,
        nome,
        codigo,
        tipo,
        descricao: descricao ?? null,
        nivel: nivel ?? null,
      };
      if (periodo_id) insertObj.semestre_id = periodo_id;

      const { data: ins, error: err } = await (admin as any)
        .from("cursos")
        .insert(insertObj)
        .select("id")
        .single();
      insertId = ins?.id as string | null;
      insertErr = err;

      if (!insertId && insertErr) {
        const { data: ins2, error: err2 } = await (admin as any)
          .from("cursos")
          .insert({ escola_id: escolaId, nome, codigo } as any)
          .select("id")
          .single();
        if (err2)
          return NextResponse.json(
            { ok: false, error: err2.message },
            { status: 400 }
          );
        insertId = ins2.id as string;
      }
      cursoId = insertId!;
    }

    const payload = {
      id: cursoId,
      nome,
      tipo,
      periodo_id: periodo_id as any,
      descricao: descricao ?? undefined,
      nivel: nivel ?? undefined,
      professor_id: undefined,
    };

    return NextResponse.json({ ok: true, data: payload });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// GET /api/escolas/[id]/cursos
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;
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
          .from("escola_users")
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
        .from("cursos")
        .select("id, nome, nivel, descricao")
        .eq("escola_id", escolaId)
        .order("nome", { ascending: true });
      if (!error) rows = data || [];
      else {
        const retry = await (admin as any)
          .from("cursos")
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
      tipo: "core",
      periodo_id: undefined,
      semestre_id: undefined,
      professor_id: undefined,
      nivel: r.nivel ?? undefined,
      descricao: r.descricao ?? undefined,
    }));
    return NextResponse.json({ ok: true, data: payload });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { authorizeEscolaAction } from "@/lib/escola/disciplinas";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";



// GET /api/escolas/[id]/cursos
// Lista cursos da escola (usa service role com autorização)
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;
  try {
    const s = await supabaseServer();
    const { data: auth } = await s.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const authz = await authorizeEscolaAction(s as any, escolaId, user.id, []);
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 });

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Configuração Supabase ausente." }, { status: 500 });
    }
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Buscar cursos com colunas opcionais em fallback
    let rows: any[] = [];
    {
      const { data, error } = await (admin as any)
        .from('cursos')
        .select('id, nome, nivel, descricao')
        .eq('escola_id', escolaId)
        .order('nome', { ascending: true });
      if (!error) rows = data || [];
      else {
        const retry = await (admin as any)
          .from('cursos')
          .select('id, nome')
          .eq('escola_id', escolaId)
          .order('nome', { ascending: true });
        if (retry.error) return NextResponse.json({ ok: false, error: retry.error.message }, { status: 400 });
        rows = retry.data || [];
      }
    }

    // Mapear para o tipo Course esperado pelo front
    const payload = rows.map((r: any) => ({
      id: r.id,
      nome: r.nome,
      tipo: 'core',
      periodo_id: undefined,
      semestre_id: undefined,
      professor_id: undefined,
      nivel: r.nivel ?? undefined,
      descricao: r.descricao ?? undefined,
    }));
    return NextResponse.json({ ok: true, data: payload });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// POST /api/escolas/[id]/cursos
// Cria um novo curso (usa service role com autorização)
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;
  try {
    const s = await supabaseServer();
    const { data: auth } = await s.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const authz = await authorizeEscolaAction(s as any, escolaId, user.id, ['configurar_escola']);
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 });

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Configuração Supabase ausente.' }, { status: 500 });
    }
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const body = await req.json().catch(() => ({}));
    const schema = z.object({
      nome: z.string().trim().min(1),
      nivel: z.string().trim().nullable().optional(),
      descricao: z.string().trim().nullable().optional(),
      codigo: z.string().trim().nullable().optional(),
      tipo: z.string().trim().nullable().optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message || 'Dados inválidos';
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    const payload: any = {
      escola_id: escolaId,
      nome: parsed.data.nome,
    };
    if (parsed.data.nivel !== undefined) payload.nivel = parsed.data.nivel;
    if (parsed.data.descricao !== undefined) payload.descricao = parsed.data.descricao;
    if (parsed.data.codigo !== undefined) payload.codigo = parsed.data.codigo;
    if (parsed.data.tipo !== undefined) payload.tipo = parsed.data.tipo;

    const { data: ins, error } = await (admin as any)
      .from('cursos')
      .insert(payload)
      .select('id, nome, nivel, descricao, codigo, tipo')
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, data: ins });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

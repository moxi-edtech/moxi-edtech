import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

// --- HELPERS PARA GERAR CÓDIGO (Consistência com outras rotas) ---
const normalizeNome = (nome: string): string =>
  nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");

const makeCursoCodigo = (nome: string, escolaId: string): string => {
  const prefix = escolaId.replace(/-/g, "").slice(0, 8);
  return `${prefix}_${normalizeNome(nome)}`;
};

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

    // Autoriza leitura básica por vínculo com a escola
    let allowed = false;
    
    // 1. Super Admin
    try {
      const { data: prof } = await s
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      const role = (prof?.[0] as any)?.role as string | undefined;
      if (role === 'super_admin') allowed = true;
    } catch {}

    // 2. Vínculo (CORRIGIDO: escola_users)
    if (!allowed) {
      try {
        const { data: vinc } = await s
          .from("escola_users") // <--- Corrigido
          .select("papel")
          .eq("escola_id", escolaId)
          .eq("user_id", user.id)
          .maybeSingle();
        allowed = Boolean((vinc as any)?.papel);
      } catch {}
    }

    // 3. Admin Legado
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

    // 4. Admin Profile
    if (!allowed) {
      try {
        const { data: prof } = await s
          .from("profiles")
          .select("role, escola_id")
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
        // Retry com menos colunas se falhar
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

    // Autoriza criar
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
          .from('escola_users') // <--- Corrigido
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
    
    if (!allowed) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 });

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

    // Se o código não veio, gera automaticamente
    const codigoFinal = parsed.data.codigo || makeCursoCodigo(parsed.data.nome, escolaId);

    const payload: any = {
      escola_id: escolaId,
      nome: parsed.data.nome,
      codigo: codigoFinal, // Garante que sempre tenha código
    };
    if (parsed.data.nivel !== undefined) payload.nivel = parsed.data.nivel;
    if (parsed.data.descricao !== undefined) payload.descricao = parsed.data.descricao;
    if (parsed.data.tipo !== undefined) payload.tipo = parsed.data.tipo;

    const { data: ins, error } = await (admin as any)
      .from('cursos')
      .insert(payload)
      .select('id, nome, nivel, descricao, codigo, tipo')
      .single();

    if (error) {
      // [BLINDAGEM] Tratamento de erro de duplicidade
      if (error.code === '23505') {
        return NextResponse.json(
          { ok: false, error: `O curso "${parsed.data.nome}" já existe nesta escola.` },
          { status: 409 } // Conflict
        );
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, data: ins });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
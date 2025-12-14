import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

// --- GET: Listar Turmas (Admin) ---
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

    // 1. Verificação de Permissão (Hierarquia)
    let allowed = false;

    // A) Super Admin
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

    // B) Vínculo na escola (CORRIGIDO: escola_users)
    if (!allowed) {
      try {
        const { data: vinc } = await s
          .from("escola_users") // <--- NOME CORRIGIDO
          .select("papel")
          .eq("escola_id", escolaId)
          .eq("user_id", user.id)
          .maybeSingle();
        allowed = Boolean((vinc as any)?.papel);
      } catch {}
    }

    // C) Tabela legado de administradores (se ainda usar)
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

    // D) Profile role 'admin' vinculado à escola
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

    // 2. Busca usando Admin Client (Bypass RLS)
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Configuração Supabase ausente." }, { status: 500 });
    }
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await admin
      .from('turmas')
      .select('id, nome, turno, ano_letivo, capacidade_maxima, sala, curso_id, classe_id') // Adicionei mais campos úteis
      .eq('escola_id', escolaId)
      .order('nome', { ascending: true });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, data: data || [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// --- POST: Criar Turma (COM BLINDAGEM) ---
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

    // Reutilizar lógica de permissão (simplificada aqui para brevidade, idealmente extrair para helper)
    // Para POST, assumimos que precisa ter vínculo na tabela escola_users
    const { data: vinc } = await s
        .from("escola_users")
        .select("id")
        .eq("escola_id", escolaId)
        .eq("user_id", user.id)
        .maybeSingle();
    
    if (!vinc) {
         return NextResponse.json({ ok: false, error: "Permissão negada" }, { status: 403 });
    }

    const body = await req.json();
    const { 
      nome, 
      turno, 
      sala, 
      ano_letivo, // OBRIGATÓRIO PARA A CONSTRAINT
      session_id, 
      capacidade_maxima, 
      curso_id, 
      classe_id 
    } = body;

    if (!nome || !turno || !ano_letivo) {
        return NextResponse.json({ ok: false, error: "Nome, Turno e Ano Letivo são obrigatórios" }, { status: 400 });
    }

    // Insert direto na tabela
    const { data, error } = await s
        .from('turmas')
        .insert({
            escola_id: escolaId,
            nome,
            turno,
            ano_letivo, // Importante para diferenciar Turma A 2024 de Turma A 2025
            session_id: session_id || null,
            sala: sala || null,
            capacidade_maxima: capacidade_maxima || 35,
            curso_id: curso_id || null,
            classe_id: classe_id || null
        })
        .select()
        .single();

    if (error) {
        // [BLINDAGEM] Tratamento do Erro de Constraint Unique
        if (error.code === '23505') {
            return NextResponse.json(
                { 
                  ok: false, 
                  error: `A Turma "${nome}" já existe para esta Classe/Curso neste turno e ano letivo.` 
                }, 
                { status: 409 } // Conflict
            );
        }
        throw error;
    }

    return NextResponse.json({ ok: true, data, message: "Turma criada com sucesso" });

  } catch (e: any) {
    console.error("Erro POST Turma:", e);
    return NextResponse.json({ ok: false, error: e.message || String(e) }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { canManageEscolaResources } from "../permissions";

// --- GET: Listar Turmas (Admin) ---
export async function GET(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const { id: escolaId } = context.params;
  try {
    const s = await supabaseServer();
    const { data: auth } = await s.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Configuração Supabase ausente." }, { status: 500 });
    }
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const allowed = await canManageEscolaResources(admin, escolaId, user.id);
    if (!allowed) return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });

    // 3. Parâmetros da URL
    const url = new URL(req.url);
    const turno = url.searchParams.get('turno');
    
    // 4. Query à VIEW
    let query = admin
      .from('vw_turmas_para_matricula') 
      .select('*')
      .eq('escola_id', escolaId)
      .order('nome', { ascending: true });

    if (turno && turno !== 'todos') query = query.eq('turno', turno);
    
    const { data: items, error } = await query;

    if (error) {
        console.error("Erro na View:", error);
        throw error;
    }

    // 5. Estatísticas
    let totalAlunos = 0;
    const porTurnoMap: Record<string, number> = {};

    (items || []).forEach((t: any) => {
        totalAlunos += (t.ocupacao_atual || 0);
        const tr = t.turno || 'sem_turno';
        porTurnoMap[tr] = (porTurnoMap[tr] || 0) + 1;
    });

    const stats = {
        totalTurmas: (items || []).length,
        totalAlunos: totalAlunos,
        porTurno: Object.entries(porTurnoMap).map(([k, v]) => ({ turno: k, total: v }))
    };

    return NextResponse.json({
      ok: true,
      items: items || [],
      total: (items || []).length,
      stats
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// --- POST: Criar Turma (COM BLINDAGEM) ---
export async function POST(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const { id: escolaId } = context.params;
  
  try {
    const s = await supabaseServer();
    const { data: auth } = await s.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Configuração Supabase ausente." }, { status: 500 });
    }
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const allowed = await canManageEscolaResources(admin, escolaId, user.id);
    if (!allowed) {
      return NextResponse.json({ ok: false, error: "Permissão negada" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
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
    const { data, error } = await (admin as any)
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

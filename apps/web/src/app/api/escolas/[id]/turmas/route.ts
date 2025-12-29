import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { canManageEscolaResources } from "../permissions";

const normalizeTurno = (turno: string | undefined): "M" | "T" | "N" | null => {
  const t = (turno || "").trim().toLowerCase();
  switch (t) {
    case "m":
    case "manha":
    case "manhã":
      return "M";
    case "t":
    case "tarde":
      return "T";
    case "n":
    case "noite":
      return "N";
    default:
      if (["M", "T", "N"].includes((turno || "").toUpperCase())) {
        return (turno || "").toUpperCase() as "M" | "T" | "N";
      }
      return null;
  }
};

// --- GET: Listar Turmas (Admin) ---
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await params;
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
    const url = new URL(request.url);
    const turno = url.searchParams.get('turno');
    const cursoId = url.searchParams.get('curso_id');
    const status = url.searchParams.get('status');

    // 4. Query à VIEW
    let query = admin
      .from('turmas') 
      .select(`
        *,
        curso:cursos(nome, tipo),
        classe:classes(nome),
        matriculas(count)
      `)
      .eq('escola_id', escolaId)
      .order('nome', { ascending: true });

    if (turno && turno !== 'todos') query = query.eq('turno', turno);
    if (cursoId) query = query.eq('curso_id', cursoId);
    if (status && status !== 'todos') query = query.eq('status_validacao', status);
    
    const { data: rows, error } = await query;

    if (error) {
        console.error("Erro na tabela turmas:", error);
        throw error;
    }

    // Enriquecimento para o frontend exibir Curso/Classe corretamente
    const items = (rows || []).map((t: any) => ({
      ...t,
      nome: t.nome ?? 'Sem Nome',
      turno: t.turno ?? 'sem_turno',
      sala: t.sala ?? '',
      capacidade_maxima: t.capacidade_maxima ?? 35,
      curso_nome: t.curso?.nome ?? '',
      classe_nome: t.classe?.nome ?? '',
      status_validacao: t.status_validacao ?? 'ativo',
      ocupacao_atual: t.matriculas?.[0]?.count ?? 0,
    }));

    const porTurnoMap: Record<string, number> = {};
    let totalAlunos = 0;

    items.forEach((t: any) => {
      const key = String(t.turno || 'sem_turno')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      porTurnoMap[key] = (porTurnoMap[key] || 0) + 1;
      totalAlunos += Number(t.ocupacao_atual || 0);
    });

    const stats = {
      totalTurmas: items.length,
      totalAlunos,
      porTurno: Object.entries(porTurnoMap).map(([turnoKey, total]) => ({ turno: turnoKey, total })),
    };

    return NextResponse.json({
      ok: true,
      items,
      total: items.length,
      stats,
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// --- POST: Criar Turma (COM BLINDAGEM) ---
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await params;
  
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

    const body = await request.json().catch(() => ({}));
    const { 
      nome, 
      turno: turnoRaw, 
      sala, 
      ano_letivo, // OBRIGATÓRIO PARA A CONSTRAINT
      session_id, 
      capacidade_maxima, 
      curso_id, 
      classe_id,
      letra,
      classe_num
    } = body;
    
    const turno = normalizeTurno(turnoRaw);

    if (!nome || !turno || !ano_letivo || !curso_id) {
        return NextResponse.json({ ok: false, error: "Nome, Turno, Ano Letivo e curso_id são obrigatórios" }, { status: 400 });
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
        classe_id: classe_id || null,
        letra: letra || null,
        classe_num: classe_num ?? null
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

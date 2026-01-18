import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { canManageEscolaResources } from "../permissions";
import { applyKf2ListInvariants } from "@/lib/kf2";

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

    // 4. Query usando a view que resolve curso/classe
    let query = admin
      .from('vw_turmas_para_matricula')
      .select('id, turma_nome, turno, sala, capacidade_maxima, curso_nome, classe_nome, status_validacao, ocupacao_atual, ultima_matricula, escola_id, curso_id')
      .eq('escola_id', escolaId)
    
    query = applyKf2ListInvariants(query, {
      order: [
        { column: 'turma_nome', ascending: true },
        { column: 'id', ascending: false },
      ],
    });

    const normalizedTurno = turno && turno !== 'todos' ? turno.toUpperCase() : null;
    if (normalizedTurno) query = query.eq('turno', normalizedTurno);
    if (cursoId) query = query.eq('curso_id', cursoId);
    if (status && status !== 'todos') query = query.eq('status_validacao', status);
    
    const isMissingColumn = (err: any) => {
      const msg = err?.message as string | undefined
      const code = err?.code as string | undefined
      return code === '42703' || (msg && /column .* does not exist|does not exist/i.test(msg))
    }
    const isMissingView = (err: any) => {
      const msg = err?.message as string | undefined
      const code = err?.code as string | undefined
      return code === '42P01' || (msg && /relation .* does not exist|does not exist/i.test(msg))
    }

    let rows: any[] | null = null
    const { data: viewRows, error } = await query;

    if (error) {
      console.error("Erro na view vw_turmas_para_matricula:", error);
      if (!(isMissingColumn(error) || isMissingView(error))) {
        throw error;
      }

      let fallbackQuery = admin
        .from('turmas' as any)
        .select('id, nome, turno, sala, capacidade_maxima, status_validacao, escola_id, curso_id, classe_id')
        .eq('escola_id', escolaId)

      fallbackQuery = applyKf2ListInvariants(fallbackQuery, {
        order: [
          { column: 'nome', ascending: true },
          { column: 'id', ascending: false },
        ],
      })

      if (normalizedTurno) fallbackQuery = fallbackQuery.eq('turno', normalizedTurno);
      if (cursoId) fallbackQuery = fallbackQuery.eq('curso_id', cursoId);
      if (status && status !== 'todos') fallbackQuery = fallbackQuery.eq('status_validacao', status);

      const { data: fallbackRows, error: fallbackError } = await fallbackQuery
      if (fallbackError) {
        console.error('Erro no fallback de turmas:', fallbackError)
        throw fallbackError
      }

      rows = (fallbackRows || []).map((t: any) => ({
        id: t.id,
        turma_nome: t.nome ?? null,
        turno: t.turno ?? null,
        sala: t.sala ?? null,
        capacidade_maxima: t.capacidade_maxima ?? null,
        curso_nome: null,
        classe_nome: null,
        status_validacao: t.status_validacao ?? null,
        ocupacao_atual: 0,
        ultima_matricula: null,
        escola_id: t.escola_id ?? escolaId,
        curso_id: t.curso_id ?? null,
      }))
    } else {
      rows = viewRows as any[]
    }

    // Busca turma_codigo original para rótulos de rascunho
    let codigoMap: Record<string, string | null> = {};
    const turmaIds = (rows || []).map((r) => r.id).filter(Boolean);
    if (turmaIds.length > 0) {
      const { data: codigoRows } = await admin
        .from('turmas')
        .select('id, turma_codigo')
        .in('id', turmaIds as string[]);
      codigoRows?.forEach((c) => {
        codigoMap[c.id] = c.turma_codigo;
      });
    }

    // Enriquecimento para o frontend exibir Curso/Classe corretamente
    const items = (rows || []).map((t: any) => ({
      ...t,
      nome: t.turma_nome ?? 'Sem Nome',
      turno: t.turno ?? 'sem_turno',
      sala: t.sala ?? '',
      capacidade_maxima: t.capacidade_maxima ?? 35,
      curso_nome: t.curso_nome ?? '',
      classe_nome: t.classe_nome ?? '',
      status_validacao: t.status_validacao ?? 'ativo',
      ocupacao_atual: t.ocupacao_atual ?? 0,
      ultima_matricula: t.ultima_matricula ?? null,
      turma_codigo: codigoMap[t.id] ?? '',
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

    // Valida ano_letivo contra anos_letivos da escola
    try {
      const { data: anoRow } = await (admin as any)
        .from('anos_letivos')
        .select('ano')
        .eq('escola_id', escolaId)
        .eq('ano', Number(ano_letivo))
        .maybeSingle()
      if (!anoRow) {
        return NextResponse.json({ ok: false, error: 'Ano letivo não encontrado para esta escola' }, { status: 400 })
      }
    } catch (err) {
      // se a tabela não existir neste ambiente, deixa seguir
    }

    // Insert direto na tabela
    const { data, error } = await (admin as any)
      .from('turmas')
      .insert({
        escola_id: escolaId,
        nome,
        turno,
        ano_letivo, // Importante para diferenciar Turma A 2024 de Turma A 2025
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

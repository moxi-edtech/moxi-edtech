import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { hasPermission } from "@/lib/permissions";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

// Helper para validar sobreposição de intervalos [start, end]
function hasOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
  return start1 <= end2 && start2 <= end1;
}

// GET /api/escolas/[id]/semestres
// Lista períodos de uma sessão da escola
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;
  try {
    const url = new URL(req.url);
    const sessao_id = url.searchParams.get('sessao_id');
    const tipo = (url.searchParams.get('tipo') || '').toUpperCase();
    if (!sessao_id) return NextResponse.json({ ok: false, error: 'sessao_id é obrigatório' }, { status: 400 });

    const s = await supabaseServer();
    const { data: auth } = await s.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    // Autorização (mesmo critério do POST)
    let allowed = false;
    try {
      const { data: prof } = await s.from('profiles').select('role').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1);
      const role = (prof?.[0] as any)?.role as string | undefined;
      if (role === 'super_admin') allowed = true;
    } catch {}
    if (!allowed) {
      try {
        const { data: vinc } = await s.from('escola_users').select('papel').eq('escola_id', escolaId).eq('user_id', user.id).maybeSingle();
        const papel = (vinc as any)?.papel as string | undefined;
        allowed = !!papel && hasPermission(papel as any, 'configurar_escola');
      } catch {}
    }
    if (!allowed) {
      try {
        const { data: adminLink } = await s.from('escola_administradores').select('user_id').eq('escola_id', escolaId).eq('user_id', user.id).limit(1);
        allowed = Boolean(adminLink && (adminLink as any[]).length > 0);
      } catch {}
    }
    if (!allowed) {
      try {
        const { data: prof } = await s.from('profiles').select('role, escola_id').eq('user_id', user.id).eq('escola_id', escolaId).limit(1);
        allowed = Boolean(prof && prof.length > 0 && (prof[0] as any).role === 'admin');
      } catch {}
    }
    if (!allowed) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 });

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Configuração Supabase ausente.' }, { status: 500 });
    }
    const admin = createAdminClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Verifica sessão pertence à escola
    const { data: sess, error: sErr } = await (admin as any)
      .from('school_sessions')
      .select('id, escola_id')
      .eq('id', sessao_id)
      .maybeSingle();
    if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 400 });
    if (!sess || (sess as any).escola_id !== escolaId) return NextResponse.json({ ok: false, error: 'Sessão inválida para esta escola' }, { status: 404 });

    let q = (admin as any).from('semestres').select('*').eq('session_id', sessao_id).eq('escola_id', escolaId).order('data_inicio', { ascending: true });
    if (tipo && ['TRIMESTRE', 'BIMESTRE', 'SEMESTRE', 'ANUAL'].includes(tipo)) q = q.eq('tipo', tipo);
    const { data, error } = await q;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, items: data || [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// POST /api/escolas/[id]/semestres
// Cria um período (semestre/trimestre/bimestre/anual) dentro de uma sessão
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;

  // Regras de negócio: limites por tipo
  const maxByTipo: Record<string, number> = {
    TRIMESTRE: 3,
    BIMESTRE: 6,
    SEMESTRE: 2,
    ANUAL: 1,
  };

  try {
    // Valida payload
    const schema = z.object({
      sessao_id: z.string().uuid(),
      nome: z.string().min(1).optional(),
      data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      tipo: z.enum(["TRIMESTRE", "BIMESTRE", "SEMESTRE", "ANUAL"]).optional(),
    });
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message || "Dados inválidos";
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    const { sessao_id, nome, data_inicio, data_fim } = parsed.data as any;
    let { tipo } = parsed.data as any;

    // Autenticação
    const s = await supabaseServer();
    const { data: auth } = await s.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    // Autorização: configurar_escola ou admin/super_admin vinculado
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
        const papel = (vinc as any)?.papel as string | undefined;
        allowed = !!papel && hasPermission(papel as any, "configurar_escola");
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
        allowed = Boolean(prof && prof.length > 0 && (prof[0] as any).role === "admin");
      } catch {}
    }
    if (!allowed) return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });

    // Confirma sessão pertence à escola e pega datas
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Configuração Supabase ausente." }, { status: 500 });
    }
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: sess, error: sErr } = await (admin as any)
      .from("school_sessions")
      .select("id, escola_id, data_inicio, data_fim")
      .eq("id", sessao_id)
      .maybeSingle();
    if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 400 });
    if (!sess || (sess as any).escola_id !== escolaId) {
      return NextResponse.json({ ok: false, error: "Sessão inválida para esta escola" }, { status: 404 });
    }

    // Validação de datas básicas
    const newStart = new Date(data_inicio);
    const newEnd = new Date(data_fim);
    if (Number.isNaN(newStart.getTime()) || Number.isNaN(newEnd.getTime())) {
      return NextResponse.json({ ok: false, error: "Datas inválidas" }, { status: 400 });
    }
    if (newEnd < newStart) {
      return NextResponse.json({ ok: false, error: "data_fim deve ser após data_inicio" }, { status: 400 });
    }

    const sessionStart = new Date(String((sess as any).data_inicio));
    const sessionEnd = new Date(String((sess as any).data_fim));
    if (newStart < sessionStart || newEnd > sessionEnd) {
      return NextResponse.json({ ok: false, error: "Período fora do intervalo da sessão" }, { status: 400 });
    }

    // Descobre tipo efetivo
    let effectiveTipo = (tipo || "").toUpperCase();
    if (!maxByTipo[effectiveTipo]) {
      // Fallback para configuração da escola
      try {
        const { data: cfg } = await (admin as any)
          .from("configuracoes_escola")
          .select("periodo_tipo")
          .eq("escola_id", escolaId)
          .maybeSingle();
        const p = (cfg as any)?.periodo_tipo as string | undefined; // 'semestre' | 'trimestre'
        if (p === "semestre") effectiveTipo = "SEMESTRE";
        else if (p === "trimestre") effectiveTipo = "TRIMESTRE";
      } catch {}
      if (!maxByTipo[effectiveTipo]) effectiveTipo = "TRIMESTRE";
    }

    // Busca períodos existentes da sessão
    const { data: rows, error: listErr } = await (admin as any)
      .from("semestres")
      .select("id, nome, data_inicio, data_fim, tipo")
      .eq("session_id", sessao_id)
      .order("data_inicio", { ascending: true });
    if (listErr) return NextResponse.json({ ok: false, error: listErr.message }, { status: 400 });

    const existing = (rows || []) as Array<{ id: string; nome: string; data_inicio: string; data_fim: string; tipo?: string }>;
    const existingCount = existing.length;

    // Sobreposição de datas
    for (const existingPeriod of existing) {
      const exStart = new Date(existingPeriod.data_inicio);
      const exEnd = new Date(existingPeriod.data_fim);
      if (hasOverlap(newStart, newEnd, exStart, exEnd)) {
        return NextResponse.json({
          ok: false,
          error: `As datas sobrepõem-se ao período existente "${existingPeriod.nome}" (${existingPeriod.data_inicio} a ${existingPeriod.data_fim}).`
        }, { status: 400 });
      }
    }

    // Limite por tipo
    const sameTypeCount = existing.filter((r) => String((r.tipo || "").toUpperCase()) === effectiveTipo).length;
    const maxAllowed = maxByTipo[effectiveTipo] ?? Infinity;
    if (sameTypeCount >= maxAllowed) {
      return NextResponse.json({ ok: false, error: `Limite máximo de ${effectiveTipo.toLowerCase()}s atingido (${maxAllowed}).` }, { status: 400 });
    }

    // Geração de nome inteligente caso vazio ou genérico
    let finalNome: string | undefined = nome;
    if (!finalNome || finalNome.trim().toUpperCase() === effectiveTipo) {
      const nextNumber = existingCount + 1;
      const typeLabel = effectiveTipo.charAt(0) + effectiveTipo.slice(1).toLowerCase();
      finalNome = `${nextNumber}º ${typeLabel}`; // ex: "1º Trimestre"
    }

    // Monta registro para inserção
    const baseInsert: any = {
      session_id: sessao_id,
      escola_id: escolaId,
      nome: finalNome,
      data_inicio,
      data_fim,
      attendance_type: "section",
      permitir_submissao_final: false,
      tipo: effectiveTipo,
    };

    // Tenta inserir com 'tipo', se coluna não existir, tenta sem
    let insertErr: any = null;
    let inserted: any[] | null = null;
    {
      const { data: insData, error } = await (admin as any)
        .from("semestres")
        .insert(baseInsert as any)
        .select("id");
      insertErr = error;
      inserted = insData as any[] | null;
    }
    if (insertErr && String(insertErr.message || "").toLowerCase().includes("column") && String(insertErr.message || "").includes("tipo")) {
      const { tipo: _t, ...withoutTipo } = baseInsert;
      const { data: insData2, error: retryErr } = await (admin as any)
        .from("semestres")
        .insert(withoutTipo as any)
        .select("id");
      insertErr = retryErr;
      if (!retryErr) inserted = insData2 as any[] | null;
    }
    if (insertErr) {
      return NextResponse.json({ ok: false, error: insertErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, id: inserted?.[0]?.id || null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

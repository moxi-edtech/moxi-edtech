import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { hasPermission } from "@/lib/permissions";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

// POST /api/escolas/[id]/semestres
// Cria um semestre para a sessão ativa informada
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;

  try {
    const schema = z.object({
      nome: z.string().trim().min(1),
      data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      sessao_id: z.string().uuid(),
      numero: z.number().int().min(1).optional(),
      // Permite diferentes tipos de período (não obrigatório)
      tipo: z.enum(['BIMESTRE','TRIMESTRE','SEMESTRE','ANUAL']).optional(),
    });
    const parse = schema.safeParse(await req.json());
    if (!parse.success) {
      const msg = parse.error.errors[0]?.message || "Dados inválidos";
      console.error('[semestres.POST] invalid payload', {
        reason: msg,
        issues: parse.error.errors?.map(e => ({ path: e.path, code: e.code, message: e.message }))
      });
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }
    const { nome, data_inicio, data_fim, sessao_id, tipo } = parse.data;

    const s = await supabaseServer();
    const { data: auth } = await s.auth.getUser();
    const user = auth?.user;
    if (!user) {
      console.error('[semestres.POST] not authenticated');
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    // Autorização: precisa poder configurar escola
    let allowed = false;
    // Allow super_admin globally
    try {
      const { data: prof } = await s
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
      const role = (prof?.[0] as any)?.role as string | undefined
      if (role === 'super_admin') allowed = true
    } catch {}
    try {
      const { data: vinc } = await s
        .from("escola_usuarios")
        .select("papel")
        .eq("escola_id", escolaId)
        .eq("user_id", user.id)
        .maybeSingle();
      const papel = (vinc as any)?.papel as string | undefined;
      allowed = !!papel && hasPermission(papel as any, "configurar_escola");
    } catch {}
    if (!allowed) {
      // Fallback: vínculo direto como administrador da escola
      try {
        const { data: adminLink } = await s
          .from('escola_administradores')
          .select('user_id')
          .eq('escola_id', escolaId)
          .eq('user_id', user.id)
          .limit(1)
        allowed = Boolean(adminLink && (adminLink as any[]).length > 0)
      } catch {}
    }
    if (!allowed) {
      // Fallback: perfil global admin vinculado à escola
      try {
        const { data: prof } = await s
          .from('profiles')
          .select('role, escola_id')
          .eq('user_id', user.id)
          .eq('escola_id', escolaId)
          .limit(1)
        allowed = Boolean(prof && prof.length > 0 && (prof[0] as any).role === 'admin')
      } catch {}
    }
    if (!allowed) {
      console.error('[semestres.POST] forbidden: user lacks configurar_escola');
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Configuração Supabase ausente." }, { status: 500 });
    }
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1) Verifica se a sessão existe e pertence à escola; e valida o intervalo de datas
    const { data: sess, error: sessErr } = await (admin as any)
      .from("school_sessions")
      .select("id, escola_id, data_inicio, data_fim")
      .eq("id", sessao_id)
      .maybeSingle();
    if (sessErr) {
      console.error('[semestres.POST] session fetch error', { message: sessErr.message, code: (sessErr as any)?.code });
      return NextResponse.json({ ok: false, error: sessErr.message }, { status: 400 });
    }
    if (!sess) {
      return NextResponse.json({ ok: false, error: "Sessão acadêmica não encontrada." }, { status: 404 });
    }
    if (String(sess.escola_id) !== String(escolaId)) {
      return NextResponse.json({ ok: false, error: "Sessão não pertence a esta escola." }, { status: 403 });
    }
    const sessStart = String(sess.data_inicio);
    const sessEnd = String(sess.data_fim);
    if (data_inicio > data_fim) {
      console.error('[semestres.POST] invalid range: start after end', { data_inicio, data_fim });
      return NextResponse.json({ ok: false, error: "A data de início deve ser anterior à data de término." }, { status: 400 });
    }
    if (data_inicio < sessStart || data_fim > sessEnd) {
      console.error('[semestres.POST] dates out of session bounds', { data_inicio, data_fim, sessStart, sessEnd });
      return NextResponse.json({ ok: false, error: "As datas do período devem estar dentro do intervalo da sessão acadêmica ativa." }, { status: 400 });
    }

    // Regra de negócio: Trimestre não pode exceder 3 meses de duração
    if (tipo === 'TRIMESTRE') {
      const start = new Date(data_inicio)
      const end = new Date(data_fim)
      const limit = new Date(start)
      // Permite no máximo 3 meses a partir do início (inclusive)
      limit.setMonth(limit.getMonth() + 3)
      if (end > limit) {
        console.error('[semestres.POST] trimestre exceeds 3 months', { data_inicio, data_fim, limit: limit.toISOString().split('T')[0] })
        return NextResponse.json({ ok: false, error: "Trimestre deve ter no máximo 3 meses." }, { status: 400 })
      }
    }

    // 2) Cria o período (attendance_type exigido pela tabela; usamos 'secao' por padrão)
    // Tenta incluir a coluna opcional 'tipo' quando existir na tabela.
    const baseInsert: any = {
      session_id: sessao_id,
      nome,
      data_inicio,
      data_fim,
      // Alinha com enum/valores usados no seed (section/curso)
      attendance_type: "section",
      permitir_submissao_final: false,
    };
    if (tipo) baseInsert.tipo = tipo;

    let inserted: any | null = null;
    let insertErr: any | null = null;
    {
      const { data, error } = await (admin as any)
        .from("semestres")
        .insert(baseInsert)
        .select("id, nome, data_inicio, data_fim, session_id, tipo")
        .single();
      inserted = data;
      insertErr = error;
    }
    // Fallback: se a coluna 'tipo' não existir, tenta novamente sem ela
    if (insertErr && String(insertErr.message || "").toLowerCase().includes("column") && String(insertErr.message || "").includes("tipo")) {
      const noTipoInsert = { ...baseInsert };
      delete (noTipoInsert as any).tipo;
      const { data, error } = await (admin as any)
        .from("semestres")
        .insert(noTipoInsert)
        .select("id, nome, data_inicio, data_fim, session_id")
        .single();
      inserted = data;
      insertErr = error;
      // Emite payload com 'tipo' vindo do request, mesmo se não persistido, para UI
      if (inserted && tipo) inserted.tipo = tipo;
    }

    if (insertErr) {
      console.error('[semestres.POST] insert error', { message: insertErr.message, code: (insertErr as any)?.code, details: (insertErr as any)?.details });
      return NextResponse.json({ ok: false, error: insertErr.message }, { status: 400 });
    }

    const payload = {
      id: inserted.id,
      nome: inserted.nome,
      data_inicio: inserted.data_inicio,
      data_fim: inserted.data_fim,
      sessao_id: inserted.session_id,
      tipo: inserted.tipo,
    };

    return NextResponse.json({ ok: true, data: payload });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// GET /api/escolas/[id]/semestres?session_id=...
// Lista os semestres (períodos) de uma sessão específica da escola
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "Parâmetro session_id é obrigatório." }, { status: 400 });
  }

  try {
    const s = await supabaseServer();
    const { data: auth } = await s.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    // Verifica vínculo/permissão mínima com a escola
    let allowed = false;
    // Allow super_admin globally
    try {
      const { data: prof } = await s
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
      const role = (prof?.[0] as any)?.role as string | undefined
      if (role === 'super_admin') allowed = true
    } catch {}
    try {
      const { data: vinc } = await s
        .from("escola_usuarios")
        .select("papel")
        .eq("escola_id", escolaId)
        .eq("user_id", user.id)
        .maybeSingle();
      const papel = (vinc as any)?.papel as string | undefined;
      // Qualquer papel com acesso à escola pode listar períodos; ajuste se necessário
      allowed = !!papel;
    } catch {}
    if (!allowed) {
      // Fallback: vínculo direto como administrador da escola
      try {
        const { data: adminLink } = await s
          .from('escola_administradores')
          .select('user_id')
          .eq('escola_id', escolaId)
          .eq('user_id', user.id)
          .limit(1)
        allowed = Boolean(adminLink && (adminLink as any[]).length > 0)
      } catch {}
    }
    if (!allowed) {
      // Fallback: perfil global admin vinculado à escola
      try {
        const { data: prof } = await s
          .from('profiles')
          .select('role, escola_id')
          .eq('user_id', user.id)
          .eq('escola_id', escolaId)
          .limit(1)
        allowed = Boolean(prof && prof.length > 0 && (prof[0] as any).role === 'admin')
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

    // Garante que a sessão pertence à escola
    const { data: sess, error: sessErr } = await (admin as any)
      .from("school_sessions")
      .select("id, escola_id")
      .eq("id", sessionId)
      .maybeSingle();
    if (sessErr) return NextResponse.json({ ok: false, error: sessErr.message }, { status: 400 });
    if (!sess) return NextResponse.json({ ok: false, error: "Sessão não encontrada" }, { status: 404 });
    if (String(sess.escola_id) !== String(escolaId)) {
      return NextResponse.json({ ok: false, error: "Sessão não pertence a esta escola." }, { status: 403 });
    }

    // Tenta buscar incluindo 'tipo'; se a coluna não existir, refaz sem ela
    let sems: any[] | null = null;
    {
      const { data, error } = await (admin as any)
        .from("semestres")
        .select("id, nome, data_inicio, data_fim, session_id, tipo")
        .eq("session_id", sessionId)
        .order("data_inicio", { ascending: true });
      if (!error) {
        sems = data || [];
      } else if (String(error.message || "").toLowerCase().includes("column") && String(error.message || "").includes("tipo")) {
        const retry = await (admin as any)
          .from("semestres")
          .select("id, nome, data_inicio, data_fim, session_id")
          .eq("session_id", sessionId)
          .order("data_inicio", { ascending: true });
        if (retry.error) return NextResponse.json({ ok: false, error: retry.error.message }, { status: 400 });
        sems = retry.data || [];
      } else if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      }
    }

    const payload = (sems || []).map((row: any, idx: number) => ({
      id: row.id,
      nome: row.nome,
      numero: idx + 1,
      data_inicio: String(row.data_inicio),
      data_fim: String(row.data_fim),
      sessao_id: row.session_id,
      tipo: row.tipo,
    }));

    return NextResponse.json({ ok: true, data: payload });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

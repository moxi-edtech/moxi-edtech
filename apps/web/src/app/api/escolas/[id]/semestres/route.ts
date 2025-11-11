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
      const msg = parse.error.issues?.[0]?.message || "Dados inválidos";
      console.error('[semestres.POST] invalid payload', {
        reason: msg,
        issues: parse.error.issues?.map(e => ({ path: e.path, code: e.code, message: e.message }))
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

    // Carrega configuração da escola para determinar tipo padrão (semestre/trimestre)
    let effectiveTipo: 'TRIMESTRE' | 'SEMESTRE' | 'BIMESTRE' | 'ANUAL' | undefined = tipo as any;
    if (!effectiveTipo) {
      try {
        const { data: cfg } = await (admin as any)
          .from('configuracoes_escola')
          .select('periodo_tipo')
          .eq('escola_id', escolaId)
          .maybeSingle();
        const p = (cfg as any)?.periodo_tipo as string | undefined;
        if (p === 'trimestre') effectiveTipo = 'TRIMESTRE';
        else if (p === 'semestre') effectiveTipo = 'SEMESTRE';
      } catch {}
      // Fallback: padrão é TRIMESTRE
      if (!effectiveTipo) effectiveTipo = 'TRIMESTRE';
    }

    // Regras de negócio: limites por tipo e consistência de regime
    // - TRIMESTRE: no máx. 3 períodos e cada um com no máx. 3 meses
    // - BIMESTRE: no máx. 6 períodos
    // - SEMESTRE: no máx. 2 períodos
    // - ANUAL: no máx. 1 período
    const maxByTipo: Record<string, number> = {
      TRIMESTRE: 3,
      BIMESTRE: 6,
      SEMESTRE: 2,
      ANUAL: 1,
    }

    // 1) Trimestre: não pode exceder 3 meses de duração
    if (effectiveTipo === 'TRIMESTRE') {
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

    // 2) Verifica quantidade existente e consistência do regime (tipo) na sessão
    try {
      // Busca períodos existentes da sessão (tentando incluir a coluna 'tipo' quando existir)
      let rows: any[] = []
      {
        const { data, error } = await (admin as any)
          .from('semestres')
          .select('id, tipo, session_id')
          .eq('session_id', sessao_id)
        if (!error) rows = data || []
        else if (String(error.message || '').toLowerCase().includes('column') && String(error.message || '').includes('tipo')) {
          const retry = await (admin as any)
            .from('semestres')
            .select('id, session_id')
            .eq('session_id', sessao_id)
          if (!retry.error) rows = retry.data || []
          else throw retry.error
        } else throw error
      }

      const existingCount = rows.length
      const maxAllowed = maxByTipo[effectiveTipo]

      // Se já existem períodos com tipo anotado e diferente do solicitado, bloquear para manter regime único
      const hasTipoInfo = rows.some(r => typeof r.tipo !== 'undefined' && r.tipo !== null)
      if (hasTipoInfo) {
        const different = rows.find(r => r.tipo && r.tipo !== effectiveTipo)
        if (different) {
          return NextResponse.json({ ok: false, error: 'Os períodos desta sessão seguem outro regime. Exclua-os antes de criar períodos de outro tipo.' }, { status: 409 })
        }
      }

      if (existingCount + 1 > maxAllowed) {
        return NextResponse.json({ ok: false, error: `Limite atingido para ${effectiveTipo.toLowerCase()}. Máximo permitido: ${maxAllowed}.` }, { status: 400 })
      }
    } catch (e: any) {
      // Se houver erro ao verificar, loga mas não prossegue com criação arriscada
      console.error('[semestres.POST] failed to enforce count/type constraints', { message: e?.message })
      return NextResponse.json({ ok: false, error: 'Falha ao validar limites de períodos.' }, { status: 400 })
    }

    // 2) Cria o período (attendance_type exigido pela tabela; usamos 'secao' por padrão)
    // Tenta incluir a coluna opcional 'tipo' quando existir na tabela.
    const baseInsert: any = {
      session_id: sessao_id,
      escola_id: escolaId,
      nome,
      data_inicio,
      data_fim,
      // Alinha com enum/valores usados no seed (section/curso)
      attendance_type: "section",
      permitir_submissao_final: false,
    };
    if (effectiveTipo) baseInsert.tipo = effectiveTipo;

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
      if (inserted && effectiveTipo) inserted.tipo = effectiveTipo;
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

// PATCH /api/escolas/[id]/semestres
// Atualiza campos básicos de um período existente (nome, datas, tipo)
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params
  try {
    const schema = z.object({
      id: z.string().uuid(),
      nome: z.string().trim().min(1).optional(),
      data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      tipo: z.enum(['BIMESTRE','TRIMESTRE','SEMESTRE','ANUAL']).optional(),
    })
    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message || 'Dados inválidos'
      return NextResponse.json({ ok: false, error: msg }, { status: 400 })
    }
    const { id, nome, data_inicio, data_fim, tipo } = parsed.data

    const s = await supabaseServer()
    const { data: auth } = await s.auth.getUser()
    const user = auth?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    // Autorização: precisa poder configurar escola
    let allowed = false
    try {
      const { data: prof } = await s.from('profiles').select('role').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1)
      const role = (prof?.[0] as any)?.role as string | undefined
      if (role === 'super_admin') allowed = true
    } catch {}
    try {
      const { data: vinc } = await s.from('escola_usuarios').select('papel').eq('escola_id', escolaId).eq('user_id', user.id).maybeSingle();
      const papel = (vinc as any)?.papel as string | undefined
      allowed = !!papel && hasPermission(papel as any, 'configurar_escola')
    } catch {}
    if (!allowed) {
      try {
        const { data: adminLink } = await s.from('escola_administradores').select('user_id').eq('escola_id', escolaId).eq('user_id', user.id).limit(1)
        allowed = Boolean(adminLink && (adminLink as any[]).length > 0)
      } catch {}
    }
    if (!allowed) {
      try {
        const { data: prof } = await s.from('profiles').select('role, escola_id').eq('user_id', user.id).eq('escola_id', escolaId).limit(1)
        allowed = Boolean(prof && prof.length > 0 && (prof[0] as any).role === 'admin')
      } catch {}
    }
    if (!allowed) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Configuração Supabase ausente.' }, { status: 500 })
    }
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Busca o período e garante que pertence à escola
    const { data: row, error: rowErr } = await (admin as any)
      .from('semestres')
      .select('id, nome, data_inicio, data_fim, session_id, escola_id, tipo')
      .eq('id', id)
      .maybeSingle()
    if (rowErr) return NextResponse.json({ ok: false, error: rowErr.message }, { status: 400 })
    if (!row) return NextResponse.json({ ok: false, error: 'Período não encontrado' }, { status: 404 })
    if (String(row.escola_id) !== String(escolaId)) return NextResponse.json({ ok: false, error: 'Período não pertence a esta escola.' }, { status: 403 })

    // Valida datas com base na sessão
    const { data: sess, error: sessErr } = await (admin as any)
      .from('school_sessions')
      .select('id, data_inicio, data_fim')
      .eq('id', row.session_id)
      .maybeSingle()
    if (sessErr) return NextResponse.json({ ok: false, error: sessErr.message }, { status: 400 })
    if (!sess) return NextResponse.json({ ok: false, error: 'Sessão não encontrada' }, { status: 404 })

    const newStart = data_inicio ?? String(row.data_inicio)
    const newEnd = data_fim ?? String(row.data_fim)
    if (newStart > newEnd) return NextResponse.json({ ok: false, error: 'A data de início deve ser anterior à data de término.' }, { status: 400 })
    if (newStart < String(sess.data_inicio) || newEnd > String(sess.data_fim)) {
      return NextResponse.json({ ok: false, error: 'As datas do período devem estar dentro do intervalo da sessão acadêmica.' }, { status: 400 })
    }

    const newTipo: 'BIMESTRE'|'TRIMESTRE'|'SEMESTRE'|'ANUAL'|undefined = tipo as any
    if (newTipo === 'TRIMESTRE') {
      const start = new Date(newStart)
      const end = new Date(newEnd)
      const limit = new Date(start)
      limit.setMonth(limit.getMonth() + 3)
      if (end > limit) return NextResponse.json({ ok: false, error: 'Trimestre deve ter no máximo 3 meses.' }, { status: 400 })
    }

    // Atualiza
    const patch: any = {}
    if (typeof nome !== 'undefined') patch.nome = nome
    if (typeof data_inicio !== 'undefined') patch.data_inicio = data_inicio
    if (typeof data_fim !== 'undefined') patch.data_fim = data_fim
    if (typeof newTipo !== 'undefined') patch.tipo = newTipo

    let updated: any = null
    let updErr: any = null
    {
      const { data, error } = await (admin as any)
        .from('semestres')
        .update(patch)
        .eq('id', id)
        .select('id, nome, data_inicio, data_fim, session_id, tipo')
        .single()
      updated = data
      updErr = error
    }
    if (updErr && String(updErr.message || '').toLowerCase().includes('column') && String(updErr.message || '').includes('tipo')) {
      // Reenvia sem 'tipo'
      delete patch.tipo
      const { data, error } = await (admin as any)
        .from('semestres')
        .update(patch)
        .eq('id', id)
        .select('id, nome, data_inicio, data_fim, session_id')
        .single()
      updated = data
      updErr = error
      if (updated && newTipo) updated.tipo = newTipo
    }
    if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 })

    return NextResponse.json({ ok: true, data: updated })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

// DELETE /api/escolas/[id]/semestres?id=...
// Exclui um período, bloqueando quando houver dependências
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params
  try {
    const { searchParams } = new URL(req.url)
    const idFromQuery = searchParams.get('id')
    const body = await (async () => { try { return await req.json() } catch { return null } })()
    const id = idFromQuery || (body && typeof body.id === 'string' ? body.id : null)
    if (!id) return NextResponse.json({ ok: false, error: 'Parâmetro id é obrigatório.' }, { status: 400 })

    const s = await supabaseServer()
    const { data: auth } = await s.auth.getUser()
    const user = auth?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    // Autorização: precisa poder configurar escola
    let allowed = false
    try {
      const { data: prof } = await s.from('profiles').select('role').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1)
      const role = (prof?.[0] as any)?.role as string | undefined
      if (role === 'super_admin') allowed = true
    } catch {}
    try {
      const { data: vinc } = await s.from('escola_usuarios').select('papel').eq('escola_id', escolaId).eq('user_id', user.id).maybeSingle();
      const papel = (vinc as any)?.papel as string | undefined
      allowed = !!papel && hasPermission(papel as any, 'configurar_escola')
    } catch {}
    if (!allowed) {
      try {
        const { data: adminLink } = await s.from('escola_administradores').select('user_id').eq('escola_id', escolaId).eq('user_id', user.id).limit(1)
        allowed = Boolean(adminLink && (adminLink as any[]).length > 0)
      } catch {}
    }
    if (!allowed) {
      try {
        const { data: prof } = await s.from('profiles').select('role, escola_id').eq('user_id', user.id).eq('escola_id', escolaId).limit(1)
        allowed = Boolean(prof && prof.length > 0 && (prof[0] as any).role === 'admin')
      } catch {}
    }
    if (!allowed) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Configuração Supabase ausente.' }, { status: 500 })
    }
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Garante que o período pertence à escola
    const { data: row, error: rowErr } = await (admin as any)
      .from('semestres')
      .select('id, escola_id')
      .eq('id', id)
      .maybeSingle()
    if (rowErr) return NextResponse.json({ ok: false, error: rowErr.message }, { status: 400 })
    if (!row) return NextResponse.json({ ok: false, error: 'Período não encontrado' }, { status: 404 })
    if (String(row.escola_id) !== String(escolaId)) return NextResponse.json({ ok: false, error: 'Período não pertence a esta escola.' }, { status: 403 })

    // Verifica dependências básicos (cursos_oferta -> semestre_id)
    try {
      const { data: dep, error: depErr } = await (admin as any)
        .from('cursos_oferta')
        .select('id')
        .eq('semestre_id', id)
        .limit(1)
      if (depErr) {
        const code = (depErr as any)?.code as string | undefined
        const msg = (depErr as any)?.message as string | undefined
        const isMissing = code === '42P01' || (msg && /does not exist|relation .* does not exist/i.test(msg))
        if (!isMissing) return NextResponse.json({ ok: false, error: depErr.message }, { status: 400 })
      }
      if (dep && (dep as any[]).length > 0) {
        return NextResponse.json({ ok: false, error: 'Não é possível excluir: existem ofertas de curso vinculadas a este período.' }, { status: 409 })
      }
    } catch {}

    const { error: delErr } = await (admin as any)
      .from('semestres')
      .delete()
      .eq('id', id)
    if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
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

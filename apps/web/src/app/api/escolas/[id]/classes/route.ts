import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { canManageEscolaResources } from "../permissions";

// GET /api/escolas/[id]/classes
// Lista classes da escola (usa service role com autorização)
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;
  try {
    const s = await supabaseServer();
    const { data: auth } = await s.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Configuração Supabase ausente.' }, { status: 500 });
    }
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const allowed = await canManageEscolaResources(admin, escolaId, user.id);
    if (!allowed) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 });

    let rows: any[] = [];
    {
      const { data, error } = await (admin as any)
        .from('classes')
        .select('id, nome, descricao, ordem, nivel, curso_id') // Adicionei curso_id
        .eq('escola_id', escolaId)
        .order('ordem', { ascending: true });
      
      if (!error) rows = data || [];
      else {
        // Retry simples (opcional)
        const retry = await (admin as any)
          .from('classes')
          .select('id, nome, ordem')
          .eq('escola_id', escolaId)
          .order('ordem', { ascending: true });
        if (retry.error) return NextResponse.json({ ok: false, error: retry.error.message }, { status: 400 });
        rows = retry.data || [];
      }
    }

    const payload = rows.map((r: any) => ({
      id: r.id,
      nome: r.nome,
      descricao: r.descricao ?? undefined,
      ordem: r.ordem ?? 0,
      nivel: r.nivel ?? undefined,
      curso_id: r.curso_id ?? undefined,
    }));

    return NextResponse.json({ ok: true, data: payload });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// POST /api/escolas/[id]/classes
// Cria uma nova classe na escola (usa service role com autorização)
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;
  try {
    const s = await supabaseServer();
    const { data: auth } = await s.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Configuração Supabase ausente.' }, { status: 500 });
    }
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const allowed = await canManageEscolaResources(admin, escolaId, user.id);
    if (!allowed) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    
    // [SCHEMA] Adicionei curso_id pois é necessário para a unicidade
    const schema = z.object({
      nome: z.string().trim().min(1),
      nivel: z.string().trim().nullable().optional(),
      descricao: z.string().trim().nullable().optional(),
      curso_id: z.string().uuid().optional().nullable(), 
      ordem: z.number().optional(), // Opcional, se vier usamos, senão calculamos
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message || 'Dados inválidos';
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    // Calcula ordem apenas se não foi fornecida
    let ordem = parsed.data.ordem;
    if (ordem === undefined) {
      ordem = 1;
      try {
        const { data } = await (admin as any)
          .from('classes')
          .select('ordem')
          .eq('escola_id', escolaId)
          .order('ordem', { ascending: false })
          .limit(1);
        const top = (data || [])[0] as any;
        ordem = Number(top?.ordem || 0) + 1;
      } catch {}
    }

    const payload: any = {
      escola_id: escolaId,
      nome: parsed.data.nome,
      ordem,
      curso_id: parsed.data.curso_id || null // [IMPORTANTE] Passar o curso para o insert
    };
    if (parsed.data.nivel !== undefined) payload.nivel = parsed.data.nivel;
    if (parsed.data.descricao !== undefined) payload.descricao = parsed.data.descricao;

    const { data: ins, error } = await (admin as any)
      .from('classes')
      .insert(payload)
      .select('id, nome, nivel, descricao, ordem')
      .single();

    if (error) {
      // [BLINDAGEM] Tratamento de erro de chave duplicada
      if (error.code === '23505') {
        return NextResponse.json(
          { ok: false, error: `A classe "${parsed.data.nome}" já existe para este curso.` },
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

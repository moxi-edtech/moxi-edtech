import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { canManageEscolaResources } from "../permissions";
import { CURRICULUM_PRESETS_META, type CurriculumKey } from "@/lib/academico/curriculum-presets";

const CURRICULUM_CLASS_RANGES: Record<CurriculumKey, { min: number; max: number }> = {
  primario_base: { min: 1, max: 6 },
  primario_avancado: { min: 1, max: 6 },
  ciclo1: { min: 7, max: 9 },
  puniv_fisicas: { min: 10, max: 12 },
  puniv_economicas: { min: 10, max: 12 },
  puniv_humanas: { min: 10, max: 12 },
  puniv_artes: { min: 10, max: 12 },
  tecnico_informatica: { min: 10, max: 13 },
  tecnico_gestao: { min: 10, max: 13 },
  tecnico_construcao: { min: 10, max: 13 },
  tecnico_electricidade: { min: 10, max: 13 },
  tecnico_mecanica: { min: 10, max: 13 },
  tecnico_electronica: { min: 10, max: 13 },
  tecnico_petroleos: { min: 10, max: 13 },
  tecnico_base: { min: 10, max: 13 },
  saude_enfermagem: { min: 10, max: 13 },
  saude_farmacia_analises: { min: 10, max: 13 },
  magisterio_primario: { min: 10, max: 13 },
};

const parseClasseNumero = (nome: string) => {
  const match = nome.match(/\d{1,2}/);
  return match ? Number(match[0]) : null;
};

// GET /api/escolas/[id]/classes
// Lista classes da escola (usa service role com autorização)
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;
  try {
    const url = new URL(_req.url);
    const cursoId = url.searchParams.get('curso_id');
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
      let query = (admin as any)
        .from('classes')
        .select('id, nome, descricao, ordem, nivel, curso_id') // Adicionei curso_id
        .eq('escola_id', escolaId)
        .order('ordem', { ascending: true });

      if (cursoId) query = query.eq('curso_id', cursoId);

      const { data, error } = await query;
      
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
  } catch (e: any) {
    const rawMessage =
      e?.message || e?.error || (typeof e === 'string' ? e : null);
    const fallbackMessage = (() => {
      if (rawMessage) return rawMessage;
      try {
        return JSON.stringify(e);
      } catch {
        return 'Erro inesperado';
      }
    })();

    return NextResponse.json(
      {
        ok: false,
        error: fallbackMessage,
        details: e?.details ?? null,
        hint: e?.hint ?? null,
        code: e?.code ?? null,
      },
      { status: 500 }
    );
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
      curso_id: z.string().uuid(),
      ordem: z.number().optional(),
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
      curso_id: parsed.data.curso_id,
    };
    if (parsed.data.nivel !== undefined) payload.nivel = parsed.data.nivel;
    if (parsed.data.descricao !== undefined) payload.descricao = parsed.data.descricao;

    const { data: cursoInfo, error: cursoErr } = await (admin as any)
      .from("cursos")
      .select("id, curriculum_key, course_code")
      .eq("id", parsed.data.curso_id)
      .eq("escola_id", escolaId)
      .maybeSingle();

    if (cursoErr) {
      return NextResponse.json({ ok: false, error: cursoErr.message }, { status: 400 });
    }

    if (!cursoInfo) {
      return NextResponse.json({ ok: false, error: "Curso não encontrado para validar classe." }, { status: 404 });
    }

    if (cursoInfo.curriculum_key && (cursoInfo.curriculum_key in CURRICULUM_PRESETS_META)) {
      const classNum = parseClasseNumero(parsed.data.nome);
      if (!classNum) {
        return NextResponse.json(
          { ok: false, error: "Classe inválida para curso com currículo definido." },
          { status: 400 }
        );
      }
      const range = CURRICULUM_CLASS_RANGES[cursoInfo.curriculum_key as CurriculumKey];
      if (!range || classNum < range.min || classNum > range.max) {
        return NextResponse.json(
          { ok: false, error: `Classe fora do intervalo permitido (${range?.min}ª–${range?.max}ª).` },
          { status: 400 }
        );
      }
    }

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
  } catch (e: any) {
    const rawMessage =
      e?.message || e?.error || (typeof e === 'string' ? e : null);
    const fallbackMessage = (() => {
      if (rawMessage) return rawMessage;
      try {
        return JSON.stringify(e);
      } catch {
        return 'Erro inesperado';
      }
    })();

    return NextResponse.json(
      {
        ok: false,
        error: fallbackMessage,
        details: e?.details ?? null,
        hint: e?.hint ?? null,
        code: e?.code ?? null,
      },
      { status: 500 }
    );
  }
}

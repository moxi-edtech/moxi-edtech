import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { hasPermission } from "@/lib/permissions";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

function hasOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
  return start1 <= end2 && start2 <= end1;
}

const maxByTipo: Record<string, number> = {
  TRIMESTRE: 3,
  BIMESTRE: 6,
  SEMESTRE: 2,
  ANUAL: 1,
};

async function ensureAuth(escolaId: string) {
  const s = await supabaseServer();
  const { data: auth } = await s.auth.getUser();
  const user = auth?.user;
  if (!user) return { ok: false as const, status: 401 as const, error: 'Não autenticado' };

  let allowed = false;
  try {
    const { data: prof } = await s.from('profiles').select('role').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1);
    const role = (prof?.[0] as any)?.role as string | undefined;
    if (role === 'super_admin') allowed = true;
  } catch {}
  if (!allowed) {
    try {
      const { data: vinc } = await s.from('escola_usuarios').select('papel').eq('escola_id', escolaId).eq('user_id', user.id).maybeSingle();
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
  if (!allowed) return { ok: false as const, status: 403 as const, error: 'Sem permissão' };

  return { ok: true as const };
}

function getAdminClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false as const, error: 'Configuração Supabase ausente.' };
  }
  const admin = createAdminClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return { ok: true as const, admin };
}

// PUT /api/escolas/[id]/semestres/[semestreId]
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string; semestreId: string }> }
) {
  const { id: escolaId, semestreId } = await context.params;
  try {
    const auth = await ensureAuth(escolaId);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const { ok, admin, error } = getAdminClient() as any;
    if (!ok) return NextResponse.json({ ok: false, error }, { status: 500 });

    // Fetch existente
    const { data: current, error: selErr } = await (admin as any)
      .from('semestres')
      .select('id, escola_id, session_id, nome, data_inicio, data_fim, tipo')
      .eq('id', semestreId)
      .maybeSingle();
    if (selErr) return NextResponse.json({ ok: false, error: selErr.message }, { status: 400 });
    if (!current || (current as any).escola_id !== escolaId) return NextResponse.json({ ok: false, error: 'Período não encontrado' }, { status: 404 });

    // Payload parcial
    const schema = z.object({
      nome: z.string().optional(),
      data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      tipo: z.enum(['TRIMESTRE','BIMESTRE','SEMESTRE','ANUAL']).optional(),
    });
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message || 'Dados inválidos';
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    const patch = parsed.data as Partial<{ nome: string; data_inicio: string; data_fim: string; tipo: string }>;

    // Datas calculadas
    const newStart = new Date(patch.data_inicio || (current as any).data_inicio);
    const newEnd = new Date(patch.data_fim || (current as any).data_fim);
    if (Number.isNaN(newStart.getTime()) || Number.isNaN(newEnd.getTime())) {
      return NextResponse.json({ ok: false, error: 'Datas inválidas' }, { status: 400 });
    }
    if (newEnd < newStart) return NextResponse.json({ ok: false, error: 'data_fim deve ser após data_inicio' }, { status: 400 });

    // Verifica sessão e limites
    const { data: sess, error: sErr } = await (admin as any)
      .from('school_sessions')
      .select('id, escola_id, data_inicio, data_fim')
      .eq('id', (current as any).session_id)
      .maybeSingle();
    if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 400 });
    if (!sess || (sess as any).escola_id !== escolaId) return NextResponse.json({ ok: false, error: 'Sessão inválida para esta escola' }, { status: 404 });

    const sessionStart = new Date(String((sess as any).data_inicio));
    const sessionEnd = new Date(String((sess as any).data_fim));
    if (newStart < sessionStart || newEnd > sessionEnd) return NextResponse.json({ ok: false, error: 'Período fora do intervalo da sessão' }, { status: 400 });

    const effectiveTipo = (patch.tipo || (current as any).tipo || '').toUpperCase();
    if (effectiveTipo && !maxByTipo[effectiveTipo]) return NextResponse.json({ ok: false, error: 'Tipo inválido' }, { status: 400 });

    // Periodos existentes (exceto o atual) para sobreposição e limite
    const { data: rows, error: listErr } = await (admin as any)
      .from('semestres')
      .select('id, nome, data_inicio, data_fim, tipo')
      .eq('session_id', (current as any).session_id)
      .neq('id', semestreId);
    if (listErr) return NextResponse.json({ ok: false, error: listErr.message }, { status: 400 });
    const existing = (rows || []) as Array<{ id: string; nome: string; data_inicio: string; data_fim: string; tipo?: string }>;

    for (const r of existing) {
      const exStart = new Date(r.data_inicio);
      const exEnd = new Date(r.data_fim);
      if (hasOverlap(newStart, newEnd, exStart, exEnd)) {
        return NextResponse.json({ ok: false, error: `As datas sobrepõem-se ao período existente "${r.nome}" (${r.data_inicio} a ${r.data_fim}).` }, { status: 400 });
      }
    }

    if (effectiveTipo) {
      const sameTypeCount = existing.filter((r) => String((r.tipo || '').toUpperCase()) === effectiveTipo).length;
      const maxAllowed = maxByTipo[effectiveTipo] ?? Infinity;
      if (sameTypeCount >= maxAllowed) {
        return NextResponse.json({ ok: false, error: `Limite máximo de ${effectiveTipo.toLowerCase()}s atingido (${maxAllowed}).` }, { status: 400 });
      }
    }

    // Nome: se fornecido vazio ou igual ao tipo, gera; se omitido, mantém o atual
    let finalNome = patch.nome;
    if (finalNome !== undefined) {
      if (!finalNome || finalNome.trim().toUpperCase() === effectiveTipo) {
        const existingCount = existing.length + 1; // incluindo o atual
        const label = effectiveTipo.charAt(0) + effectiveTipo.slice(1).toLowerCase();
        finalNome = `${existingCount}º ${label}`;
      }
    }

    const updateData: any = {};
    if (finalNome !== undefined) updateData.nome = finalNome;
    if (patch.data_inicio) updateData.data_inicio = patch.data_inicio;
    if (patch.data_fim) updateData.data_fim = patch.data_fim;
    if (patch.tipo) updateData.tipo = effectiveTipo;

    if (Object.keys(updateData).length === 0) return NextResponse.json({ ok: true, updated: 0 });

    let updErr: any = null;
    {
      const { error } = await (admin as any).from('semestres').update(updateData).eq('id', semestreId);
      updErr = error;
    }
    if (updErr && updateData.tipo) {
      // Retenta sem 'tipo' caso coluna inexistente
      const { tipo: _t, ...withoutTipo } = updateData;
      const { error: retryErr } = await (admin as any).from('semestres').update(withoutTipo).eq('id', semestreId);
      updErr = retryErr;
    }
    if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 });

    return NextResponse.json({ ok: true, updated: 1 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// DELETE /api/escolas/[id]/semestres/[semestreId]
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; semestreId: string }> }
) {
  const { id: escolaId, semestreId } = await context.params;
  try {
    const auth = await ensureAuth(escolaId);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const { ok, admin, error } = getAdminClient() as any;
    if (!ok) return NextResponse.json({ ok: false, error }, { status: 500 });

    // Verifica existência e pertencimento
    const { data: current, error: selErr } = await (admin as any)
      .from('semestres')
      .select('id, escola_id')
      .eq('id', semestreId)
      .maybeSingle();
    if (selErr) return NextResponse.json({ ok: false, error: selErr.message }, { status: 400 });
    if (!current || (current as any).escola_id !== escolaId) return NextResponse.json({ ok: false, error: 'Período não encontrado' }, { status: 404 });

    const { error: delErr } = await (admin as any).from('semestres').delete().eq('id', semestreId).eq('escola_id', escolaId);
    if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 400 });

    return NextResponse.json({ ok: true, deleted: 1 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}


import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeDisciplinaManage } from "@/lib/escola/disciplinas";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

async function authorize(escolaId: string) {
  const supabase = await createRouteClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return { ok: false as const, status: 401, error: "Não autenticado" };

  const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, escolaId);
  if (!userEscolaId || userEscolaId !== escolaId) {
    return { ok: false as const, status: 403, error: "Sem permissão" };
  }

  const authz = await authorizeDisciplinaManage(supabase as any, escolaId, user.id);
  if (!authz.allowed) return { ok: false as const, status: 403, error: authz.reason || 'Sem permissão' };
  return { ok: true as const, supabase };
}

// PUT /api/escolas/[id]/disciplinas/[disciplinaId]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; disciplinaId: string }> }
) {
  const { id: escolaId, disciplinaId } = await params;
  const authz = await authorize(escolaId);
  if (!authz.ok) return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status });
  const { supabase } = authz;

  try {
    const raw = await req.json();
    const schema = z.object({
      nome: z.string().trim().min(1).optional(),
      tipo: z.enum(['core','eletivo']).optional(),
      curso_id: z.string().uuid().nullable().optional(),
      classe_id: z.string().uuid().nullable().optional(),
      descricao: z.string().trim().nullable().optional(),
    });
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message || 'Dados inválidos';
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    const updates = parsed.data as any;
    const { data, error } = await (supabase as any)
      .from('disciplinas')
      .update(updates)
      .eq('id', disciplinaId)
      .eq('escola_id', escolaId)
      .select('id, nome, tipo, curso_id, classe_id, descricao')
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// DELETE /api/escolas/[id]/disciplinas/[disciplinaId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; disciplinaId: string }> }
) {
  const { id: escolaId, disciplinaId } = await params;
  const authz = await authorize(escolaId);
  if (!authz.ok) return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status });
  const { supabase } = authz;

  try {
    const { error } = await (supabase as any)
      .from('disciplinas')
      .delete()
      .eq('id', disciplinaId)
      .eq('escola_id', escolaId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { hasPermission } from "@/lib/permissions";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

// POST /api/escolas/[id]/onboarding/session/[sessionId]/reassign
// Reassigns dependents (turmas, matriculas) from one session to another within the same escola.
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; sessionId: string }> }
) {
  const { id: escolaId, sessionId } = await context.params;

  try {
    const s = await supabaseServer();
    const { data: auth } = await s.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    // Authorization similar to other onboarding endpoints
    let allowed = false;
    try {
      const { data: vinc } = await s
        .from('escola_users')
        .select('papel')
        .eq('escola_id', escolaId)
        .eq('user_id', user.id)
        .maybeSingle();
      const papel = (vinc as any)?.papel as string | undefined;
      if (!allowed) allowed = !!papel && hasPermission(papel as any, 'configurar_escola');
    } catch {}
    if (!allowed) {
      try {
        const { data: adminLink } = await s
          .from('escola_administradores')
          .select('user_id')
          .eq('escola_id', escolaId)
          .eq('user_id', user.id)
          .limit(1);
        allowed = Boolean(adminLink && (adminLink as any[]).length > 0);
      } catch {}
    }
    if (!allowed) {
      try {
        const { data: prof } = await s
          .from('profiles')
          .select('role, escola_id')
          .eq('user_id', user.id)
          .eq('escola_id', escolaId)
          .limit(1);
        allowed = Boolean(prof && prof.length > 0 && (prof[0] as any).role === 'admin');
      } catch {}
    }
    if (!allowed) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 });

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Configuração Supabase ausente.' }, { status: 500 });
    }
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const body = await req.json().catch(() => ({}));
    const targetSessionId = String((body?.targetSessionId ?? '')).trim();
    if (!targetSessionId) {
      return NextResponse.json({ ok: false, error: 'Parâmetro targetSessionId é obrigatório' }, { status: 400 });
    }
    if (targetSessionId === sessionId) {
      return NextResponse.json({ ok: false, error: 'Sessão de destino deve ser diferente da sessão atual' }, { status: 400 });
    }

    // Validate current and target sessions belong to the escola
    const [fromRes, toRes] = await Promise.all([
      (admin as any).from('school_sessions').select('id, escola_id, status').eq('id', sessionId).limit(1),
      (admin as any).from('school_sessions').select('id, escola_id, status').eq('id', targetSessionId).limit(1),
    ]);
    const fromSess = Array.isArray(fromRes.data) ? fromRes.data[0] : undefined;
    const toSess = Array.isArray(toRes.data) ? toRes.data[0] : undefined;
    if (!fromSess || String(fromSess.escola_id) !== String(escolaId)) {
      return NextResponse.json({ ok: false, error: 'Sessão de origem não encontrada' }, { status: 404 });
    }
    if (!toSess || String(toSess.escola_id) !== String(escolaId)) {
      return NextResponse.json({ ok: false, error: 'Sessão de destino não encontrada' }, { status: 404 });
    }

    // Count current dependents to report
    const [turmasCountRes, matriculasCountRes] = await Promise.all([
      (admin as any).from('turmas').select('id', { count: 'exact', head: true }).eq('session_id', sessionId),
      (admin as any).from('matriculas').select('id', { count: 'exact', head: true }).eq('session_id', sessionId),
    ]);
    const before = {
      turmas: turmasCountRes?.count ?? 0,
      matriculas: matriculasCountRes?.count ?? 0,
    };

    // Reassign
    const updErrors: string[] = [];
    try { await (admin as any).from('turmas').update({ session_id: targetSessionId } as any).eq('session_id', sessionId).eq('escola_id', escolaId) } catch (e) { updErrors.push(e instanceof Error ? e.message : String(e)) }
    try { await (admin as any).from('matriculas').update({ session_id: targetSessionId } as any).eq('session_id', sessionId).eq('escola_id', escolaId) } catch (e) { updErrors.push(e instanceof Error ? e.message : String(e)) }
    if (updErrors.length) {
      return NextResponse.json({ ok: false, error: `Falha ao mover registros: ${updErrors.join(' | ')}` }, { status: 400 });
    }

    return NextResponse.json({ ok: true, data: { before, targetSessionId } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}


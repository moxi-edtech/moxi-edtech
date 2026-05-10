import { NextRequest, NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { hasPermission } from "@/lib/permissions";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { recordAuditServer } from "@/lib/audit";
import type { Database } from "~types/supabase";

function extractTargetSessionId(body: unknown) {
  if (!body || typeof body !== "object" || !("targetSessionId" in body)) return "";

  const value = (body as { targetSessionId?: unknown }).targetSessionId;
  return value == null ? "" : String(value).trim();
}

// POST /api/escolas/[id]/onboarding/session/[sessionId]/reassign
// Reassigns dependents (turmas, matriculas) from one session to another within the same escola.
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; sessionId: string }> }
) {
  const { id: escolaId, sessionId } = await context.params;

  try {
    const s = await supabaseServerTyped<Database>();
    const { data: auth } = await s.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    const resolvedEscolaId = await resolveEscolaIdForUser(s, user.id, escolaId);
    if (!resolvedEscolaId) {
      return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 });
    }

    // Authorization similar to other onboarding endpoints
    let allowed = false;
    try {
      const { data: vinc } = await s
        .from('escola_users')
        .select('papel')
        .eq('escola_id', resolvedEscolaId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!allowed) allowed = !!vinc?.papel && hasPermission(vinc.papel, 'configurar_escola');
    } catch {}
    if (!allowed) {
      try {
        const { data: adminLink } = await s
          .from('escola_administradores')
          .select('user_id')
          .eq('escola_id', resolvedEscolaId)
          .eq('user_id', user.id)
          .limit(1);
        allowed = Boolean(adminLink?.length);
      } catch {}
    }
    if (!allowed) {
      try {
        const { data: prof } = await s
          .from('profiles')
          .select('role, escola_id')
          .eq('user_id', user.id)
          .eq('escola_id', resolvedEscolaId)
          .limit(1);
        allowed = Boolean(prof?.some((profile) => profile.role === 'admin'));
      } catch {}
    }
    if (!allowed) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 });

    const body: unknown = await req.json().catch(() => ({}));
    const targetSessionId = extractTargetSessionId(body);
    if (!targetSessionId) {
      return NextResponse.json({ ok: false, error: 'Parâmetro targetSessionId é obrigatório' }, { status: 400 });
    }
    if (targetSessionId === sessionId) {
      return NextResponse.json({ ok: false, error: 'Sessão de destino deve ser diferente da sessão atual' }, { status: 400 });
    }

    // Validate current and target sessions belong to the escola
    const [fromRes, toRes] = await Promise.all([
      s
        .from('anos_letivos')
        .select('id, escola_id, ano')
        .eq('id', sessionId)
        .eq('escola_id', resolvedEscolaId)
        .maybeSingle(),
      s
        .from('anos_letivos')
        .select('id, escola_id, ano')
        .eq('id', targetSessionId)
        .eq('escola_id', resolvedEscolaId)
        .maybeSingle(),
    ]);
    if (fromRes.error) return NextResponse.json({ ok: false, error: fromRes.error.message }, { status: 400 });
    if (toRes.error) return NextResponse.json({ ok: false, error: toRes.error.message }, { status: 400 });

    const fromSess = fromRes.data;
    const toSess = toRes.data;
    if (!fromSess) {
      return NextResponse.json({ ok: false, error: 'Ano letivo de origem não encontrado' }, { status: 404 });
    }
    if (!toSess) {
      return NextResponse.json({ ok: false, error: 'Ano letivo de destino não encontrado' }, { status: 404 });
    }

    // Count current dependents to report
    const turmaSourceFilter = `session_id.eq.${sessionId},ano_letivo_id.eq.${sessionId}`;
    const matriculaSourceFilter = `session_id.eq.${sessionId},ano_letivo.eq.${fromSess.ano}`;
    const anoDestino = toSess.ano ?? null;

    const [turmasCountRes, matriculasCountRes] = await Promise.all([
      s
        .from('turmas')
        .select('id', { count: 'estimated', head: true })
        .eq('escola_id', resolvedEscolaId)
        .or(turmaSourceFilter),
      s
        .from('matriculas')
        .select('id', { count: 'estimated', head: true })
        .eq('escola_id', resolvedEscolaId)
        .or(matriculaSourceFilter),
    ]);
    const before = {
      turmas: turmasCountRes?.count ?? 0,
      matriculas: matriculasCountRes?.count ?? 0,
    };

    // Reassign
    const updErrors: string[] = [];

    // Update Turmas (priority session_id, fallback ano_letivo)
    try {
      const turmaUpdate: Database["public"]["Tables"]["turmas"]["Update"] = {
        session_id: targetSessionId,
        ano_letivo_id: targetSessionId,
        ano_letivo: anoDestino,
      };
      const { error } = await s.from('turmas')
        .update(turmaUpdate)
        .eq('escola_id', resolvedEscolaId)
        .or(turmaSourceFilter);
      if (error) updErrors.push(error.message);
    } catch (e) { updErrors.push(e instanceof Error ? e.message : String(e)) }

    // Update Matriculas (session_id is canonical)
    try {
      const matriculaUpdate: Database["public"]["Tables"]["matriculas"]["Update"] = {
        session_id: targetSessionId,
        ano_letivo: anoDestino,
      };
      const { error } = await s.from('matriculas')
        .update(matriculaUpdate)
        .eq('escola_id', resolvedEscolaId)
        .or(matriculaSourceFilter);
      if (error) updErrors.push(error.message);
    } catch (e) { updErrors.push(e instanceof Error ? e.message : String(e)) }
    if (updErrors.length) {
      return NextResponse.json({ ok: false, error: `Falha ao mover registros: ${updErrors.join(' | ')}` }, { status: 400 });
    }

    recordAuditServer({
      escolaId: resolvedEscolaId,
      portal: 'admin_escola',
      acao: 'ANO_LETIVO_REASSOCIADO',
      entity: 'anos_letivos',
      entityId: sessionId,
      details: { targetSessionId, before },
    }).catch(() => null)

    return NextResponse.json({ ok: true, data: { before, targetSessionId } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

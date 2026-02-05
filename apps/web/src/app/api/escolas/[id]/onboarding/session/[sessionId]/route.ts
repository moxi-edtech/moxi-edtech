import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { hasPermission } from "@/lib/permissions";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { recordAuditServer } from "@/lib/audit";

// DELETE /api/escolas/[id]/onboarding/session/[sessionId]
// Deletes an archived school session for the given escola.
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; sessionId: string }> }
) {
  const { id: escolaId, sessionId } = await context.params;

  try {
    const s = await supabaseServer();
    const { data: auth } = await s.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    const resolvedEscolaId = await resolveEscolaIdForUser(s as any, user.id, escolaId);
    if (!resolvedEscolaId || resolvedEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 });
    }

    // Authorization: allow escola admins or users with configurar_escola vínculo; also allow profiles-based admin link
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

    // Ensure the academic year exists, belongs to this escola, and is not active
    const { data: sess, error: selErr } = await (s as any)
      .from('anos_letivos')
      .select('id, escola_id, ativo, ano')
      .eq('id', sessionId)
      .limit(1);
    if (selErr) return NextResponse.json({ ok: false, error: selErr.message }, { status: 400 });

    const found = Array.isArray(sess) ? sess[0] : undefined;
    if (!found || String(found.escola_id) !== String(escolaId)) {
      return NextResponse.json({ ok: false, error: 'Ano letivo não encontrado' }, { status: 404 });
    }
    if (found.ativo) {
      return NextResponse.json({ ok: false, error: 'Não é possível deletar o ano letivo ativo' }, { status: 400 });
    }

    // Guard: block deletion if there are dependent records (unless force=1)
    const url = new URL(_req.url);
    const force = ['1','true','yes'].includes(String(url.searchParams.get('force') || '').toLowerCase());
    const anoLetivoNome = found.ano ? String(found.ano) : null;
    try {
      const [periodosRes, turmasRes, matriculasRes] = await Promise.all([
        (s as any)
          .from('periodos_letivos')
          .select('id', { count: 'exact', head: true })
          .eq('ano_letivo_id', sessionId),
        anoLetivoNome
          ? (s as any)
              .from('turmas')
              .select('id', { count: 'exact', head: true })
              .eq('ano_letivo', anoLetivoNome)
          : Promise.resolve({ count: 0 }),
        (s as any)
          .from('matriculas')
          .select('id', { count: 'exact', head: true })
          .eq('ano_letivo_id', sessionId),
      ]);

      const periodosCount = periodosRes?.count ?? 0;
      const turmasCount = turmasRes?.count ?? 0;
      const matriculasCount = matriculasRes?.count ?? 0;

      if (!force && (periodosCount > 0 || turmasCount > 0 || matriculasCount > 0)) {
        const parts: string[] = [];
        if (periodosCount > 0) parts.push(`${periodosCount} período(s)`);
        if (turmasCount > 0) parts.push(`${turmasCount} turma(s)`);
        if (matriculasCount > 0) parts.push(`${matriculasCount} matrícula(s)`);
        const detalhes = parts.join(', ');
        return NextResponse.json({ ok: false, error: `Não é possível deletar este ano letivo pois existem registros vinculados: ${detalhes}. Exclua/mova-os ou use ?force=1 para forçar a exclusão (cascata).` }, { status: 400 });
      }

        if (force) {
          // Delete dependents: matriculas -> turmas -> periodos
          const depErrors: string[] = [];
        try { await (s as any).from('matriculas').delete().eq('ano_letivo_id', sessionId) } catch (e) { depErrors.push(e instanceof Error ? e.message : String(e)) }
        if (anoLetivoNome) {
          try { await (s as any).from('turmas').delete().eq('ano_letivo', anoLetivoNome) } catch (e) { depErrors.push(e instanceof Error ? e.message : String(e)) }
        }
        try { await (s as any).from('periodos_letivos').delete().eq('ano_letivo_id', sessionId) } catch (e) { depErrors.push(e instanceof Error ? e.message : String(e)) }
        if (depErrors.length) {
          return NextResponse.json({ ok: false, error: `Falha ao excluir dependências: ${depErrors.join(' | ')}` }, { status: 400 });
        }
      }
    } catch (depErr) {
      const msg = depErr instanceof Error ? depErr.message : 'Falha ao verificar dependências';
      return NextResponse.json({ ok: false, error: `Não foi possível verificar dependências antes da exclusão: ${msg}` }, { status: 500 });
    }

    // Attempt deletion (safe after dependency checks)
    const { error: delErr } = await (s as any)
      .from('anos_letivos')
      .delete()
      .eq('id', sessionId)
      .eq('escola_id', escolaId);
    if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 400 });

    recordAuditServer({
      escolaId,
      portal: 'admin_escola',
      acao: 'ANO_LETIVO_REMOVIDO',
      entity: 'anos_letivos',
      entityId: sessionId,
      details: { force },
    }).catch(() => null)

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

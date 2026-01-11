import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { authorizeTurmasManage } from "@/lib/escola/disciplinas";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { tryCanonicalFetch } from "@/lib/api/proxyCanonical";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const headers = new Headers();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    const url = new URL(req.url);
    const classeId = url.searchParams.get('classe_id');
    const turno = url.searchParams.get('turno');
    let anoLetivo = url.searchParams.get('ano_letivo');
    const sessionId = url.searchParams.get('session_id');

    if (!classeId || !turno) {
      return NextResponse.json({ ok: false, error: 'classe_id e turno são obrigatórios' }, { status: 400 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 });

    const forwarded = await tryCanonicalFetch(req, `/api/escolas/${escolaId}/turmas/sugestao-nome`);
    if (forwarded) return forwarded;

    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id);
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 });

    headers.set('Deprecation', 'true');
    headers.set('Link', `</api/escolas/${escolaId}/turmas>; rel="successor-version"`);

    // Se não mandaram ano_letivo, tenta derivar do session_id
    if (!anoLetivo && sessionId) {
      const { data: sess } = await supabase
        .from('school_sessions')
        .select('nome')
        .eq('id', sessionId)
        .maybeSingle();
      anoLetivo = (sess as any)?.nome || undefined;
    }

    let query = supabase
      .from('turmas')
      .select('nome')
      .eq('escola_id', escolaId)
      .eq('turno', turno)
      .eq('classe_id', classeId);

    if (anoLetivo) query = query.eq('ano_letivo', anoLetivo);
    if (sessionId) query = query.eq('session_id', sessionId);

    const { data: existing, error } = await query;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400, headers });

    const used = new Set<string>();
    (existing || []).forEach((t: any) => {
      const raw = (t?.nome || '').toString().trim().toUpperCase();
      if (!raw) return;
      const letterMatch = raw.match(/[A-Z]$/);
      const letter = letterMatch ? letterMatch[0] : raw.charAt(0);
      if (letter) used.add(letter);
    });

    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const suggestion = alphabet.find((l) => !used.has(l)) || 'Z';

    return NextResponse.json({ ok: true, suggested: suggestion, existing: Array.from(used) }, { headers });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

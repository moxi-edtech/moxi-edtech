import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";

// Lista alunos da escola do usuário logado (portal secretaria)
// Suporta paginação simples e filtro por texto.
// Response shape compatível com consumidores existentes:
// { ok: true, items: Array, total: number, page: number, pageSize: number }

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    // Resolve escola do perfil atual
    const { data: prof } = await supabase
      .from('profiles')
      .select('current_escola_id, escola_id, user_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);
    let escolaId = ((prof?.[0] as any)?.current_escola_id || (prof?.[0] as any)?.escola_id) as string | undefined;
    if (!escolaId) {
      try {
        const { data: vinc } = await supabase
          .from('escola_usuarios')
          .select('escola_id')
          .eq('user_id', user.id)
          .limit(1);
        escolaId = (vinc?.[0] as any)?.escola_id as string | undefined;
      } catch {}
    }
    if (!escolaId) return NextResponse.json({ ok: true, items: [], total: 0, page: 1, pageSize: 20 });

    const url = new URL(req.url);
    const q = url.searchParams.get('q')?.trim() || '';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10) || 20));
    const offset = (page - 1) * pageSize;

    let query = supabase
      .from('alunos')
      .select('id, nome, email, created_at, profiles(numero_login)', { count: 'exact' })
      .eq('escola_id', escolaId)
      .order('created_at', { ascending: false });

    if (q) {
      // Busca simples por nome/email/UUID
      const uuidRe = /^[0-9a-fA-F-]{36}$/;
      if (uuidRe.test(q)) {
        query = query.or(`id.eq.${q}`);
      } else {
        // ilike em nome ou email
        query = query.or(`nome.ilike.%${q}%,email.ilike.%${q}%`);
      }
    }

    const { data, error, count } = await query.range(offset, offset + pageSize - 1);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, items: data || [], total: count ?? 0, page, pageSize });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

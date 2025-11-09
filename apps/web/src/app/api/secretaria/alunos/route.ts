import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get('q')?.trim() || '';
    const days = url.searchParams.get('days') || '30';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10) || 20));
    const offset = (page - 1) * pageSize;

    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    const { data: prof } = await supabase
      .from('profiles')
      .select('escola_id')
      .order('created_at', { ascending: false })
      .limit(1);
    const escolaId = (prof?.[0] as any)?.escola_id as string | undefined;
    if (!escolaId) return NextResponse.json({ ok: true, items: [], total: 0, page, pageSize });

    const since = (() => {
      const d = parseInt(days || '30', 10);
      if (!Number.isFinite(d) || d <= 0) return '1970-01-01';
      const dt = new Date(); dt.setDate(dt.getDate() - d); return dt.toISOString();
    })();

    let query = supabase
      .from('alunos')
      .select('id, nome, email, created_at', { count: 'exact' })
      .eq('escola_id', escolaId)
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    if (q) {
      const uuidRe = /^[0-9a-fA-F-]{36}$/;
      if (uuidRe.test(q)) {
        query = query.or(`id.eq.${q}`);
      } else {
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


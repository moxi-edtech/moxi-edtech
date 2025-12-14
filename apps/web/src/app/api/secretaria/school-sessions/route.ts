import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const url = new URL(req.url);
    const qsEscolaId = url.searchParams.get('escola_id') || undefined;
    const alunoId = url.searchParams.get('aluno_id') || undefined;
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    // Resolve escola do usuário: profiles.current_escola_id -> profiles.escola_id -> escola_users.escola_id
    let escolaId = qsEscolaId as string | undefined;
    if (!escolaId && alunoId) {
      try {
        const { data: aluno } = await supabase
          .from('alunos')
          .select('escola_id')
          .eq('id', alunoId)
          .maybeSingle();
        escolaId = (aluno as any)?.escola_id as string | undefined;
      } catch {}
    }
    if (!escolaId) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('current_escola_id, escola_id, user_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      escolaId = ((prof?.[0] as any)?.current_escola_id || (prof?.[0] as any)?.escola_id) as string | undefined;
      if (!escolaId) {
        try {
          const { data: vinc } = await supabase
            .from('escola_users')
            .select('escola_id')
            .eq('user_id', user.id)
            .limit(1);
          escolaId = (vinc?.[0] as any)?.escola_id as string | undefined;
        } catch {}
      }
    }
    if (!escolaId) return NextResponse.json({ ok: true, items: [] });

    // Verificar vínculo do usuário com a escola
    const { data: vincUser } = await supabase
      .from('escola_users')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('escola_id', escolaId)
      .limit(1);
    if (!vincUser || vincUser.length === 0) {
      return NextResponse.json({ ok: false, error: 'Sem vínculo com a escola' }, { status: 403 });
    }

    // Usar service role para leitura confiável (evita políticas RLS ausentes/divergentes)
    const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const computeAno = (row: any): string | null => {
      const name = String(row?.nome ?? '').trim();
      const matches = name.match(/\b(19|20)\d{2}\s*[\/-]\s*(19|20)\d{2}\b/);
      if (matches && matches[0]) return matches[0];
      const yearOnly = name.match(/\b(19|20)\d{2}\b/);
      if (yearOnly && yearOnly[0]) return yearOnly[0];
      const si = row?.data_inicio ? new Date(row.data_inicio) : null;
      const sf = row?.data_fim ? new Date(row.data_fim) : null;
      if (si && !isNaN(si.getTime()) && sf && !isNaN(sf.getTime())) {
        return `${si.getFullYear()}/${sf.getFullYear()}`;
      }
      if (si && !isNaN(si.getTime())) {
        const a = si.getFullYear();
        return `${a}/${a + 1}`;
      }
      return null;
    };

    if (!adminUrl || !serviceRole) {
      const { data, error } = await supabase
        .from('school_sessions')
        .select('id, nome, data_inicio, data_fim, status')
        .eq('escola_id', escolaId)
        .order('data_inicio', { ascending: false });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      const items = (data || []).map((row: any) => ({
        id: row.id,
        nome: row.nome,
        data_inicio: row.data_inicio,
        data_fim: row.data_fim,
        status: row.status,
        ano: computeAno(row),
        ano_letivo: computeAno(row),
      }));
      return NextResponse.json({ ok: true, items });
    }

    const admin = createAdminClient<Database>(adminUrl, serviceRole);
    const { data, error } = await (admin as any)
      .from('school_sessions')
      .select('id, nome, data_inicio, data_fim, status')
      .eq('escola_id', escolaId)
      .order('data_inicio', { ascending: false });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    const items = (data || []).map((row: any) => ({
      id: row.id,
      nome: row.nome,
      data_inicio: row.data_inicio,
      data_fim: row.data_fim,
      status: row.status,
      ano: computeAno(row),
      ano_letivo: computeAno(row),
    }));
    return NextResponse.json({ ok: true, items });

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

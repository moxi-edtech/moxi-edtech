import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { createHash } from "crypto";

// Retorna uma sugestão de número de matrícula sem consumir a sequência real.
// Estratégia: usa o mesmo prefixo do trigger (SUBSTRING(MD5(escola_id) FOR 3))
// e calcula o próximo sufixo com base no maior numero_matricula existente para o prefixo da escola.
export async function GET() {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    // Resolve escola do usuário logado
    const { data: prof } = await supabase
      .from('profiles')
      .select('escola_id')
      .eq('user_id', user.id)
      .maybeSingle();
    const escolaId = (prof as any)?.escola_id as string | undefined;
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Perfil não vinculado à escola' }, { status: 403 });

    // Prefixo conforme trigger: SUBSTRING(MD5(escola_id::text) FOR 3)
    const prefix = createHash('md5').update(String(escolaId)).digest('hex').slice(0, 3);

    // Busca maior numero_matricula desse prefixo na escola
    const { data: last, error } = await supabase
      .from('matriculas')
      .select('numero_matricula')
      .eq('escola_id', escolaId)
      .like('numero_matricula', `${prefix}-%`)
      .order('numero_matricula', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    let nextSuffix = 1;
    if (last?.numero_matricula) {
      const parts = String(last.numero_matricula).split('-');
      const suffix = parseInt(parts[1] || '0', 10);
      if (Number.isFinite(suffix)) nextSuffix = suffix + 1;
    }

    const numero = `${prefix}-${String(nextSuffix).padStart(6, '0')}`;
    return NextResponse.json({ ok: true, numero });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}


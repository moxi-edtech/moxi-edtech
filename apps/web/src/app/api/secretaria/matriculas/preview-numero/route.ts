import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { generateNumeroLogin } from "@/lib/generateNumeroLogin";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

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

    // Usa a mesma função de geração que a criação efetiva
    let numero: string | null = null;
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const admin = createAdminClient<Database>(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        numero = await generateNumeroLogin(escolaId, 'aluno' as any, admin as any);
      } else {
        numero = await generateNumeroLogin(escolaId, 'aluno' as any, supabase as any);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, numero });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

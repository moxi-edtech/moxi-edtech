import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

export const dynamic = 'force-dynamic';

async function resolveEscolaId(client: any, userId: string): Promise<string | null> {
  try {
    const { data: prof } = await client
      .from('profiles')
      .select('current_escola_id, escola_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);
    const perfil = prof?.[0] as any;
    if (perfil?.current_escola_id) return perfil.current_escola_id;
    if (perfil?.escola_id) return perfil.escola_id;
  } catch {}

  try {
    const { data: vinc } = await client.from('escola_users').select('escola_id').eq('user_id', userId).limit(1);
    const escolaId = (vinc?.[0] as any)?.escola_id as string | undefined;
    if (escolaId) return escolaId;
  } catch {}

  return null;
}

export async function GET() {
  try {
    const s = await supabaseServer();
    const { data: auth } = await s.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaId(s as any, user.id);
    if (!escolaId) return NextResponse.json({ ok: true, items: [] });
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Configuração Supabase ausente." }, { status: 500 });
    }
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Catálogo de classes para mapear nomes → IDs existentes
    const { data: classesCatalog } = await (admin as any)
      .from('classes')
      .select('id, nome')
      .eq('escola_id', escolaId);
    const classByName = new Map<string, { id: string; nome: string }>();
    const normalizeClassName = (value: string) => value.trim().toLowerCase();
    for (const cls of (classesCatalog || []) as Array<{ id: string; nome: string }>) {
      if (cls?.nome) classByName.set(normalizeClassName(cls.nome), { id: cls.id, nome: cls.nome });
    }

    // Configurações curriculares salvas (contêm lista de classes escolhidas)
    const { data: configs } = await (admin as any)
      .from('configuracoes_curriculo')
      .select('curso_id, config')
      .eq('escola_id', escolaId);
    const configByCourse = new Map<string, any>();
    for (const cfg of (configs || []) as Array<{ curso_id: string; config: any }>) {
      if (cfg?.curso_id) configByCourse.set(cfg.curso_id, cfg.config);
    }

    // 1) Buscar cursos da escola
    const { data: cursos, error: cursosErr } = await (admin as any)
      .from('cursos')
      .select('id, nome, codigo, tipo')
      .eq('escola_id', escolaId)
      .order('nome', { ascending: true });
    if (cursosErr) return NextResponse.json({ ok: false, error: cursosErr.message }, { status: 400 });

    // 2) Para cada curso, adicionar as classes
    const coursesWithClasses = (cursos || []).map((curso: any) => {
        const classMap = new Map<string, { id: string; nome: string }>();

        // Classes escolhidas na configuração curricular
        const cfg = configByCourse.get(curso.id);
        const cfgClasses = Array.isArray(cfg?.classes)
          ? (cfg.classes as any[]).map((c) => (typeof c === 'string' ? c : '')).filter(Boolean)
          : [];
        for (const clsName of cfgClasses) {
          const normalized = normalizeClassName(clsName);
          const match = classByName.get(normalized);
          classMap.set(normalized, match || { id: `cfg-${normalized}`, nome: clsName });
        }
        
        const classes = Array.from(classMap.values());

        return {
          ...curso,
          classes,
        };
      });

    return NextResponse.json({ ok: true, items: coursesWithClasses });
  } catch (error: any) {
    console.error('Erro API Cursos com Classes:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Erro interno' }, { status: 500 });
  }
}

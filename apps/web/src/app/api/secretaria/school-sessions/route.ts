import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/escola/disciplinas"; 

export const dynamic = 'force-dynamic';

function deriveAnoLetivo(valor?: string | number | null) {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor;
  const texto = String(valor);
  const matches = Array.from(texto.matchAll(/(19|20)\d{2}/g)).map((m) => Number(m[0]));
  if (matches.length === 0) return null;
  return Math.max(...matches);
}

function inferirAnoLetivo(session: any) {
  const candidatos = [session?.ano_letivo, session?.nome, session?.data_inicio, session?.data_fim];
  for (const candidato of candidatos) {
    const ano = deriveAnoLetivo(candidato);
    if (ano) return ano;
  }
  return new Date().getFullYear();
}

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped();
    
    // 1. Auth Check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    // 2. Escola ID
    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 });

    // 3. Source of truth: anos_letivos
    const mapAnosLetivos = (rows: any[]) =>
      (rows || []).map((s: any) => {
        const anoNumber = typeof s.ano === 'string' ? Number(s.ano) : s.ano;
        const ano = Number.isFinite(anoNumber) ? anoNumber : inferirAnoLetivo(s);
        const nome = Number.isFinite(ano)
          ? `${ano}/${Number(ano) + 1}`
          : s.nome ?? String(s.ano ?? '');

        return {
          id: s.id,
          nome,
          status: s.ativo ? 'ativa' : 'arquivada',
          data_inicio: s.data_inicio,
          data_fim: s.data_fim,
          ano_letivo: ano ?? inferirAnoLetivo({ ...s, nome }),
        };
      });

    // Única fonte: anos_letivos
    const { data: anoLetivoData, error: anoLetivoError } = await (supabase as any)
      .from('anos_letivos')
      .select('id, ano, data_inicio, data_fim, ativo')
      .eq('escola_id', escolaId)
      .order('ano', { ascending: false });

    if (!anoLetivoError) {
      const items = mapAnosLetivos(anoLetivoData || []);
      return NextResponse.json({ ok: true, data: items });
    }

    console.error("Erro SQL anos_letivos:", anoLetivoError);
    throw anoLetivoError;

  } catch (e: any) {
    console.error("Erro API Sessions:", e);
    return NextResponse.json({ ok: false, error: e.message || "Erro interno" }, { status: 500 });
  }
}

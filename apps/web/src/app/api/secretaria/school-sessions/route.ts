import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { authorizeEscolaAction } from "@/lib/escola/disciplinas";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { applyKf2ListInvariants } from "@/lib/kf2";

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

    const { searchParams } = new URL(req.url);
    const escolaIdFromQuery = searchParams.get('escolaId') || searchParams.get('escola_id') || null;

    // 2. Escola ID
    const escolaId = await resolveEscolaIdForUser(supabase, user.id, escolaIdFromQuery);
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 });

    const authz = await authorizeEscolaAction(supabase as any, escolaId, user.id, []);
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 });

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
          escola_id: s.escola_id,
          ano_letivo: ano ?? inferirAnoLetivo({ ...s, nome }),
        };
      });

    // Única fonte: anos_letivos
    const fetchAnosLetivos = async (client: any) => {
      let query = client
        .from('anos_letivos')
        .select('id, ano, data_inicio, data_fim, ativo, escola_id')
        .eq('escola_id', escolaId)
        .order('ano', { ascending: false });

      query = applyKf2ListInvariants(query, { defaultLimit: 50 });
      return query;
    };

    const { data: anoLetivoData, error: anoLetivoError } = await fetchAnosLetivos(supabase as any);

    if (!anoLetivoError && (anoLetivoData?.length ?? 0) > 0) {
      const items = mapAnosLetivos(anoLetivoData || []);
      return NextResponse.json({ ok: true, data: items });
    }

    if (anoLetivoError) {
      console.error("Erro SQL anos_letivos:", anoLetivoError);
      throw anoLetivoError;
    }

    return NextResponse.json({ ok: true, data: [] });

  } catch (e: any) {
    console.error("Erro API Sessions:", e);
    return NextResponse.json({ ok: false, error: e.message || "Erro interno" }, { status: 500 });
  }
}

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

    // 3. Query Corrigida (Schema Real)
    // Removemos 'is_active' e focamos em 'status'
    const { data, error } = await supabase
      .from('school_sessions')
      .select('id, nome, status, data_inicio, data_fim')
      .eq('escola_id', escolaId)
      .order('data_inicio', { ascending: false });

    if (error) {
      console.error("Erro SQL Sessions:", error);
      throw error;
    }

    // 4. Formatação para o Frontend
    // O frontend espera que o campo 'status' seja 'ativa' para selecionar automaticamente
    const items = (data || []).map((s: any) => ({
      id: s.id,
      nome: s.nome,
      status: s.status, // Passamos o valor direto do banco ('ativa', 'encerrada', etc.)
      data_inicio: s.data_inicio,
      data_fim: s.data_fim,
      ano_letivo: inferirAnoLetivo(s),
    }));

    return NextResponse.json({ ok: true, data: items });

  } catch (e: any) {
    console.error("Erro API Sessions:", e);
    return NextResponse.json({ ok: false, error: e.message || "Erro interno" }, { status: 500 });
  }
}

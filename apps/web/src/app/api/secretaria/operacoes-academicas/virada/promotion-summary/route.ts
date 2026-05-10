// @kf2 allow-scan
// apps/web/src/app/api/secretaria/operacoes-academicas/virada/promotion-summary/route.ts
import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";

type MatriculaValidaRow = {
  aluno_id: string;
  aluno_nome: string | null;
  status: string | null;
  turma_nome: string | null;
  classe_nome: string | null;
};

type LedgerRow = {
  aluno_id: string | null;
  tipo: string | null;
  valor: number | string | null;
};

type StudentInfo = {
  id: string;
  nome: string;
  turma: string;
  classe: string;
  saldo: number;
};

export async function GET(request: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const url = new URL(request.url);
    const tolerance = Number(url.searchParams.get("tolerance") || 0);

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });

    // 1. Obter o ano ativo
    const { data: anoAtivo } = await supabase
      .from("anos_letivos")
      .select("id, ano")
      .eq("escola_id", escolaId)
      .eq("ativo", true)
      .maybeSingle();

    if (!anoAtivo) return NextResponse.json({ ok: false, error: "Nenhum ano letivo ativo." });

    // 2. Buscar Dados do Ledger e Matrículas (Simulação)
    const { data: alunos, error } = await supabase
      .from("vw_matriculas_validas")
      .select(`
        aluno_id,
        aluno_nome,
        status,
        turma_nome,
        classe_nome
      `)
      .eq("escola_id", escolaId)
      .eq("session_id", anoAtivo.id);

    if (error) throw error;

    // 3. Buscar Saldos do Ledger Consolidado
    const { data: saldos } = await supabase
      .from("financeiro_ledger")
      .select("aluno_id, tipo, valor")
      .eq("escola_id", escolaId);

    const saldoMap = new Map<string, number>();
    ((saldos ?? []) as LedgerRow[]).forEach((s) => {
        if (!s.aluno_id) return;
        const current = saldoMap.get(s.aluno_id) || 0;
        const amount = Number(s.valor);
        saldoMap.set(s.aluno_id, s.tipo === 'debito' ? current + amount : current - amount);
    });

    // 4. Categorizar com Detalhes
    const aptos: StudentInfo[] = [];
    const inadimplentes: StudentInfo[] = [];
    const retidos: StudentInfo[] = [];

    ((alunos ?? []) as MatriculaValidaRow[]).forEach((a) => {
        const saldo = saldoMap.get(a.aluno_id) || 0;
        const info = { 
            id: a.aluno_id, 
            nome: a.aluno_nome ?? "—", 
            turma: a.turma_nome ?? "—", 
            classe: a.classe_nome ?? "—",
            saldo: saldo
        };

        if (a.status === 'concluido' && saldo <= tolerance) {
            aptos.push(info);
        } else if (a.status === 'concluido' && saldo > tolerance) {
            inadimplentes.push(info);
        } else if (a.status === 'reprovado' || a.status === 'reprovado_por_faltas') {
            retidos.push(info);
        }
    });

    return NextResponse.json({
      ok: true,
      summary: {
        total: alunos?.length || 0,
        counts: {
            aptos: aptos.length,
            inadimplentes: inadimplentes.length,
            retidos: retidos.length
        },
        lists: {
            aptos: aptos.slice(0, 50), // Amostra para performance, UI pode pedir mais
            inadimplentes, // Inadimplentes enviamos todos para ação
            retidos
        }
      },
      ano_ativo: anoAtivo
    });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

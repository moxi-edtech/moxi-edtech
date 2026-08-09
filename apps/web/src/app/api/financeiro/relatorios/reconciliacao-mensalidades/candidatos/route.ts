import { NextResponse } from "next/server";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const escolaId = await resolveEscolaIdForUser(
      supabase,
      userRes.user.id,
      searchParams.get("escolaId") || searchParams.get("escola_id") || null,
    );
    const mensalidadeId = searchParams.get("mensalidade_id");
    if (!escolaId || !mensalidadeId) {
      return NextResponse.json({ ok: false, error: "Escola e mensalidade são obrigatórios" }, { status: 400 });
    }

    const { data: mensalidade, error: mensalidadeError } = await (supabase as any)
      .from("mensalidades")
      .select("id,aluno_id,ano_letivo,turma_id,ano_referencia,mes_referencia")
      .eq("id", mensalidadeId)
      .eq("escola_id", escolaId)
      .maybeSingle();
    if (mensalidadeError) throw mensalidadeError;
    if (!mensalidade) return NextResponse.json({ ok: false, error: "Mensalidade não encontrada" }, { status: 404 });

    const { data: matriculas, error: matriculasError } = await (supabase as any)
      .from("matriculas")
      .select("id,aluno_id,ano_letivo,session_id,turma_id,status,ativo,data_matricula")
      .eq("escola_id", escolaId)
      .eq("aluno_id", mensalidade.aluno_id)
      .order("ativo", { ascending: false })
      .order("ano_letivo", { ascending: false })
      .limit(50);
    if (matriculasError) throw matriculasError;

    const turmaIds = [...new Set((matriculas ?? []).map((row: any) => row.turma_id).filter(Boolean))];
    const { data: turmas } = turmaIds.length
      ? await (supabase as any).from("turmas").select("id,nome,turno").eq("escola_id", escolaId).in("id", turmaIds)
      : { data: [] };
    const turmaMap = new Map<string, { nome: string | null; turno: string | null }>(
      (turmas ?? []).map((row: any) => [
        row.id as string,
        { nome: row.nome ?? null, turno: row.turno ?? null },
      ] as const),
    );

    const year = /^\d{4}$/.test(String(mensalidade.ano_letivo ?? ""))
      ? Number(mensalidade.ano_letivo)
      : null;
    const candidates = (matriculas ?? [])
      .filter((row: any) => year === null || Number(row.ano_letivo) === year)
      .filter((row: any) => !mensalidade.turma_id || row.turma_id === mensalidade.turma_id)
      .map((row: any) => ({
        ...row,
        turma_nome: turmaMap.get(row.turma_id)?.nome ?? null,
        turno: turmaMap.get(row.turma_id)?.turno ?? null,
      }));

    return NextResponse.json({
      ok: true,
      mensalidade_id: mensalidadeId,
      candidates,
      ambiguous: candidates.length !== 1,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

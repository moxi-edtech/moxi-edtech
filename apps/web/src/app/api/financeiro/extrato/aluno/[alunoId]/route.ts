// @kf2 allow-scan
// apps/web/src/app/api/financeiro/extrato/aluno/[alunoId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/plan/requireFeature";
import { HttpError } from "@/lib/errors";
import { requireApiTenantGuard } from "@/lib/api/requireApiTenantGuard";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ alunoId: string }> }
) {
  try {
    const { alunoId } = await params;
    const guard = await requireApiTenantGuard({
      productContext: "k12",
      requireTenantType: "k12",
      allowedRoles: [
        "financeiro",
        "secretaria_financeiro",
        "admin_financeiro",
        "admin",
        "admin_escola",
        "staff_admin",
        "super_admin",
        "global_admin",
      ],
    });
    if (!guard.ok) return guard.response;

    const supabase = guard.supabase;
    const escolaId = guard.tenantId;

    try {
      await requireFeature("fin_extrato_completo");
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status: err.status });
      }
      throw err;
    }

    // 1. Buscar dados básicos do Aluno e sua Turma atual
    const { data: aluno, error: alunoError } = await (supabase as any)
      .from("alunos")
      .select(`
        id,
        nome_completo,
        bi_numero,
        telefone_responsavel,
        escola_id,
        matriculas (
          id,
          status,
          turma:turmas (
            nome,
            classe
          )
        )
      `)
      .eq("id", alunoId)
      .eq("escola_id", escolaId)
      .maybeSingle();

    if (alunoError || !aluno) {
      return NextResponse.json({ ok: false, error: "Aluno não encontrado ou sem permissão." }, { status: 404 });
    }

    // 2. Buscar Movimentos do Ledger (SSOT)
    const { data: movimentos, error: ledgerError } = await (supabase as any)
      .from("financeiro_ledger")
      .select("*")
      .eq("aluno_id", alunoId)
      .eq("escola_id", escolaId)
      .order("data_movimento", { ascending: false })
      .order("id", { ascending: false });

    if (ledgerError) {
      console.error("[EXTRATO-LEDGER] Erro ao buscar movimentos:", ledgerError);
      return NextResponse.json({ ok: false, error: "Falha ao carregar extrato financeiro." }, { status: 500 });
    }

    // 3. Calcular Saldo Consolidado e Totais
    let totalDebitos = 0;
    let totalCreditos = 0;

    const movimentosFormatados = (movimentos || []).map((mov: any) => {
      const valor = Number(mov.valor || 0);
      if (mov.tipo === "debito") totalDebitos += valor;
      if (mov.tipo === "credito") totalCreditos += valor;

      return {
        ...mov,
        valor: valor
      };
    });

    const saldoConsolidado = totalDebitos - totalCreditos;

    // 4. Normalizar Turma
    const matriculaAtiva = aluno.matriculas?.find((m: any) => m.status === "ativa") || aluno.matriculas?.[0];
    const turmaInfo = matriculaAtiva?.turma 
      ? `${(matriculaAtiva.turma as any).nome} (${(matriculaAtiva.turma as any).classe}ª Classe)` 
      : "Sem turma definida";

    return NextResponse.json({
      ok: true,
      aluno: {
        id: aluno.id,
        nome: aluno.nome_completo,
        bi: aluno.bi_numero,
        telefone: aluno.telefone_responsavel,
        turma: turmaInfo,
        escola_id: aluno.escola_id
      },
      resumo: {
        saldo_consolidado: saldoConsolidado,
        total_debitos: totalDebitos,
        total_creditos: totalCreditos,
        em_dia: saldoConsolidado <= 0
      },
      movimentos: movimentosFormatados,
      fonte: "financeiro_ledger (SSOT)"
    });

  } catch (error: any) {
    console.error("[EXTRATO-LEDGER] Erro crítico:", error);
    return NextResponse.json({
      ok: false,
      error: "Erro interno ao processar extrato."
    }, { status: 500 });
  }
}


import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { authorizeTurmasManage } from "@/lib/escola/disciplinas";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";
import { applyKf2ListInvariants } from "@/lib/kf2";

type AlunoTurmaRow = {
  matricula_id: string;
  aluno_id: string;
  numero_lista: number | null;
  status_matricula: string | null;

  aluno_nome: string | null;
  numero_processo_login: string | null;
  bi_numero: string | null;
  data_nascimento: string | null;
  naturalidade: string | null;
  provincia: string | null;

  telefone_aluno: string | null;
  email_aluno: string | null;

  responsavel_nome: string | null;
  responsavel_telefone: string | null;
  responsavel_relacao: string | null;
  pode_transitar?: boolean;
  pedagogico?: {
    status: "CONCLUIDA" | "REPROVADA" | "INCOMPLETA" | string;
  };
  financeiro?: {
    em_dia: boolean;
    saldo_pendente: number;
  };
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const headers = new Headers();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) return NextResponse.json({ ok: true, turmaId: null, total: 0, alunos: [] }, { headers });

    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id);
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 });

    headers.set('Deprecation', 'true');
    headers.set('Link', `</api/escolas/${escolaId}/turmas>; rel="successor-version"`);

    const { id: turmaId } = await params;

    let query = supabase
      .from("matriculas")
      .select(
        `
        id,
        turma_id,
        status,
        numero_lista,
        aluno_id,
        alunos (
          id,
          nome,
          profile_id,
          bi_numero,
          data_nascimento,
          naturalidade,
          provincia,
          telefone,
          email,
          responsavel,
          telefone_responsavel,
          encarregado_relacao,
          profiles:profiles!alunos_profile_id_fkey (
            user_id,
            numero_processo_login,
            nome
          )
        )
      `
      )
      .eq("turma_id", turmaId)
      .eq("escola_id", escolaId);
      
    query = applyKf2ListInvariants(query);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    const rows = (data ?? []) as any[];
    const matriculaIds = rows.map((mat) => mat.id).filter(Boolean);

    const mensalidadesMap = new Map<string, number>();
    if (matriculaIds.length > 0) {
      const { data: mensalidades, error: mensalidadesError } = await supabase
        .from("mensalidades")
        .select("matricula_id, status, valor_previsto, valor, valor_pago_total")
        .eq("escola_id", escolaId)
        .in("matricula_id", matriculaIds);

      if (mensalidadesError) {
        console.error("[turmas/alunos] mensalidades error", mensalidadesError);
      } else {
        for (const row of mensalidades ?? []) {
          const status = String((row as any).status || "").toLowerCase();
          if (["pago", "isento", "cancelado"].includes(status)) continue;
          const valorPrevisto = Number((row as any).valor_previsto ?? (row as any).valor ?? 0);
          const valorPago = Number((row as any).valor_pago_total ?? 0);
          const saldo = Math.max(valorPrevisto - valorPago, 0);
          if (!Number.isFinite(saldo) || saldo <= 0) continue;
          const matriculaId = (row as any).matricula_id as string;
          mensalidadesMap.set(matriculaId, (mensalidadesMap.get(matriculaId) ?? 0) + saldo);
        }
      }
    }

    const normalizePedagogicoStatus = (status: string | null | undefined) => {
      const normalized = String(status || "").trim().toLowerCase();
      if (["concluido", "concluida", "aprovado", "aprovada"].includes(normalized)) return "CONCLUIDA";
      if (["reprovado", "reprovada"].includes(normalized)) return "REPROVADA";
      return "INCOMPLETA";
    };

    const alunos: AlunoTurmaRow[] = rows.map((mat, index) => {
      const aluno = Array.isArray(mat.alunos) ? mat.alunos[0] : mat.alunos;
      const profile = aluno?.profiles
        ? Array.isArray(aluno.profiles)
          ? aluno.profiles[0]
          : aluno.profiles
        : null;

      const saldoPendente = mensalidadesMap.get(mat.id) ?? 0;
      const financeiroEmDia = saldoPendente <= 0;
      const pedagogicoStatus = normalizePedagogicoStatus(mat.status ?? null);
      const podeTransitar = financeiroEmDia && pedagogicoStatus === "CONCLUIDA";

      return {
        matricula_id: mat.id,
        aluno_id: aluno?.id ?? null,
        numero_lista: mat.numero_lista ?? index + 1,
        status_matricula: mat.status ?? null,

        aluno_nome: aluno?.nome ?? null,
        numero_processo_login: profile?.numero_processo_login ?? null,
        bi_numero: aluno?.bi_numero ?? null,
        data_nascimento: aluno?.data_nascimento ?? null,
        naturalidade: aluno?.naturalidade ?? null,
        provincia: aluno?.provincia ?? null,

        telefone_aluno: aluno?.telefone ?? null,
        email_aluno: aluno?.email ?? null,

        responsavel_nome: aluno?.responsavel ?? null,
        responsavel_telefone: aluno?.telefone_responsavel ?? null,
        responsavel_relacao: aluno?.encarregado_relacao ?? null,
        pode_transitar: podeTransitar,
        pedagogico: {
          status: pedagogicoStatus,
        },
        financeiro: {
          em_dia: financeiroEmDia,
          saldo_pendente: saldoPendente,
        },
      };
    });

    return NextResponse.json({
      ok: true,
      turmaId,
      total: alunos.length,
      alunos,
    }, { headers });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

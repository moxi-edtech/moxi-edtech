import { NextRequest, NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { authorizeMatriculasManage } from "@/lib/escola/disciplinas";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { applyKf2ListInvariants } from "@/lib/kf2";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const supabase = await supabaseServerTyped();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não encontrada para o usuário" }, { status: 400 });
    }

    const authz = await authorizeMatriculasManage(supabase as any, escolaId, user.id);
    if (!authz.allowed) {
      return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status") || undefined;
    const statusList = statusParam
      ? Array.from(new Set(statusParam.split(",").map((s) => s.trim()).filter(Boolean)))
      : [];
    const q = (searchParams.get("q") || "").trim().toLowerCase();

    let query = supabase
      .from("candidaturas")
      .select(
        `id, escola_id, aluno_id, curso_id, ano_letivo, status, created_at, turma_preferencial_id,
         dados_candidato, nome_candidato, classe_id, turno,
         alunos:aluno_id ( id, nome, nome_completo, numero_processo, bi_numero, email, telefone_responsavel, encarregado_email ),
         cursos:curso_id ( id, nome )`
      )
      .eq("escola_id", escolaId);
      
    query = applyKf2ListInvariants(query);

    if (statusList.length === 1) {
      query = query.eq("status", statusList[0]);
    } else if (statusList.length > 1) {
      query = query.in("status", statusList);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const items = (data || []).map((item) => {
      const alunoRaw = (item as any).alunos || {};
      const payload = (item as any).dados_candidato || {};
      const nome =
        alunoRaw.nome_completo ||
        alunoRaw.nome ||
        payload.nome_completo ||
        payload.nome ||
        (item as any).nome_candidato ||
        "";
      const numeroProcesso = alunoRaw.numero_processo || payload.numero_processo || null;

      return {
        ...item,
        alunos: {
          id: alunoRaw.id || payload.id || null,
          ...payload,
          ...alunoRaw,
          nome,
          nome_completo: nome,
          numero_processo: numeroProcesso,
          bi_numero: alunoRaw.bi_numero ?? payload.bi_numero ?? null,
        },
      } as any;
    });

    const filtered = items.filter((item) => {
      if (!q) return true;
      const aluno = (item as any).alunos || {};
      const nome = String(aluno.nome_completo || aluno.nome || "").toLowerCase();
      const proc = String(aluno.numero_processo || "").toLowerCase();
      return nome.includes(q) || proc.includes(q);
    });

    return NextResponse.json({ ok: true, items: filtered });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

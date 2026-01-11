import { NextRequest, NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { authorizeMatriculasManage } from "@/lib/escola/disciplinas";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { applyKf2ListInvariants } from "@/lib/kf2";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
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

    let query = supabase
      .from("candidaturas")
      .select(
        `id, escola_id, aluno_id, curso_id, ano_letivo, status, created_at, turma_preferencial_id,
         dados_candidato, nome_candidato, classe_id, turno,
         alunos:aluno_id ( id, nome, nome_completo, numero_processo, bi_numero, email, telefone_responsavel, encarregado_email ),
         cursos:curso_id ( id, nome )`
      )
      .eq("id", id)
      .eq("escola_id", escolaId)
      .order("created_at", { ascending: false })
      .limit(1);

    query = applyKf2ListInvariants(query, { defaultLimit: 1 });

    const { data, error } = await query.maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json({ ok: false, error: "Candidatura não encontrada" }, { status: 404 });
    }

    const alunoRaw = (data as any).alunos || {};
    const payload = (data as any).dados_candidato || {};
    const nome =
      alunoRaw.nome_completo ||
      alunoRaw.nome ||
      payload.nome_completo ||
      payload.nome ||
      (data as any).nome_candidato ||
      "";
    const numeroProcesso = alunoRaw.numero_processo || payload.numero_processo || null;

    const item = {
      ...data,
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

    return NextResponse.json({ ok: true, item });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
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

    let currentQuery = supabase
      .from("candidaturas")
      .select("id, escola_id, dados_candidato, nome_candidato")
      .eq("id", id)
      .eq("escola_id", escolaId)
      .order("created_at", { ascending: false })
      .limit(1);

    currentQuery = applyKf2ListInvariants(currentQuery, { defaultLimit: 1 });

    const { data: current, error: currentError } = await currentQuery.maybeSingle();

    if (currentError) {
      return NextResponse.json({ ok: false, error: currentError.message }, { status: 400 });
    }

    if (!current) {
      return NextResponse.json({ ok: false, error: "Candidatura não encontrada" }, { status: 404 });
    }

    const payload = {
      nome_completo: body.nome_completo ?? body.nome ?? undefined,
      nome: body.nome ?? body.nome_completo ?? undefined,
      email: body.email ?? undefined,
      telefone: body.telefone ?? undefined,
      endereco: body.endereco ?? undefined,
      data_nascimento: body.data_nascimento ?? undefined,
      sexo: body.sexo ?? undefined,
      bi_numero: body.bi_numero ?? undefined,
      nif: body.nif ?? undefined,
      responsavel_nome: body.responsavel_nome ?? undefined,
      responsavel_contato: body.responsavel_contato ?? undefined,
      encarregado_email: body.encarregado_email ?? undefined,
    } as Record<string, any>;

    const dadosBase = (current as any).dados_candidato || {};
    const dadosAtualizados = { ...dadosBase } as Record<string, any>;

    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined) dadosAtualizados[key] = value;
    });

    const nomeCandidato = payload.nome_completo || payload.nome || (current as any).nome_candidato || null;

    const { error: updateError } = await supabase
      .from("candidaturas")
      .update({
        nome_candidato: nomeCandidato,
        dados_candidato: dadosAtualizados,
      })
      .eq("id", id)
      .eq("escola_id", escolaId);

    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

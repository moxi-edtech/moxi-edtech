import { NextResponse } from "next/server";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { resolveRegimeAcademico } from "@/lib/academico/regime-academico";
import { supabaseServerTyped } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

async function getAuthenticatedContext() {
  const supabase = await supabaseServerTyped();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { supabase, user } = await getAuthenticatedContext();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const { id: turmaId } = await params;
    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 400 });

    const { data, error } = await (supabase as any)
      .from("turma_janelas_cobranca")
      .select("id, turma_id, ano_letivo_id, data_inicio, data_fim, motivo")
      .eq("escola_id", escolaId)
      .eq("turma_id", turmaId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ ok: true, data: data ?? null });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Erro ao carregar janela de cobrança" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { supabase, user } = await getAuthenticatedContext();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const { id: turmaId } = await params;
    const body = await request.json().catch(() => ({}));
    const dataInicio = String(body?.data_inicio || "").slice(0, 10);
    const dataFim = String(body?.data_fim || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(dataFim)) {
      return NextResponse.json({ ok: false, error: "Informe datas válidas para a janela de cobrança." }, { status: 400 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 400 });

    const { data: turma, error: turmaError } = await (supabase as any)
      .from("turmas")
      .select("id, is_classe_exame, ano_letivo_id")
      .eq("escola_id", escolaId)
      .eq("id", turmaId)
      .maybeSingle();
    if (turmaError) throw turmaError;
    if (!turma) return NextResponse.json({ ok: false, error: "Turma não encontrada." }, { status: 404 });

    const regime = await resolveRegimeAcademico(supabase, turmaId);
    if (!regime.eh_classe_exame) {
      return NextResponse.json({ ok: false, error: "A janela customizada só pode ser configurada para classes de exame." }, { status: 409 });
    }

    const { data: ano, error: anoError } = await (supabase as any)
      .from("anos_letivos")
      .select("id, data_inicio, data_fim")
      .eq("escola_id", escolaId)
      .eq("id", turma.ano_letivo_id)
      .maybeSingle();
    if (anoError) throw anoError;
    if (!ano?.data_inicio || !ano?.data_fim) {
      return NextResponse.json({ ok: false, error: "O ano letivo não tem datas completas configuradas." }, { status: 409 });
    }
    if (dataInicio < String(ano.data_inicio).slice(0, 10) || dataFim < String(ano.data_fim).slice(0, 10) || dataFim < dataInicio) {
      return NextResponse.json({ ok: false, error: "A janela deve começar dentro do ano letivo e terminar no fim do ano letivo ou depois dele." }, { status: 422 });
    }

    const { data, error } = await (supabase as any)
      .from("turma_janelas_cobranca")
      .upsert({
        escola_id: escolaId,
        turma_id: turmaId,
        ano_letivo_id: turma.ano_letivo_id,
        data_inicio: dataInicio,
        data_fim: dataFim,
        motivo: "exame",
        updated_at: new Date().toISOString(),
      }, { onConflict: "escola_id,turma_id,ano_letivo_id" })
      .select("id, turma_id, ano_letivo_id, data_inicio, data_fim, motivo")
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Erro ao guardar janela de cobrança" }, { status: 500 });
  }
}

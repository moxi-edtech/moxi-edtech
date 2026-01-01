import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/escola/disciplinas";

function inferAnoLetivo(session: any): number | null {
  const candidatos = [session?.ano_letivo, session?.nome, session?.data_inicio, session?.data_fim];
  for (const c of candidatos) {
    if (c === null || c === undefined) continue;
    if (typeof c === "number" && Number.isFinite(c)) return Math.trunc(c);
    const txt = String(c);
    const match = txt.match(/(19|20)\d{2}/);
    if (match?.[0]) return Number(match[0]);
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const escolaId = String(body?.escolaId || "");
    let ano = Number(body?.ano);
    const mes = Number(body?.mes);
    const diaVencimento = body?.diaVencimento ? Number(body.diaVencimento) : undefined;
    const turmaId = body?.turmaId ? String(body.turmaId) : undefined;
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";

    if (!escolaId || !Number.isFinite(mes)) {
      return NextResponse.json(
        { ok: false, error: "Parâmetros obrigatórios: escolaId e mes" },
        { status: 400 }
      );
    }

    // Garantir vínculo do usuário com a escola
    const escolaDoUsuario = await resolveEscolaIdForUser(supabase as any, user.id);
    if (escolaDoUsuario && escolaDoUsuario !== escolaId) {
      return NextResponse.json(
        { ok: false, error: "Usuário não pertence a esta escola" },
        { status: 403 }
      );
    }

    // Valida sessão/ano letivo se enviado
    if (sessionId) {
      const { data: sessionRow, error: sessionErr } = await supabase
        .from("school_sessions")
        .select("id, escola_id, nome, data_inicio, data_fim, ano_letivo")
        .eq("id", sessionId)
        .eq("escola_id", escolaId)
        .maybeSingle();

      if (sessionErr || !sessionRow) {
        return NextResponse.json({ ok: false, error: "Sessão inválida para a escola" }, { status: 400 });
      }

      const anoInferido = inferAnoLetivo(sessionRow);
      if (!Number.isFinite(ano) && anoInferido) ano = anoInferido;
    }

    if (!Number.isFinite(ano)) {
      return NextResponse.json({ ok: false, error: "Ano letivo inválido" }, { status: 400 });
    }

    // Valida turma se enviada (vinculada à escola e sessão)
    if (turmaId) {
      const { data: turmaRow, error: turmaErr } = await supabase
        .from("turmas")
        .select("id, escola_id, session_id")
        .eq("id", turmaId)
        .maybeSingle();

      if (turmaErr || !turmaRow) {
        return NextResponse.json({ ok: false, error: "Turma inválida" }, { status: 400 });
      }

      if ((turmaRow as any).escola_id !== escolaId) {
        return NextResponse.json({ ok: false, error: "Turma não pertence à escola" }, { status: 400 });
      }

      if (sessionId && (turmaRow as any).session_id && (turmaRow as any).session_id !== sessionId) {
        return NextResponse.json({ ok: false, error: "Turma não pertence ao ano selecionado" }, { status: 400 });
      }
    }

    const { data, error } = await supabase.rpc("gerar_mensalidades_lote", {
      p_escola_id: escolaId,
      p_ano_letivo: ano,
      p_mes_referencia: mes,
      p_dia_vencimento_default: diaVencimento,
      p_turma_id: turmaId ?? null,
    });

    if (error) {
      console.error("[mensalidades/gerar] Erro RPC:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? { ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[mensalidades/gerar] Erro inesperado:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

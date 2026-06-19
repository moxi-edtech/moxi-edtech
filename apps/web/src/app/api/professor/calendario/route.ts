import { NextResponse } from "next/server";
import { applyKf2ListInvariants } from "@/lib/kf2";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type ProfessorRow = { id: string };
type AnoLetivoRow = {
  id: string;
  ano: number | null;
  ativo: boolean | null;
  data_inicio: string;
  data_fim: string;
};
type PeriodoRow = {
  id: string;
  ano_letivo_id: string;
  tipo: string | null;
  numero: number | null;
  data_inicio: string;
  data_fim: string;
  trava_notas_em: string | null;
  peso: number | null;
};
type EventoRow = {
  id: string;
  escola_id: string;
  nome: string;
  descricao: string | null;
  data_inicio: string;
  data_fim: string;
  tipo: string;
  publico_alvo: string | null;
  cor_hex: string | null;
};

const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export async function GET() {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 });
    }

    const professorResult = await applyKf2ListInvariants(
      supabase
        .from("professores")
        .select("id")
        .eq("profile_id", user.id)
        .eq("escola_id", escolaId),
      { defaultLimit: 1, tieBreakerColumn: "id" }
    ).maybeSingle();
    const professor = (professorResult.data as ProfessorRow | null) ?? null;

    if (!professor?.id) {
      return NextResponse.json({ ok: false, error: "Professor não encontrado" }, { status: 403 });
    }

    const activeYearQuery = applyKf2ListInvariants(
      supabase
        .from("anos_letivos")
        .select("id, ano, ativo, data_inicio, data_fim")
        .eq("escola_id", escolaId)
        .eq("ativo", true),
      {
        defaultLimit: 1,
        order: [{ column: "ano", ascending: false }],
        tieBreakerColumn: "id",
      }
    );

    const activeYearResult = await activeYearQuery.maybeSingle();
    let anoLetivo = (activeYearResult.data as AnoLetivoRow | null) ?? null;
    let anoLetivoError = activeYearResult.error ?? null;

    if (anoLetivoError) {
      return NextResponse.json({ ok: false, error: anoLetivoError.message }, { status: 400 });
    }

    if (!anoLetivo) {
      const fallbackYearQuery = applyKf2ListInvariants(
        supabase
          .from("anos_letivos")
          .select("id, ano, ativo, data_inicio, data_fim")
          .eq("escola_id", escolaId),
        {
          defaultLimit: 1,
          order: [{ column: "ano", ascending: false }],
          tieBreakerColumn: "id",
        }
      );

      const fallbackResult = await fallbackYearQuery.maybeSingle();
      anoLetivo = (fallbackResult.data as AnoLetivoRow | null) ?? null;
      anoLetivoError = fallbackResult.error ?? null;

      if (anoLetivoError) {
        return NextResponse.json({ ok: false, error: anoLetivoError.message }, { status: 400 });
      }
    }

    const today = new Date();
    const rangeStart = anoLetivo?.data_inicio ?? toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1));
    const rangeEnd =
      anoLetivo?.data_fim ?? toIsoDate(new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()));

    let eventosQuery = supabase
      .from("vw_eventos_escola_unificados")
      .select("id, escola_id, nome, descricao, data_inicio, data_fim, tipo, publico_alvo, cor_hex")
      .eq("escola_id", escolaId)
      .or("publico_alvo.eq.todos,publico_alvo.eq.professores,publico_alvo.is.null")
      .gte("data_fim", rangeStart)
      .lte("data_inicio", rangeEnd);

    eventosQuery = applyKf2ListInvariants(eventosQuery, {
      defaultLimit: 120,
      order: [{ column: "data_inicio", ascending: true }],
      tieBreakerColumn: "id",
    });

    const eventosPromise = eventosQuery;
    const periodosPromise = anoLetivo?.id
      ? applyKf2ListInvariants(
          supabase
            .from("periodos_letivos")
            .select("id, ano_letivo_id, tipo, numero, data_inicio, data_fim, trava_notas_em, peso")
            .eq("escola_id", escolaId)
            .eq("ano_letivo_id", anoLetivo.id),
          {
            defaultLimit: 20,
            order: [{ column: "data_inicio", ascending: true }],
            tieBreakerColumn: "id",
          }
        )
      : Promise.resolve({ data: [] as PeriodoRow[], error: null });

    const [{ data: items, error: eventosError }, { data: periodos, error: periodosError }] = await Promise.all([
      eventosPromise,
      periodosPromise,
    ]);

    if (eventosError) {
      return NextResponse.json({ ok: false, error: eventosError.message }, { status: 400 });
    }

    if (periodosError) {
      return NextResponse.json({ ok: false, error: periodosError.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      ano_letivo: anoLetivo ?? null,
      periodos: ((periodos as PeriodoRow[] | null) ?? []).filter(Boolean),
      items: ((items as EventoRow[] | null) ?? []).filter(Boolean),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

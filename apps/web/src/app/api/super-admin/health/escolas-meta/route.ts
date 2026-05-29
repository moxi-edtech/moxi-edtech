import { NextResponse } from "next/server";

import { requireSuperAdminRoute } from "@/lib/auth/requireSuperAdminRoute";
import { applyKf2ListInvariants } from "@/lib/kf2";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type EscolaMetaItem = {
  id: string;
  cidade: string | null;
  estado: string | null;
  onboarding_finalizado: boolean;
  nota_interna: string | null;
};

type EscolaRow = {
  id: string;
  cidade: string | null;
  estado: string | null;
  onboarding_finalizado: boolean | null;
  endereco?: string | null;
};

type NotaRow = {
  escola_id: string;
  nota: string | null;
};

export async function GET() {
  const auth = await requireSuperAdminRoute();
  if (!auth.ok) return auth.response;

  try {
    const supabase = auth.supabase;
    const orderByNome = [{ column: "nome", ascending: true }] as const;
    let escolaRows: EscolaRow[] = [];

    let escolasViewQuery = supabase
      .from("escolas_view" as any)
      .select("id, cidade, estado, onboarding_finalizado, nome");

    escolasViewQuery = applyKf2ListInvariants(escolasViewQuery, {
      defaultLimit: 1000,
      order: [...orderByNome],
    });

    const { data: escolasViewRows, error: escolasViewError } = await escolasViewQuery;

    if (!escolasViewError) {
      escolaRows = ((escolasViewRows ?? []) as unknown as EscolaRow[]);
    } else {
      let fallbackQuery = supabase
        .from("escolas" as any)
        .select("id, endereco, onboarding_finalizado, nome");

      fallbackQuery = applyKf2ListInvariants(fallbackQuery, {
        defaultLimit: 1000,
        order: [...orderByNome],
      });

      const { data: fallbackRows, error: fallbackError } = await fallbackQuery;
      if (fallbackError) {
        return NextResponse.json({ ok: false, error: fallbackError.message }, { status: 400 });
      }

      escolaRows = ((fallbackRows ?? []) as unknown as Array<{
        id: string;
        endereco?: string | null;
        onboarding_finalizado?: boolean | null;
      }>).map((row) => ({
        id: String(row.id),
        cidade: row.endereco ?? null,
        estado: null,
        onboarding_finalizado: row.onboarding_finalizado ?? null,
      }));
    }

    const escolaIds = escolaRows.map((row) => String(row.id));
    const { data: notesRows, error: notesError } = escolaIds.length
      ? await supabase
          .from("escola_notas_internas")
          .select("escola_id, nota")
          .in("escola_id", escolaIds)
      : { data: [], error: null };

    if (notesError) {
      return NextResponse.json({ ok: false, error: notesError.message }, { status: 400 });
    }

    const notesById = new Map<string, string | null>(
      ((notesRows ?? []) as NotaRow[]).map((row) => [String(row.escola_id), row.nota ?? null]),
    );

    const items: EscolaMetaItem[] = escolaRows.map((row) => ({
      id: String(row.id),
      cidade: row.cidade ?? null,
      estado: row.estado ?? null,
      onboarding_finalizado: Boolean(row.onboarding_finalizado),
      nota_interna: notesById.get(String(row.id)) ?? null,
    }));

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

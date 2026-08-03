import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { applyKf2ListInvariants } from "@/lib/kf2";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type LookupError = { message: string } | null;
type AlunoLookupRow = { id: string; nome: string | null };
type MensalidadeLookupRow = {
  id: string;
  mes_referencia: number | null;
  ano_referencia: number | null;
};

type LookupResult<T> = {
  data: T[];
  error: LookupError;
};

export async function GET(req: Request) {
  try {
    const s = await supabaseServer();
    const { data: userRes } = await s.auth.getUser();
    const escolaId = userRes?.user ? await resolveEscolaIdForUser(s, userRes.user.id) : null;
    if (!escolaId) return NextResponse.json({ ok: false, items: [] }, { status: 401 });

    const url = new URL(req.url);
    const q = url.searchParams.get("q") || "";
    const days = url.searchParams.get("days") || "30";
    const alunoId = url.searchParams.get("aluno_id") || "";
    const status = url.searchParams.get("status") || "";

    const since = (() => {
      if (days === "all") return "1970-01-01";
      const d = parseInt(days || "30", 10);
      if (!Number.isFinite(d) || d <= 0) return "1970-01-01";
      const dt = new Date();
      dt.setDate(dt.getDate() - d);
      return dt.toISOString();
    })();

    let query = s
      .from("pagamentos")
      .select("id, aluno_id, mensalidade_id, status, valor_pago, metodo, reference, referencia, created_at")
      .eq("escola_id", escolaId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(50);

    query = applyKf2ListInvariants(query, { defaultLimit: 50 });

    if (/^[0-9a-fA-F-]{36}$/.test(alunoId)) {
      query = query.eq("aluno_id", alunoId);
    }

    if (status === "realizados") {
      query = query.in("status", ["settled", "concluido", "pago"]);
    }

    if (q) {
      const uuidRe = /^[0-9a-fA-F-]{36}$/;
      const numRe = /^\d+(?:[\.,]\d+)?$/;
      if (uuidRe.test(q)) {
        query = query.eq("id", q);
      } else if (numRe.test(q)) {
        query = query.or(`status.ilike.%${q}%,metodo.ilike.%${q}%,referencia.ilike.%${q}%`);
      } else {
        query = query.or(`status.ilike.%${q}%,metodo.ilike.%${q}%,referencia.ilike.%${q}%`);
      }
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const pagamentoRows = data ?? [];
    const alunoIds = Array.from(
      new Set(pagamentoRows.map((row) => row.aluno_id).filter((id): id is string => Boolean(id)))
    );
    const mensalidadeIds = Array.from(
      new Set(pagamentoRows.map((row) => row.mensalidade_id).filter((id): id is string => Boolean(id)))
    );

    const loadAlunos = async (): Promise<LookupResult<AlunoLookupRow>> => {
      if (alunoIds.length === 0) return { data: [], error: null };
      const result = await s
        .from("alunos")
        .select("id,nome")
        .eq("escola_id", escolaId)
        .in("id", alunoIds)
        .order("id", { ascending: true })
        .limit(50);
      return { data: result.data ?? [], error: result.error };
    };

    const loadMensalidades = async (): Promise<LookupResult<MensalidadeLookupRow>> => {
      if (mensalidadeIds.length === 0) return { data: [], error: null };
      const result = await s
        .from("mensalidades")
        .select("id,mes_referencia,ano_referencia")
        .eq("escola_id", escolaId)
        .in("id", mensalidadeIds)
        .order("id", { ascending: true })
        .limit(50);
      return { data: result.data ?? [], error: result.error };
    };

    const [alunosResult, mensalidadesResult] = await Promise.all([
      loadAlunos(),
      loadMensalidades(),
    ]);

    if (alunosResult.error || mensalidadesResult.error) {
      return NextResponse.json(
        {
          ok: false,
          error: alunosResult.error?.message || mensalidadesResult.error?.message || "Falha ao contextualizar pagamentos",
        },
        { status: 400 }
      );
    }

    const alunosById = new Map(
      (alunosResult.data ?? []).map((aluno) => [aluno.id, aluno.nome || "Aluno sem nome"])
    );
    const mensalidadesById = new Map(
      (mensalidadesResult.data ?? []).map((mensalidade) => [mensalidade.id, mensalidade])
    );
    const items = pagamentoRows.map((row) => {
      const mensalidade = row.mensalidade_id
        ? mensalidadesById.get(row.mensalidade_id)
        : null;
      return {
        ...row,
        aluno_nome: row.aluno_id ? alunosById.get(row.aluno_id) ?? null : null,
        mes_referencia: mensalidade?.mes_referencia ?? null,
        ano_referencia: mensalidade?.ano_referencia ?? null,
        referencia: row.reference ?? row.referencia ?? null,
      };
    });
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

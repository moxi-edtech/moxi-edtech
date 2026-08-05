// @kf2 allow-scan
// apps/web/src/app/api/secretaria/operacoes-academicas/virada/clone-structure/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeEscolaAction } from "@/lib/escola/disciplinas";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";

const Body = z.object({
  from_session_id: z.string().uuid(),
  to_session_id: z.string().uuid(),
  readjust_percent: z.number().min(0).max(500).default(0),
});

type LooseRpcResult = {
  data: unknown;
  error: { message: string } | null;
};

export async function POST(request: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });
    const authz = await authorizeEscolaAction(supabase as any, escolaId, user.id, ["configurar_escola"]);
    if (!authz.allowed) {
      return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = Body.safeParse(body);
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Dados inválidos" }, { status: 400 });

    const rpcLoose = supabase.rpc.bind(supabase) as unknown as (
      fn: string,
      args?: Record<string, unknown>
    ) => Promise<LooseRpcResult>;

    const db = supabase as any;
    const countSessionRecords = async (sessionId: string, sessionYear: number | null) => {
      const [{ count: turmas }, { count: precos }, { count: periodos }, { data: targetCurricula }] = await Promise.all([
        db.from("turmas").select("id", { count: "exact", head: true }).eq("escola_id", escolaId).eq("session_id", sessionId),
        sessionYear === null
          ? db.from("financeiro_tabelas").select("id", { count: "exact", head: true }).eq("escola_id", escolaId).eq("session_id", sessionId)
          : db.from("financeiro_tabelas").select("id", { count: "exact", head: true }).eq("escola_id", escolaId).or(`session_id.eq.${sessionId},ano_letivo.eq.${sessionYear}`),
        db.from("periodos_letivos").select("id", { count: "exact", head: true }).eq("escola_id", escolaId).eq("ano_letivo_id", sessionId),
        db.from("curso_curriculos").select("id").eq("escola_id", escolaId).eq("ano_letivo_id", sessionId).eq("status", "published"),
      ]);
      const curriculumIds = (targetCurricula ?? []).map((curriculum: { id: string }) => curriculum.id);
      const { count: disciplinas } = curriculumIds.length > 0
        ? await db.from("curso_matriz").select("id", { count: "exact", head: true }).eq("escola_id", escolaId).in("curso_curriculo_id", curriculumIds)
        : { count: 0 };
      return { turmas: turmas ?? 0, precos: precos ?? 0, periodos: periodos ?? 0, disciplinas: disciplinas ?? 0 };
    };

    const { data: sourceSession } = await db
      .from("anos_letivos")
      .select("ano")
      .eq("id", parsed.data.from_session_id)
      .eq("escola_id", escolaId)
      .maybeSingle();
    const before = await countSessionRecords(parsed.data.to_session_id, null);
    const expected = await countSessionRecords(parsed.data.from_session_id, sourceSession?.ano ?? null);

    const { data, error } = await rpcLoose("clone_academic_structure_v2", {
      p_escola_id: escolaId,
      p_from_session_id: parsed.data.from_session_id,
      p_to_session_id: parsed.data.to_session_id,
      p_readjust_percent: parsed.data.readjust_percent
    });

    if (error) {
      console.error("[CLONE-STRUCTURE] Erro na RPC:", error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const after = await countSessionRecords(parsed.data.to_session_id, null);
    const created = {
      turmas: Math.max(0, after.turmas - before.turmas),
      precos: Math.max(0, after.precos - before.precos),
      periodos: Math.max(0, after.periodos - before.periodos),
      disciplinas: Math.max(0, after.disciplinas - before.disciplinas),
    };
    const reused = {
      turmas: Math.min(before.turmas, after.turmas),
      precos: Math.min(before.precos, after.precos),
      periodos: Math.min(before.periodos, after.periodos),
      disciplinas: Math.min(before.disciplinas, after.disciplinas),
    };
    const divergent = {
      turmas: Math.max(0, expected.turmas - after.turmas),
      precos: Math.max(0, expected.precos - after.precos),
      periodos: Math.max(0, expected.periodos - after.periodos),
      disciplinas: Math.max(0, expected.disciplinas - after.disciplinas),
    };

    return NextResponse.json({
      ok: true,
      result: {
        ...(data as Record<string, unknown>),
        totals: after,
        created,
        reused,
        expected,
        divergent,
        idempotent: Object.values(created).every((count) => count === 0) && Object.values(divergent).every((count) => count === 0),
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

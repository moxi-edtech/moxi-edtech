import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const bodySchema = z.object({
  action: z.enum(["fix_sessions", "fix_orphan_mensalidades", "fix_competencia_mensalidades", "publish_pending_curriculos"]),
  dryRun: z.boolean().optional().default(false),
});

type CurriculoStatusRow = {
  curso_id: string;
  classe_id: string | null;
  status: "draft" | "published" | "archived" | "none";
  version: number;
  ano_letivo_id: string;
};

type ClasseRow = {
  id: string;
  curso_id: string | null;
};

type PublishAttempt = {
  curso_id: string;
  ok: boolean;
  message: string;
};

type LooseRpcResult = {
  data: unknown;
  error: { message: string } | null;
};

async function runPublishPendingCurriculos(
  supabase: Awaited<ReturnType<typeof supabaseRouteClient<Database>>>,
  escolaId: string,
  dryRun: boolean
) {
  const { data: anoAtivo, error: anoErr } = await supabase
    .from("anos_letivos")
    .select("id,ano")
    .eq("escola_id", escolaId)
    .eq("ativo", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (anoErr) throw new Error(anoErr.message);
  if (!anoAtivo) throw new Error("Ano letivo ativo não encontrado.");

  const { data: classes, error: classesErr } = await supabase
    .from("classes")
    .select("id,curso_id")
    .eq("escola_id", escolaId);
  if (classesErr) throw new Error(classesErr.message);

  const { data: curriculos, error: curErr } = await supabase
    .from("curso_curriculos")
    .select("curso_id,classe_id,status,version,ano_letivo_id")
    .eq("escola_id", escolaId)
    .eq("ano_letivo_id", anoAtivo.id);
  if (curErr) throw new Error(curErr.message);

  const classRows = (classes ?? []) as ClasseRow[];
  const currRows = (curriculos ?? []) as CurriculoStatusRow[];

  const classesByCurso = new Map<string, string[]>();
  for (const cls of classRows) {
    if (!cls.curso_id) continue;
    const list = classesByCurso.get(cls.curso_id) ?? [];
    list.push(cls.id);
    classesByCurso.set(cls.curso_id, list);
  }

  const publishedByCurso = new Map<string, Set<string>>();
  const latestVersionByCurso = new Map<string, number>();
  for (const row of currRows) {
    if (row.status === "published" && row.classe_id) {
      const set = publishedByCurso.get(row.curso_id) ?? new Set<string>();
      set.add(row.classe_id);
      publishedByCurso.set(row.curso_id, set);
    }
    const prev = latestVersionByCurso.get(row.curso_id) ?? 0;
    if (row.version > prev) latestVersionByCurso.set(row.curso_id, row.version);
  }

  const cursosPendentes: string[] = [];
  for (const [cursoId, classIds] of classesByCurso.entries()) {
    const published = publishedByCurso.get(cursoId) ?? new Set<string>();
    const hasPending = classIds.some((classId) => !published.has(classId));
    if (hasPending) cursosPendentes.push(cursoId);
  }

  if (dryRun) {
    return {
      ok: true,
      dry_run: true,
      ano_letivo_id: anoAtivo.id,
      ano_letivo: anoAtivo.ano,
      cursos_pendentes: cursosPendentes.length,
      cursos_ids: cursosPendentes,
    };
  }

  const attempts: PublishAttempt[] = [];
  for (const cursoId of cursosPendentes) {
    const version = latestVersionByCurso.get(cursoId) ?? 0;
    if (version <= 0) {
      attempts.push({
        curso_id: cursoId,
        ok: false,
        message: "Sem versão de currículo no ano ativo para publicar em lote.",
      });
      continue;
    }

    const { data, error } = await supabase.rpc("curriculo_publish", {
      p_escola_id: escolaId,
      p_curso_id: cursoId,
      p_ano_letivo_id: anoAtivo.id,
      p_version: version,
      p_rebuild_turmas: false,
      p_classe_id: null,
    });

    if (error) {
      attempts.push({ curso_id: cursoId, ok: false, message: error.message });
      continue;
    }

    const payload = Array.isArray(data) ? data[0] : data;
    const ok = Boolean(payload?.ok);
    attempts.push({
      curso_id: cursoId,
      ok,
      message: String(payload?.message ?? (ok ? "Publicado" : "Falha sem mensagem")),
    });
  }

  const successCount = attempts.filter((a) => a.ok).length;
  return {
    ok: successCount === attempts.length,
    dry_run: false,
    ano_letivo_id: anoAtivo.id,
    ano_letivo: anoAtivo.ano,
    cursos_pendentes: cursosPendentes.length,
    cursos_publicados: successCount,
    cursos_falha: attempts.length - successCount,
    attempts,
  };
}

export async function POST(req: Request) {
  try {
    const supabase = await supabaseRouteClient<Database>();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Payload inválido", issues: parsed.error.issues }, { status: 400 });
    }

    const { action, dryRun } = parsed.data;

    if (action === "fix_sessions") {
      const { data, error } = await supabase.rpc("fix_academic_session_ids", { p_escola_id: escolaId });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, action, dry_run: false, result: data });
    }

    if (action === "publish_pending_curriculos") {
      const result = await runPublishPendingCurriculos(supabase, escolaId, dryRun);
      return NextResponse.json(result, { status: result.ok ? 200 : 409 });
    }

    const actionToRpc: Record<string, "orphan_mensalidades" | "competencia_mensalidades"> = {
      fix_orphan_mensalidades: "orphan_mensalidades",
      fix_competencia_mensalidades: "competencia_mensalidades",
    };

    const rpcLoose = supabase.rpc.bind(supabase) as unknown as (
      fn: string,
      args?: Record<string, unknown>
    ) => Promise<LooseRpcResult>;

    const { data, error } = await rpcLoose("remediate_cutover_gaps", {
      p_escola_id: escolaId,
      p_action: actionToRpc[action],
      p_dry_run: dryRun,
    });

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, action, dry_run: dryRun, result: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

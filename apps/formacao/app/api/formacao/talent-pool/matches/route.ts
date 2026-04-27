import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import type { FormacaoSupabaseClient } from "@/lib/db-types";
import { classifyMatchInsertError } from "@/lib/talent-pool/routes-contract";

export const dynamic = "force-dynamic";

type MatchActionPayload = {
  id?: string;
  status?: "accepted" | "rejected";
};

type MatchCreatePayload = {
  aluno_id?: string;
};

async function resolveAlunoId(s: FormacaoSupabaseClient, escolaId: string, userId: string): Promise<string | null> {
  const alunosTable: string = "alunos";
  const { data, error } = await s
    .from(alunosTable)
    .select("id")
    .eq("escola_id", escolaId)
    .or(`usuario_auth_id.eq.${userId},profile_id.eq.${userId}`)
    .limit(1);

  if (error) return null;
  const firstRow = ((data ?? [])[0] ?? null) as { id?: unknown } | null;
  return typeof firstRow?.id === "string" ? firstRow.id : null;
}

async function ensureEmpresaParceiraProfile(s: FormacaoSupabaseClient): Promise<void> {
  const rpcClient = s as unknown as {
    rpc: (fn: string, args: { p_nif: string | null }) => Promise<{ error: { message: string } | null }>;
  };
  const { error } = await rpcClient.rpc("ensure_empresa_parceira_profile", { p_nif: null });
  if (error) {
    console.warn("[talent-pool] ensure_empresa_parceira_profile failed:", error.message);
  }
}

export async function GET() {
  const auth = await requireFormacaoRoles(["formando", "formacao_admin", "super_admin", "global_admin"]);
  if (!auth.ok) return auth.response;

  const s = auth.supabase as FormacaoSupabaseClient;
  const matchesTable: string = "talent_pool_matches";

  const alunoId = await resolveAlunoId(s, auth.escolaId, auth.userId);
  if (!alunoId) {
    return NextResponse.json({ ok: false, error: "Perfil de aluno nao encontrado" }, { status: 404 });
  }

  const { data, error } = await s
    .from(matchesTable)
    .select("id, empresa_id, status, created_at")
    .eq("aluno_id", alunoId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  const items = (data ?? []).map((row) => {
    const empresaId = String((row as { empresa_id?: string | null }).empresa_id ?? "");
    return {
      id: (row as { id: string }).id,
      empresa_id: empresaId,
      empresa_label: empresaId ? `Empresa ${empresaId.slice(0, 8)}` : "Empresa parceira",
      status: (row as { status: string }).status,
      created_at: (row as { created_at: string }).created_at,
    };
  });

  return NextResponse.json({ ok: true, items });
}

export async function PATCH(request: Request) {
  const auth = await requireFormacaoRoles(["formando", "formacao_admin", "super_admin", "global_admin"]);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as MatchActionPayload | null;
  const id = String(body?.id ?? "").trim();
  const status = body?.status;

  if (!id || (status !== "accepted" && status !== "rejected")) {
    return NextResponse.json({ ok: false, error: "id e status sao obrigatorios" }, { status: 400 });
  }

  const s = auth.supabase as FormacaoSupabaseClient;
  const matchesTable: string = "talent_pool_matches";
  const alunoId = await resolveAlunoId(s, auth.escolaId, auth.userId);
  if (!alunoId) {
    return NextResponse.json({ ok: false, error: "Perfil de aluno nao encontrado" }, { status: 404 });
  }

  const { data, error } = await s
    .from(matchesTable)
    .update({ status })
    .eq("id", id)
    .eq("aluno_id", alunoId)
    .select("id, empresa_id, status, created_at")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, item: data });
}

export async function POST(request: Request) {
  const auth = await requireFormacaoRoles([
    "formacao_admin",
    "formacao_secretaria",
    "formacao_financeiro",
    "super_admin",
    "global_admin",
  ]);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as MatchCreatePayload | null;
  const alunoId = String(body?.aluno_id ?? "").trim();
  if (!alunoId) {
    return NextResponse.json({ ok: false, error: "aluno_id e obrigatorio" }, { status: 400 });
  }

  const s = auth.supabase as FormacaoSupabaseClient;
  const matchesTable: string = "talent_pool_matches";

  // First-login integration for company profile (quarantine / fast-track)
  await ensureEmpresaParceiraProfile(s);

  const { data, error } = await s
    .from(matchesTable)
    .insert({
      empresa_id: auth.userId,
      aluno_id: alunoId,
      status: "pending",
    })
    .select("id, empresa_id, aluno_id, status, created_at")
    .single();

  if (error) {
    const contract = classifyMatchInsertError({ code: error.code, message: error.message });
    return NextResponse.json(contract.body, { status: contract.status });
  }

  return NextResponse.json({ ok: true, item: data }, { status: 201 });
}

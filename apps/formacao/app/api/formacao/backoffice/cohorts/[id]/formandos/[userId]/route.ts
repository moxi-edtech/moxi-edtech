import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import type { FormacaoDatabase, FormacaoSupabaseClient } from "@/lib/db-types";

export const dynamic = "force-dynamic";

const allowedRoles = [
  "formacao_admin",
  "formacao_secretaria",
  "super_admin",
  "global_admin",
];

type ActionPayload =
  | { action: "resend_access" }
  | { action: "set_access_block"; blocked: boolean }
  | { action: "set_academic_status"; status: "cursando" | "desistente" | "apto" | "nao_apto" };

function getPortalOrigin() {
  if (process.env.NODE_ENV !== "production") {
    return process.env.KLASSE_FORMACAO_LOCAL_ORIGIN ?? "http://formacao.lvh.me:3002";
  }
  return process.env.KLASSE_FORMACAO_URL ?? "https://formacao.klasse.ao";
}

function mergeMetadata(base: Record<string, unknown> | null, patch: Record<string, unknown>) {
  return {
    ...(base ?? {}),
    ...patch,
  };
}

type InscricaoMetadata = FormacaoDatabase["public"]["Tables"]["formacao_inscricoes"]["Row"]["metadata"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const p = await params;
  const cohortId = String(p.id ?? "").trim();
  const formandoUserId = String(p.userId ?? "").trim();
  if (!cohortId || !formandoUserId) {
    return NextResponse.json({ ok: false, error: "Parâmetros inválidos" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as ActionPayload | null;
  if (!body?.action) {
    return NextResponse.json({ ok: false, error: "Ação obrigatória" }, { status: 400 });
  }

  const s = auth.supabase as FormacaoSupabaseClient;

  const { data: inscricoes, error: inscricoesError } = await s
    .from("formacao_inscricoes")
    .select("id, estado, metadata")
    .eq("escola_id", auth.escolaId)
    .eq("cohort_id", cohortId)
    .eq("formando_user_id", formandoUserId)
    .is("cancelled_at", null)
    .order("created_at", { ascending: false });

  if (inscricoesError) {
    return NextResponse.json({ ok: false, error: inscricoesError.message }, { status: 400 });
  }
  if (!inscricoes || inscricoes.length === 0) {
    return NextResponse.json({ ok: false, error: "Formando não encontrado nesta cohort" }, { status: 404 });
  }

  if (body.action === "resend_access") {
    const { data: profilesData, error: profileError } = await (s as FormacaoSupabaseClient & {
      rpc: (
        fn: string,
        args: Record<string, unknown>
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    }).rpc("tenant_profiles_by_ids", {
      p_user_ids: [formandoUserId],
    });

    if (profileError) {
      return NextResponse.json({ ok: false, error: profileError.message }, { status: 400 });
    }

    const profile = Array.isArray(profilesData) ? profilesData[0] : null;
    const email = String((profile as { email?: string | null } | null)?.email ?? "")
      .trim()
      .toLowerCase();

    if (!email) {
      return NextResponse.json({ ok: false, error: "Formando sem email para reenviar acesso" }, { status: 400 });
    }

    const { error } = await s.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${getPortalOrigin()}/login`,
      },
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      action: body.action,
      message: "Acesso reenviado por email.",
    });
  }

  if (body.action === "set_access_block") {
    for (const row of inscricoes) {
      const nextMetadata = mergeMetadata((row.metadata ?? null) as Record<string, unknown> | null, {
        portal_access_blocked: Boolean(body.blocked),
        blocked_by: auth.userId,
        blocked_at: new Date().toISOString(),
      });

      const { error } = await s
        .from("formacao_inscricoes")
        .update({ metadata: nextMetadata as InscricaoMetadata })
        .eq("id", row.id)
        .eq("escola_id", auth.escolaId);

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json({
      ok: true,
      action: body.action,
      blocked: Boolean(body.blocked),
    });
  }

  if (body.action === "set_academic_status") {
    const normalizedStatus = String(body.status ?? "").trim().toLowerCase();
    if (!["cursando", "desistente", "apto", "nao_apto"].includes(normalizedStatus)) {
      return NextResponse.json({ ok: false, error: "Estado académico inválido" }, { status: 400 });
    }

    for (const row of inscricoes) {
      const nextMetadata = mergeMetadata((row.metadata ?? null) as Record<string, unknown> | null, {
        academic_status: normalizedStatus,
        academic_status_changed_by: auth.userId,
        academic_status_changed_at: new Date().toISOString(),
        portal_access_blocked:
          normalizedStatus === "desistente"
            ? true
            : Boolean((row.metadata as Record<string, unknown> | null)?.portal_access_blocked === true),
      });

      const { error } = await s
        .from("formacao_inscricoes")
        .update({
          estado: normalizedStatus,
          status_pagamento:
            normalizedStatus === "desistente"
              ? "cancelado"
              : undefined,
          metadata: nextMetadata as InscricaoMetadata,
        })
        .eq("id", row.id)
        .eq("escola_id", auth.escolaId);

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json({
      ok: true,
      action: body.action,
      status: normalizedStatus,
      blocked: normalizedStatus === "desistente",
    });
  }

  return NextResponse.json({ ok: false, error: "Ação não suportada" }, { status: 400 });
}

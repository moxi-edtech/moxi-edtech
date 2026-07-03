import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import type { DBWithRPC } from "@/types/supabase-augment";
import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess";
import { CreateEscolaBodySchema, CreateSchoolError, finalizeSchoolAdminAndEmails, ensureStaffUser } from "@/lib/escolas/create-school";
import { applyCurriculumPreset, type CurriculumKey } from "@/lib/academico/curriculum-apply";

export const dynamic = "force-dynamic";

async function requireSuperAdmin() {
  const supabase = await supabaseRouteClient<DBWithRPC>();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }) };
  }

  let role = user.app_metadata?.role ?? user.user_metadata?.role ?? null;
  if (!role) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle();
    role = profile?.role ?? null;
  }

  if (!isSuperAdminRole(typeof role === "string" ? role : null)) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 }) };
  }

  return { ok: true as const, supabase, user };
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ ok: false, error: "ID de onboarding inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = CreateEscolaBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados inválidos: " + parsed.error.issues[0]?.message }, { status: 400 });
    }

    const createAndProvisionBody = parsed.data;
    const nif = createAndProvisionBody.nif ? createAndProvisionBody.nif.replace(/\D/g, "") : null;
    const adminEmail = createAndProvisionBody.admin?.email ? createAndProvisionBody.admin.email.trim().toLowerCase() : null;
    const adminTelefone = createAndProvisionBody.admin?.telefone ? createAndProvisionBody.admin.telefone.replace(/\D/g, "") : null;
    const adminNome = createAndProvisionBody.admin?.nome ? createAndProvisionBody.admin.nome.trim() : null;

    const { data, error } = await auth.supabase.rpc("create_and_provision_escola_from_onboarding", {
      p_request_id: id,
      p_nome: createAndProvisionBody.nome,
      p_nif: nif,
      p_endereco: createAndProvisionBody.endereco ?? null,
      p_plano: createAndProvisionBody.plano ?? null,
      p_admin_email: adminEmail,
      p_admin_telefone: adminTelefone,
      p_admin_nome: adminNome,
      p_actor_id: auth.user.id,
    } as any);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message || "Falha ao criar e provisionar escola." }, { status: 400 });
    }

    const payload = data as {
      ok?: boolean;
      escola_id?: string;
      escola?: Record<string, unknown>;
      provision?: Record<string, unknown>;
    } | null;
    const escolaPayload = (payload?.escola ?? {}) as Record<string, unknown>;

    const escolaId = payload?.escola_id ?? ((escolaPayload.escolaId || escolaPayload.escola_id) as string | undefined) ?? null;
    if (!payload?.ok || !escolaId) {
      return NextResponse.json({ ok: false, error: "RPC não devolveu escola provisionada." }, { status: 500 });
    }

    const effects = await finalizeSchoolAdminAndEmails(req, auth.supabase, createAndProvisionBody, {
      payload: escolaPayload as any,
      escolaId,
      escolaNome: String((escolaPayload.escolaNome || escolaPayload.escola_nome || createAndProvisionBody.nome) ?? createAndProvisionBody.nome),
      adminEmail,
      adminTelefone,
      adminNome,
      adminPapel: createAndProvisionBody.admin?.papel ?? "admin",
    });

    const anoLetivoId = (payload?.provision as any)?.ano_letivo_id;

    // Apply curriculum preset automatically if defined in the onboarding request
    if (anoLetivoId) {
      try {
        const { data: reqData } = await (auth.supabase
          .from("onboarding_requests")
          .select("curriculum_preset, financeiro, contacto_secretaria, contacto_financeiro, contacto_pedagogico")
          .eq("id", id) as any)
          .maybeSingle();

        // Provision organizational contacts if present
        if (reqData) {
          const sec = (reqData as any).contacto_secretaria;
          if (sec && sec.email && sec.nome) {
            await ensureStaffUser(req, auth.supabase, {
              email: sec.email,
              nome: sec.nome,
              telefone: sec.telefone || null,
              escolaId,
              papel: "secretaria",
            }).catch((err) => console.error("[create-and-provision] Falha ao criar user secretaria:", err));
          }
          const fin = (reqData as any).contacto_financeiro;
          if (fin && fin.email && fin.nome) {
            await ensureStaffUser(req, auth.supabase, {
              email: fin.email,
              nome: fin.nome,
              telefone: fin.telefone || null,
              escolaId,
              papel: "financeiro",
            }).catch((err) => console.error("[create-and-provision] Falha ao criar user financeiro:", err));
          }
          const ped = (reqData as any).contacto_pedagogico;
          if (ped && ped.email && ped.nome) {
            await ensureStaffUser(req, auth.supabase, {
              email: ped.email,
              nome: ped.nome,
              telefone: ped.telefone || null,
              escolaId,
              papel: "admin_escola",
            }).catch((err) => console.error("[create-and-provision] Falha ao criar user pedagogico:", err));
          }
        }

        const presetKey = (reqData as any)?.curriculum_preset || (reqData as any)?.financeiro?.curriculum_preset;

        if (presetKey) {
          const { data: anoLetivoRow } = await auth.supabase
            .from("anos_letivos")
            .select("ano")
            .eq("id", anoLetivoId)
            .maybeSingle();

          const ano = anoLetivoRow?.ano ? Number(anoLetivoRow.ano) : new Date().getFullYear();

          const applyResult = await applyCurriculumPreset({
            supabase: auth.supabase,
            escolaId: escolaId,
            presetKey: presetKey as CurriculumKey,
            createTurmas: false,
            createCurriculo: true,
            anoLetivoId,
            anoLetivo: ano,
          });

          if (applyResult?.curriculo?.id) {
            const { error: publishError } = await auth.supabase.rpc("curriculo_publish", {
              p_escola_id: escolaId,
              p_curso_id: applyResult.curso.id,
              p_ano_letivo_id: anoLetivoId,
              p_version: applyResult.curriculo.version,
              p_rebuild_turmas: true,
              p_classe_id: null,
            });

            if (publishError) {
              console.error("[onboarding.create-and-provision] Falha ao publicar curriculo auto-instalado:", publishError);
            } else {
              // Rebuild the dashboard counts and curriculum stats
              try {
                await auth.supabase.rpc("refresh_mv_escola_cursos_stats");
              } catch {}
            }
          }
        }
      } catch (err) {
        console.error("[onboarding.create-and-provision] Erro ao auto-instalar preset curricular:", err);
      }
    }

    return NextResponse.json({
      ok: true,
      escolaId,
      escola: payload?.escola ?? null,
      provision: payload?.provision ?? null,
      ...effects,
    });
  } catch (err) {
    if (err instanceof CreateSchoolError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }

    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

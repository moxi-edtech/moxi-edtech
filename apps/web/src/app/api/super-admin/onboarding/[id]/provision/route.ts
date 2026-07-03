import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess";
import { applyCurriculumPreset, type CurriculumKey } from "@/lib/academico/curriculum-apply";
import { provisionStaffContact } from "@/lib/escolas/create-school";

export const dynamic = "force-dynamic";

const ProvisionSchema = z.object({
  escola_id: z.string().uuid("ID de escola inválido"),
});

async function requireSuperAdmin() {
  const supabase = await supabaseRouteClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user ?? null;
  if (!user) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }) };
  }

  const role = user.app_metadata?.role ?? user.user_metadata?.role ?? null;

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
    const parsed = ProvisionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados inválidos: " + parsed.error.issues[0]?.message }, { status: 400 });
    }

    const { escola_id } = parsed.data;

    const { data, error: rpcError } = await auth.supabase.rpc("provisionar_escola_from_onboarding", {
      p_request_id: id,
      p_escola_id: escola_id,
      p_actor_id: auth.user.id,
    });

    if (rpcError) {
      return NextResponse.json({ ok: false, error: "Erro no banco de dados: " + rpcError.message }, { status: 400 });
    }

    const payload = data as {
      ok?: boolean;
      ano_letivo_id?: string;
      already_provisioned?: boolean;
    } | null;

    const staffProvisioning: Array<Awaited<ReturnType<typeof provisionStaffContact>>> = [];

    // Apply curriculum preset automatically if defined in the onboarding request
    if (payload?.ok && payload.ano_letivo_id) {
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
            staffProvisioning.push(await provisionStaffContact(req, auth.supabase, {
              email: sec.email,
              nome: sec.nome,
              telefone: sec.telefone || null,
              escolaId: escola_id,
              papel: "secretaria",
              escolaNome: null,
            }));
          }
          const fin = (reqData as any).contacto_financeiro;
          if (fin && fin.email && fin.nome) {
            staffProvisioning.push(await provisionStaffContact(req, auth.supabase, {
              email: fin.email,
              nome: fin.nome,
              telefone: fin.telefone || null,
              escolaId: escola_id,
              papel: "financeiro",
              escolaNome: null,
            }));
          }
          const ped = (reqData as any).contacto_pedagogico;
          if (ped && ped.email && ped.nome) {
            staffProvisioning.push(await provisionStaffContact(req, auth.supabase, {
              email: ped.email,
              nome: ped.nome,
              telefone: ped.telefone || null,
              escolaId: escola_id,
              papel: "admin_escola",
              escolaNome: null,
            }));
          }
        }

        const presetKey = (reqData as any)?.curriculum_preset || (reqData as any)?.financeiro?.curriculum_preset;

        if (presetKey) {
          const { data: anoLetivoRow } = await auth.supabase
            .from("anos_letivos")
            .select("ano")
            .eq("id", payload.ano_letivo_id)
            .maybeSingle();

          const ano = anoLetivoRow?.ano ? Number(anoLetivoRow.ano) : new Date().getFullYear();

          const applyResult = await applyCurriculumPreset({
            supabase: auth.supabase,
            escolaId: escola_id,
            presetKey: presetKey as CurriculumKey,
            createTurmas: false,
            createCurriculo: true,
            anoLetivoId: payload.ano_letivo_id,
            anoLetivo: ano,
          });

          if (applyResult?.curriculo?.id) {
            const { error: publishError } = await auth.supabase.rpc("curriculo_publish", {
              p_escola_id: escola_id,
              p_curso_id: applyResult.curso.id,
              p_ano_letivo_id: payload.ano_letivo_id,
              p_version: applyResult.curriculo.version,
              p_rebuild_turmas: true,
              p_classe_id: null,
            });

            if (publishError) {
              console.error("[onboarding.provision] Falha ao publicar curriculo auto-instalado:", publishError);
            } else {
              // Rebuild the dashboard counts and curriculum stats
              try {
                await auth.supabase.rpc("refresh_mv_escola_cursos_stats");
              } catch {}
            }
          }
        }
      } catch (err) {
        console.error("[onboarding.provision] Erro ao auto-instalar preset curricular:", err);
      }
    }

    return NextResponse.json({
      ok: true,
      data,
      staffProvisioning,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Erro interno" }, { status: 500 });
  }
}

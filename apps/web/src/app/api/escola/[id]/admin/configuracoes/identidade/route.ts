// @kf2 allow-scan
import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const withNoStore = (response: NextResponse, start?: number) => {
  response.headers.set("Cache-Control", "no-store");
  if (start !== undefined) {
    response.headers.set("Server-Timing", `app;dur=${Date.now() - start}`);
  }
  return response;
};

async function authorize(
  requestedEscolaId: string,
  supabase: Awaited<ReturnType<typeof supabaseServerTyped<Database>>>
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Não autenticado", status: 401, user: null, escolaId: null } as const;
  }

  const userEscolaId = await resolveEscolaIdForUser(supabase, user.id, requestedEscolaId);
  if (!userEscolaId) {
    return { error: "Acesso negado a esta escola.", status: 403, user, escolaId: null } as const;
  }

  const { data: hasRole, error: rolesError } = await supabase.rpc("user_has_role_in_school", {
    p_escola_id: userEscolaId,
    p_roles: ["admin_escola", "admin", "secretaria"],
  });

  if (rolesError) {
    return { error: "Erro ao verificar permissões.", status: 500, user, escolaId: null } as const;
  }

  if (!hasRole) {
    return { error: "Você não tem permissão para executar esta ação.", status: 403, user, escolaId: null } as const;
  }

  return { error: null, status: 200, user, escolaId: userEscolaId } as const;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const start = Date.now();
  try {
    const { id: requestedEscolaId } = await params;
    const supabase = await supabaseServerTyped<Database>();
    const auth = await authorize(requestedEscolaId, supabase);
    if (auth.error || !auth.escolaId) {
      return withNoStore(NextResponse.json({ ok: false, error: auth.error }, { status: auth.status }), start);
    }
    const effectiveEscolaId = auth.escolaId;

    const { data, error } = await supabase
      .from("escolas")
      .select("id, nome, nif, endereco, logo_url, cor_primaria, plano_atual, created_at, status, aluno_portal_enabled")
      .eq("id", effectiveEscolaId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching escola identidade:", error);
      return withNoStore(
        NextResponse.json({ ok: false, error: "Erro ao carregar identidade." }, { status: 500 }),
        start
      );
    }

    const plano = (data as any)?.plano_atual ?? null;
    const { data: limites } = plano
      ? await supabase
          .from("app_plan_limits")
          .select("plan, price_mensal_kz, max_alunos, max_admin_users, max_storage_gb, professores_ilimitados, api_enabled, multi_campus, fin_recibo_pdf, sec_upload_docs, sec_matricula_online, doc_qr_code, app_whatsapp_auto, suporte_prioritario")
          .eq("plan", plano)
          .maybeSingle()
      : { data: null };

    const limitesNormalizados = limites ? { ...limites, fin_recibo_pdf: true } : null;

    const { data: assinatura } = await supabase
      .from("assinaturas")
      .select("valor_kz, ciclo, status")
      .eq("escola_id", effectiveEscolaId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return withNoStore(
      NextResponse.json({ ok: true, data, limites: limitesNormalizados, assinatura: assinatura ?? null }),
      start
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Error in identidade GET API:", message);
    return withNoStore(NextResponse.json({ ok: false, error: message }, { status: 500 }), start);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const start = Date.now();
  try {
    const { id: requestedEscolaId } = await params;
    const supabase = await supabaseServerTyped<Database>();
    const auth = await authorize(requestedEscolaId, supabase);
    if (auth.error || !auth.escolaId) {
      return withNoStore(NextResponse.json({ ok: false, error: auth.error }, { status: auth.status }), start);
    }

    const escolaId = auth.escolaId;
    const form = await request.formData();
    const file = form.get("logo");
    const removeLogo = String(form.get("removeLogo") ?? "false") === "true";
    const corPrimariaRaw = form.get("cor_primaria");
    const corPrimaria =
      typeof corPrimariaRaw === "string" && corPrimariaRaw.trim() ? corPrimariaRaw.trim() : null;

    let nextLogoUrl: string | null | undefined;

    if (removeLogo) {
      nextLogoUrl = null;
    }

    if (file && typeof file !== "string") {
      const maxBytes = 2 * 1024 * 1024;
      const allowed = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
      if (!allowed.has(file.type)) {
        return withNoStore(
          NextResponse.json({ ok: false, error: "Formato inválido. Use PNG, JPG, WEBP ou SVG." }, { status: 400 }),
          start
        );
      }
      if (file.size > maxBytes) {
        return withNoStore(
          NextResponse.json({ ok: false, error: "Logo excede 2MB." }, { status: 400 }),
          start
        );
      }

      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `escolas/${escolaId}/logo/${Date.now()}.${ext}`;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { error: uploadError } = await supabase.storage
        .from("school-branding")
        .upload(path, bytes, { contentType: file.type, upsert: true });

      if (uploadError) {
        return withNoStore(
          NextResponse.json({ ok: false, error: uploadError.message || "Falha no upload do logo." }, { status: 500 }),
          start
        );
      }

      const { data: pub } = supabase.storage.from("school-branding").getPublicUrl(path);
      nextLogoUrl = pub.publicUrl;
    }

    const patch: Record<string, unknown> = {};
    if (typeof nextLogoUrl !== "undefined") patch.logo_url = nextLogoUrl;
    if (corPrimaria) patch.cor_primaria = corPrimaria;

    if (Object.keys(patch).length === 0) {
      return withNoStore(NextResponse.json({ ok: false, error: "Nada para atualizar." }, { status: 400 }), start);
    }

    const { data, error } = await supabase
      .from("escolas")
      .update(patch)
      .eq("id", escolaId)
      .select("id, nome, nif, endereco, logo_url, cor_primaria, plano_atual, created_at, status, aluno_portal_enabled")
      .single();

    if (error) {
      return withNoStore(
        NextResponse.json({ ok: false, error: error.message || "Falha ao atualizar identidade." }, { status: 500 }),
        start
      );
    }

    return withNoStore(NextResponse.json({ ok: true, data }), start);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return withNoStore(NextResponse.json({ ok: false, error: message }, { status: 500 }), start);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeAiAllowedFeatures } from "@/lib/ai/default-features";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { AI_WIDGET_ROLES } from "@/lib/roles/ai-roles";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { DBWithRPC } from "@/types/supabase-augment";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.object({
  schoolId: z.string().trim().min(1),
});

function withNoStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    schoolId: url.searchParams.get("schoolId"),
  });

  if (!parsed.success) {
    return withNoStore(NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 }));
  }

  const supabase = await supabaseServerTyped<DBWithRPC>();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withNoStore(NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 }));
  }

  const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
  const escolaId = await resolveEscolaIdForUser(
    supabase,
    user.id,
    parsed.data.schoolId,
    metaEscolaId ? String(metaEscolaId) : null
  );

  if (!escolaId) {
    return withNoStore(NextResponse.json({ ok: false, error: "Sem permissão para esta escola." }, { status: 403 }));
  }

  const [roleRes, settingsRes, hasRoleRes] = await Promise.all([
    supabase
      .from("escola_users")
      .select("papel")
      .eq("escola_id", escolaId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("ai_school_settings")
      .select("enabled,allowed_features")
      .eq("school_id", escolaId)
      .maybeSingle(),
    supabase.rpc("user_has_role_in_school", {
      p_escola_id: escolaId,
      p_roles: AI_WIDGET_ROLES,
    }),
  ]);

  if (hasRoleRes.error) {
    return withNoStore(NextResponse.json({ ok: false, error: hasRoleRes.error.message }, { status: 500 }));
  }

  const role = String(roleRes.data?.papel ?? "").trim().toLowerCase();
  const allowedFeatures = normalizeAiAllowedFeatures(settingsRes.data?.allowed_features);
  const enabled =
    process.env.AI_ENABLED !== "false" &&
    !settingsRes.error &&
    Boolean(settingsRes.data?.enabled);
  const allowed = enabled && Boolean(hasRoleRes.data);

  return withNoStore(
    NextResponse.json({
      ok: true,
      data: {
        allowed,
        enabled,
        allowedFeatures,
        role: role || (allowed ? "admin" : ""),
        schoolId: escolaId,
        userId: user.id,
      },
    })
  );
}

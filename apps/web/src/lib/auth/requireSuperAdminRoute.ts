import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess";
import { supabaseRouteClient } from "@/lib/supabaseServer";

function resolveMetadataRole(user: {
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
}) {
  const role = user.app_metadata?.role ?? user.user_metadata?.role ?? null;
  return typeof role === "string" ? role : null;
}

export async function requireSuperAdminRoute() {
  const supabase = await supabaseRouteClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }),
    };
  }

  const metadataRole = resolveMetadataRole(user);
  if (isSuperAdminRole(metadataRole)) {
    return { ok: true as const, supabase, user: user as User, role: metadataRole };
  }

  const { data: roles } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const profileRole = (roles?.[0] as { role?: string } | undefined)?.role ?? null;
  if (!isSuperAdminRole(profileRole)) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Somente Super Admin" }, { status: 403 }),
    };
  }

  return { ok: true as const, supabase, user: user as User, role: profileRole };
}

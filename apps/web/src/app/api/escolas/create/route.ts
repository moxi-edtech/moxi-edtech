import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import type { DBWithRPC } from "@/types/supabase-augment";
import { CreateEscolaBodySchema, CreateSchoolError, createSchoolCore, finalizeSchoolAdminAndEmails } from "@/lib/escolas/create-school";
import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess";

export async function POST(request: Request) {
  try {
    const supabase = await supabaseRouteClient<DBWithRPC>();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let role = user?.app_metadata?.role || null;

      if (!role && user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();
        role = profile?.role || null;
      }

      if (!isSuperAdminRole(role)) {
        return NextResponse.json({ ok: false, error: "Somente Super Admin pode criar escolas." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }

    const json = await request.json();
    const parsed = CreateEscolaBodySchema.safeParse(json);
    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message || "Dados inválidos";
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    const core = await createSchoolCore(supabase, parsed.data);
    const effects = await finalizeSchoolAdminAndEmails(request, supabase, parsed.data, core);

    return NextResponse.json({
      ...core.payload,
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

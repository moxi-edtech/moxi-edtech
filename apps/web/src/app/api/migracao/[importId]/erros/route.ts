import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { userHasAccessToEscola } from "../../auth-helpers";

export async function GET(_req: Request, { params }: { params: Promise<{ importId: string }> }) {
  const { importId } = await params;
  const supa = await createRouteClient();
  const { data: userRes } = await supa.auth.getUser();
  const authUser = userRes?.user;
  if (!authUser) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!adminUrl || !serviceKey) {
    return NextResponse.json({ error: "SUPABASE configuration missing" }, { status: 500 });
  }
  const admin = createAdminClient<Database>(adminUrl, serviceKey);

  // Resolve escola da importação
  const { data: im } = await admin
    .from("import_migrations")
    .select("escola_id")
    .eq("id", importId)
    .maybeSingle();
  const escolaId = (im as any)?.escola_id as string | undefined;
  if (!escolaId) return NextResponse.json({ errors: [] });

  const hasAccess = await userHasAccessToEscola(admin, escolaId, authUser.id);
  if (!hasAccess) return NextResponse.json({ error: "Sem vínculo com a escola" }, { status: 403 });

  const { data, error } = await admin
    .from("import_errors")
    .select("row_number, column_name, message, raw_value")
    .eq("import_id", importId)
    .order("row_number", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ errors: data ?? [] });
}

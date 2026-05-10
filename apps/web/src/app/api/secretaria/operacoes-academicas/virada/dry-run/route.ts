import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { buildCutoverHealthReport } from "@/lib/operacoes-academicas/cutover-health";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  const supabase = await supabaseServerTyped<Database>();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const escolaId = await resolveEscolaIdForUser(supabase, user.id);
  if (!escolaId) {
    return NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 403 });
  }

  const report = await buildCutoverHealthReport(supabase, escolaId);

  return NextResponse.json({
    ok: true,
    dry_run: true,
    can_execute: report.can_cutover,
    status: report.status,
    blockers: report.blockers,
    warnings: report.warnings,
    report,
  });
}

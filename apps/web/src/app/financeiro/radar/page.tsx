import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { resolveAcademicYearContext } from "@/lib/academic-year/context";

export const dynamic = 'force-dynamic';

export default async function RadarRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ ano_letivo_id?: string | string[] }>;
}) {
  const supabase = await supabaseServer();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  
  let escolaId: string | null = null;
  if (user) {
    const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
    escolaId = await resolveEscolaIdForUser(
      supabase as Parameters<typeof resolveEscolaIdForUser>[0],
      user.id,
      null,
      metaEscolaId ? String(metaEscolaId) : null
    );
  }

  if (escolaId) {
    const params = await searchParams;
    const requested = Array.isArray(params.ano_letivo_id)
      ? params.ano_letivo_id[0]
      : params.ano_letivo_id;
    const context = await resolveAcademicYearContext(supabase as any, {
      userId: user?.id ?? "",
      requestedAcademicYearId: requested,
      operation: "READ",
    });
    redirect(`/escola/${escolaId}/financeiro/radar?ano_letivo_id=${encodeURIComponent(context.anoLetivoId)}`);
  }

  redirect("/");
}

// apps/web/src/app/secretaria/balcao/page.tsx
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { notFound } from "next/navigation";
import BalcaoPageClient from "./BalcaoPageClient";
import AlunoPerfilPage from "@/components/aluno/AlunoPerfilPage";
import { Suspense } from "react";

export default async function BalcaoPage({
  searchParams,
}: {
  searchParams?: Promise<{ alunoId?: string; action?: string }>;
}) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return notFound();
  }

  const escolaId = await resolveEscolaIdForUser(supabase, user.id);
  if (!escolaId) {
    return notFound();
  }

  const { data: escolaInfo } = await supabase
    .from("escolas")
    .select("slug")
    .eq("id", escolaId)
    .maybeSingle();
  const escolaParam = escolaInfo?.slug ? String(escolaInfo.slug) : escolaId;

  const query = searchParams ? await searchParams : {};
  const profileAlunoId = query.action === "profile" && query.alunoId ? query.alunoId : null;

  return (
    <BalcaoPageClient
      escolaId={escolaId}
      escolaParam={escolaParam}
      profileAlunoId={profileAlunoId}
      profileDossier={profileAlunoId ? (
        <Suspense fallback={<div role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">A carregar ficha integral do aluno...</div>}>
          <AlunoPerfilPage escolaId={escolaId} alunoId={profileAlunoId} role="secretaria" workspace />
        </Suspense>
      ) : null}
    />
  );
}

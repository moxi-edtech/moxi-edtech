import ProfessorPortalLayout from "@/components/professor/layout/ProfessorPortalLayout";
import { requireSchoolActive } from "@/lib/auth/requireSchoolActive";
import { isRefreshTokenNotFoundError } from "@/lib/auth/isRefreshTokenNotFoundError";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaParam } from "@/lib/tenant/resolveEscolaParam";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  manifest: "/manifest-professor.json",
};

const PROFESSOR_ALLOWED_ROLES = new Set([
  "professor",
  "admin",
  "admin_escola",
  "staff_admin",
  "super_admin",
  "global_admin",
  "formador",
]);

export default async function ProfessorEscolaLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireSchoolActive(id);

  const supabase = await supabaseServer();
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] = null;
  try {
    const userResult = await supabase.auth.getUser();
    user = userResult.data.user;
  } catch (error) {
    if (isRefreshTokenNotFoundError(error)) {
      redirect("/auth-recover?next=/redirect");
    }
    throw error;
  }

  if (!user) {
    redirect("/redirect");
  }

  const resolved = await resolveEscolaParam(supabase, id);
  const escolaId = resolved.escolaId ?? id;

  const [{ data: vinculos }, { data: profiles }] = await Promise.all([
    supabase
      .from("escola_users")
      .select("papel, role")
      .eq("escola_id", escolaId)
      .eq("user_id", user.id)
      .limit(10),
    supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const roles = [
    ...(vinculos ?? []).map((vinculo) => vinculo.papel ?? vinculo.role ?? null),
    profiles?.[0]?.role ?? null,
  ].filter(Boolean);

  if (!roles.some((role) => PROFESSOR_ALLOWED_ROLES.has(String(role)))) {
    redirect(`/escola/${id}`);
  }

  return <ProfessorPortalLayout>{children}</ProfessorPortalLayout>;
}

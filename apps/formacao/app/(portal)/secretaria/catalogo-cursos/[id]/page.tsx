import { redirect } from "next/navigation";
import { getFormacaoAuthContext } from "@/lib/auth-context";
import CourseCockpitClient from "@/components/secretaria/CourseCockpitClient";

export const dynamic = "force-dynamic";

export default async function CourseCockpitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const auth = await getFormacaoAuthContext();
  if (!auth) redirect("/login");

  const allowedRoles = ["formacao_secretaria", "formacao_admin", "super_admin", "global_admin"];
  if (!allowedRoles.includes(String(auth.role))) {
    redirect("/forbidden");
  }

  return <CourseCockpitClient courseId={id} />;
}

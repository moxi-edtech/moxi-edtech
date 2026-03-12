import AppShell from "@/components/layout/klasse/AppShell";
import { requireSchoolActive } from "@/lib/auth/requireSchoolActive";

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireSchoolActive(id);

  return <AppShell>{children}</AppShell>;
}

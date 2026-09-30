import AppShell from "@/components/layout/klasse/AppShell";
import { requireSchoolActive } from "@/lib/auth/requireSchoolActive";

export default async function PortalLayout({
  children,
  modal,
  params,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireSchoolActive(id);

  return (
    <AppShell>
      {children}
      {modal}
    </AppShell>
  );
}

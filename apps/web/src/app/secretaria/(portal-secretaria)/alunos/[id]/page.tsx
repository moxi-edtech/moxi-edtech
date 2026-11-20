import { PORTAL_PAGE_HORIZONTAL_INSET } from "@/lib/layout/portal-page";
import AlunoPerfilPage from "@/components/aluno/AlunoPerfilPage";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ ano?: string }> }) {
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const selectedYear = query.ano && /^\d{4}$/.test(query.ano) ? Number(query.ano) : null;
  return (
    <div className="space-y-4">
      <div className={`${PORTAL_PAGE_HORIZONTAL_INSET} pt-8`}>
      <DashboardHeader
        title="Perfil do Aluno"
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Secretaria", href: "/secretaria" },
          { label: "Alunos", href: "/secretaria/alunos" },
          { label: "Perfil" },
        ]}
      />
      </div>
      <AlunoPerfilPage alunoId={id} role="secretaria" selectedYear={selectedYear} />
    </div>
  );
}

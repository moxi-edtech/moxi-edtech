import AlunoPerfilPage from "@/components/aluno/AlunoPerfilPage";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="space-y-4">
      <DashboardHeader
        title="Perfil do Aluno"
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Secretaria", href: "/secretaria" },
          { label: "Alunos", href: "/secretaria/alunos" },
          { label: "Perfil" },
        ]}
      />
      <AlunoPerfilPage alunoId={id} role="secretaria" />
    </div>
  );
}

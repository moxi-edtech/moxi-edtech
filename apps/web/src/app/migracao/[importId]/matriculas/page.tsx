import { MatriculasEmMassa } from "~/components/migracao/MatriculasEmMassa";

interface PageProps {
  params: { importId: string };
  searchParams?: Record<string, string | string[] | undefined>;
}

export default function MatriculasMassaPage({ params, searchParams }: PageProps) {
  const escolaIdParam = searchParams?.escolaId;
  const escolaId = Array.isArray(escolaIdParam) ? escolaIdParam[0] : escolaIdParam || "";

  return (
    <main className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Matrícula em massa</h1>
        <p className="text-sm text-muted-foreground">
          Vincule os alunos importados no lote {params.importId} às turmas definitivas.
        </p>
      </div>

      <MatriculasEmMassa importId={params.importId} escolaId={escolaId} />
    </main>
  );
}

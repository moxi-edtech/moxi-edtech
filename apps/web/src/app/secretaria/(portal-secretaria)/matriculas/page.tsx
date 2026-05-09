import { redirect } from "next/navigation";

export default async function Page({ params }: { params?: Promise<{ id?: string }> }) {
  const resolvedParams = params ? await params : null;
  const escolaParam = resolvedParams?.id;

  redirect(escolaParam ? `/escola/${escolaParam}/secretaria/admissoes` : "/secretaria/admissoes");
}

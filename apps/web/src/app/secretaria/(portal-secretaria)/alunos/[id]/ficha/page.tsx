import { headers } from "next/headers";
import { notFound } from "next/navigation";
import FichaAluno360Client from "@/components/secretaria/FichaAluno360Client";

type Params = { id: string };

export default async function FichaAlunoPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const cookie = (await headers()).get("cookie") ?? "";
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  let aluno = null;
  let error = null;

  try {
    const res = await fetch(`${baseUrl}/api/secretaria/alunos/${encodeURIComponent(id)}`, {
      cache: "no-store",
      headers: { cookie },
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      throw new Error(json?.error || `HTTP ${res.status}`);
    }
    
    const json = await res.json().catch(() => null);
    if (!json?.ok || !json.item) {
      throw new Error(json?.error || 'Resposta da API inválida');
    }

    aluno = json.item;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return <FichaAluno360Client aluno={aluno} error={error} />;
}

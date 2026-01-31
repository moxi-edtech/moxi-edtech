import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";

const searchSchema = z.object({
  query: z.string().min(1),
});

export async function GET(request: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");

    const parsed = searchSchema.safeParse({ query });
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues?.[0]?.message || "Query inválida" }, { status: 400 });
    }

    const searchQuery = parsed.data.query.toLowerCase();

    const { data: alunos, error } = await supabase
      .from("alunos")
      .select(
        `
        id, nome, nome_completo, bi_numero, numero_processo, foto_url,
        matriculas(
            id, status, ano_letivo,
            turmas(nome)
        )
        `
      )
      .eq("escola_id", escolaId)
      .or(
        `nome.ilike.%${searchQuery}%,nome_completo.ilike.%${searchQuery}%,bi_numero.ilike.%${searchQuery}%,numero_processo.ilike.%${searchQuery}%`
      )
      .limit(10); // Limitar para não sobrecarregar

    if (error) {
      console.error("Erro na busca de alunos:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const formattedAlunos = (alunos || []).map((aluno: any) => {
      const matriculaAtiva = aluno.matriculas.find((m: any) => ['ativa', 'ativo'].includes(m.status));
      return {
        id: aluno.id,
        nome: aluno.nome_completo || aluno.nome,
        numero_processo: aluno.numero_processo,
        bi_numero: aluno.bi_numero,
        foto_url: aluno.foto_url,
        turma: matriculaAtiva?.turmas?.nome || 'N/A',
        matricula_id: matriculaAtiva?.id || null,
      };
    });

    return NextResponse.json({ ok: true, alunos: formattedAlunos });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer"; // Ajusta o import conforme o teu projeto

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // 1. Desembrulhar params (Obrigatório no Next.js 15)
  const { id: escolaId } = await context.params;

  try {
    const supabase = await supabaseServer();

    // 2. Autenticação Básica
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    // 3. Buscar Cursos da Escola
    const { data: cursos, error } = await supabase
      .from("cursos")
      .select("id, nome, codigo")
      .eq("escola_id", escolaId)
      .order("nome");

    if (error) {
      throw error;
    }

    // 4. Calcular Estatísticas para cada Curso
    const coursesWithStats = await Promise.all(
      cursos.map(async (curso) => {
        
        // Contar Classes (vinculadas a este curso)
        // Nota: Depende da tua modelagem. Se classes não tiverem curso_id, ajusta aqui.
        const { count: totalClasses } = await supabase
          .from("classes")
          .select("*", { count: "exact", head: true })
          .eq("escola_id", escolaId)
          .eq("curso_id", curso.id); // Assume que classes têm curso_id

        // Contar Turmas
        const { count: totalTurmas } = await supabase
          .from("turmas")
          .select("*", { count: "exact", head: true })
          .eq("escola_id", escolaId)
          .eq("curso_id", curso.id); // Assume que turmas têm curso_id

        // Contar Alunos Ativos (Matrículas -> Turmas -> Curso)
        // Precisamos de um inner join. Sintaxe do Supabase para joins:
        const { count: totalAlunos } = await supabase
          .from("matriculas")
          .select("id, turmas!inner(curso_id)", { count: "exact", head: true })
          .eq("escola_id", escolaId)
          .eq("status", "ativa") 
          .eq("turmas.curso_id", curso.id);

        return {
          ...curso,
          total_classes: totalClasses || 0,
          total_turmas: totalTurmas || 0,
          total_alunos: totalAlunos || 0
        };
      })
    );

    return NextResponse.json({ ok: true, data: coursesWithStats });

  } catch (error: any) {
    console.error("Erro API Cursos Stats:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Erro interno" },
      { status: 500 }
    );
  }
}
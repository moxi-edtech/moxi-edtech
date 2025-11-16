import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    const { data: prof } = await supabase
      .from('profiles')
      .select('escola_id')
      .order('created_at', { ascending: false })
      .limit(1);
    const escolaId = (prof?.[0] as any)?.escola_id as string | undefined;
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 });
    }

    const body = await req.json();
    const { origin_turma_id, destination_turma_id, aluno_ids } = body;

    if (!origin_turma_id || !destination_turma_id || !aluno_ids || !aluno_ids.length) {
      return NextResponse.json({ ok: false, error: 'Campos obrigatórios em falta' }, { status: 400 });
    }

    // Get the destination turma to get the session_id
    const { data: destinationTurma } = await supabase
      .from('turmas')
      .select('session_id')
      .eq('id', destination_turma_id)
      .single();

    if (!destinationTurma) {
      return NextResponse.json({ ok: false, error: 'Turma de destino não encontrada' }, { status: 400 });
    }

    const newMatriculas = aluno_ids.map((aluno_id: string) => ({
      aluno_id,
      turma_id: destination_turma_id,
      session_id: destinationTurma.session_id,
      escola_id: escolaId,
      status: 'ativo',
    }));

    const { error: insertError } = await supabase.from('matriculas').insert(newMatriculas);

    if (insertError) {
      return NextResponse.json({ ok: false, error: insertError.message }, { status: 400 });
    }

    // Optionally, update the status of the old matriculas
    const { error: updateError } = await supabase
      .from('matriculas')
      .update({ status: 'transferido' })
      .eq('turma_id', origin_turma_id)
      .in('aluno_id', aluno_ids);

    if (updateError) {
      // This is not a critical error, so we just log it
      console.error("Failed to update old matriculas", updateError);
    }

    return NextResponse.json({ ok: true });

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

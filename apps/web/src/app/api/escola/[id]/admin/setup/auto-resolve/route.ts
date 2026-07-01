import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServerTyped } from '@/lib/supabaseServer';
import { assertEscolaAccessAndPermissions } from '@/lib/api/assertEscolaAccessAndPermissions';
import { PAPEL_GROUP_ESCOLA_ADMIN_SETUP } from '@/lib/permissions';
import type { Database } from '~types/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BodySchema = z.object({
  action: z.enum(['teachers', 'horarios']),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: requestedEscolaId } = await params;
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    const access = await assertEscolaAccessAndPermissions({
      client: supabase as any,
      userId: user.id,
      requestedEscolaId,
      allowedPapels: PAPEL_GROUP_ESCOLA_ADMIN_SETUP,
      route: '/api/escola/[id]/admin/setup/auto-resolve',
    });
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error, code: access.code }, { status: access.status });
    }
    const escolaId = access.escolaId;

    const body = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Ação inválida.' }, { status: 400 });
    }

    const { action } = parsed.data;

    if (action === 'teachers') {
      const { data, error } = await (supabase as any).rpc('auto_assign_school_teachers_by_specialty', {
        p_escola_id: escolaId,
      });

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      }

      return NextResponse.json({
        ok: true,
        message: `Atribuição concluída. ${data?.assigned_count || 0} professores vinculados automaticamente.`,
        details: data?.assignments || [],
      });
    }

    if (action === 'horarios') {
      const { data: turmas, error: turmasErr } = await supabase
        .from('turmas')
        .select('id, nome, turno')
        .eq('escola_id', escolaId);

      if (turmasErr) return NextResponse.json({ ok: false, error: turmasErr.message }, { status: 400 });

      let createdCount = 0;
      const details: string[] = [];

      for (const turma of turmas || []) {
        const { data: publishedVer } = await supabase
          .from('horario_versoes')
          .select('id')
          .eq('escola_id', escolaId)
          .eq('turma_id', turma.id)
          .eq('status', 'publicada')
          .limit(1)
          .maybeSingle();

        if (publishedVer) continue;

        const { data: versionId, error: verErr } = await (supabase as any).rpc('ensure_horario_versao', {
          p_escola_id: escolaId,
          p_turma_id: turma.id,
          p_versao_id: undefined,
          p_status: 'draft',
        });

        if (verErr || !versionId) continue;

        const { data: subjects } = await supabase
          .from('turma_disciplinas')
          .select('id, curso_matriz_id, professor_id, entra_no_horario')
          .eq('escola_id', escolaId)
          .eq('turma_id', turma.id);

        const activeSubjects = (subjects || []).filter((s) => s.entra_no_horario !== false);
        if (activeSubjects.length === 0) continue;

        const rawTurno = turma.turno?.toString().toUpperCase();
        const mappedTurnoId = rawTurno === 'M' ? 'matinal' : rawTurno === 'T' ? 'tarde' : rawTurno === 'N' ? 'noite' : 'matinal';

        const { data: slots } = await supabase
          .from('horario_slots')
          .select('id, dia_semana, ordem, turno_id, is_intervalo')
          .eq('escola_id', escolaId)
          .eq('turno_id', mappedTurnoId)
          .eq('is_intervalo', false)
          .order('dia_semana', { ascending: true })
          .order('ordem', { ascending: true });

        if (!slots || slots.length === 0) continue;

        const itemsToInsert: any[] = [];
        let subjectIndex = 0;

        for (const slot of slots) {
          const subject = activeSubjects[subjectIndex];
          if (!subject) break;

          const { data: cm } = await supabase
            .from('curso_matriz')
            .select('disciplina_id')
            .eq('id', subject.curso_matriz_id)
            .maybeSingle();

          if (cm?.disciplina_id) {
            itemsToInsert.push({
              escola_id: escolaId,
              turma_id: turma.id,
              disciplina_id: cm.disciplina_id,
              professor_id: subject.professor_id ?? null,
              slot_id: slot.id,
              versao_id: String(versionId),
            });
          }

          subjectIndex = (subjectIndex + 1) % activeSubjects.length;
        }

        if (itemsToInsert.length > 0) {
          await supabase
            .from('quadro_horarios')
            .delete()
            .eq('escola_id', escolaId)
            .eq('turma_id', turma.id)
            .eq('versao_id', String(versionId));

          const { error: insertErr } = await (supabase as any)
            .from('quadro_horarios')
            .insert(itemsToInsert);

          if (!insertErr) {
            await supabase
              .from('horario_versoes')
              .update({ status: 'publicada', publicado_em: new Date().toISOString() })
              .eq('id', String(versionId));

            createdCount++;
            details.push(turma.nome);
          }
        }
      }

      return NextResponse.json({
        ok: true,
        message: `Quadro de horários gerado e publicado para ${createdCount} turmas.`,
        details,
      });
    }

    return NextResponse.json({ ok: false, error: 'Ação não suportada.' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

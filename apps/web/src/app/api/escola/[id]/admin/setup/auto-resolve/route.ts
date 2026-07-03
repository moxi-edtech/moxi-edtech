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

        let { data: slots } = await supabase
          .from('horario_slots')
          .select('id, dia_semana, ordem, turno_id, is_intervalo')
          .eq('escola_id', escolaId)
          .eq('turno_id', mappedTurnoId)
          .order('dia_semana', { ascending: true })
          .order('ordem', { ascending: true });

        if (!slots || slots.length === 0) {
          const defaultSlotsToInsert: any[] = [];
          
          const timeConfigs = mappedTurnoId === 'tarde' 
            ? [
                { ordem: 1, inicio: '13:00:00', fim: '13:50:00', is_intervalo: false },
                { ordem: 2, inicio: '13:50:00', fim: '14:40:00', is_intervalo: false },
                { ordem: 3, inicio: '14:40:00', fim: '15:30:00', is_intervalo: false },
                { ordem: 4, inicio: '15:30:00', fim: '15:50:00', is_intervalo: true },
                { ordem: 5, inicio: '15:50:00', fim: '16:40:00', is_intervalo: false },
                { ordem: 6, inicio: '16:40:00', fim: '17:30:00', is_intervalo: false }
              ]
            : mappedTurnoId === 'noite'
            ? [
                { ordem: 1, inicio: '18:00:00', fim: '18:50:00', is_intervalo: false },
                { ordem: 2, inicio: '18:50:00', fim: '19:40:00', is_intervalo: false },
                { ordem: 3, inicio: '19:40:00', fim: '20:30:00', is_intervalo: false },
                { ordem: 4, inicio: '20:30:00', fim: '20:45:00', is_intervalo: true },
                { ordem: 5, inicio: '20:45:00', fim: '21:35:00', is_intervalo: false },
                { ordem: 6, inicio: '21:35:00', fim: '22:25:00', is_intervalo: false }
              ]
            : [
                { ordem: 1, inicio: '07:30:00', fim: '08:20:00', is_intervalo: false },
                { ordem: 2, inicio: '08:20:00', fim: '09:10:00', is_intervalo: false },
                { ordem: 3, inicio: '09:10:00', fim: '10:00:00', is_intervalo: false },
                { ordem: 4, inicio: '10:00:00', fim: '10:20:00', is_intervalo: true },
                { ordem: 5, inicio: '10:20:00', fim: '11:10:00', is_intervalo: false },
                { ordem: 6, inicio: '11:10:00', fim: '12:00:00', is_intervalo: false }
              ];

          for (let dia = 1; dia <= 5; dia++) {
            for (const cfg of timeConfigs) {
              defaultSlotsToInsert.push({
                escola_id: escolaId,
                turno_id: mappedTurnoId,
                dia_semana: dia,
                ordem: cfg.ordem,
                inicio: cfg.inicio,
                fim: cfg.fim,
                is_intervalo: cfg.is_intervalo
              });
            }
          }

          const { data: insertedSlots, error: insertSlotsErr } = await supabase
            .from('horario_slots')
            .insert(defaultSlotsToInsert)
            .select('id, dia_semana, ordem, turno_id, is_intervalo');

          if (insertSlotsErr || !insertedSlots) {
            continue;
          }
          slots = insertedSlots;
        }

        const activeSlots = (slots || []).filter((s) => s.is_intervalo === false);
        if (activeSlots.length === 0) continue;

        const itemsToInsert: any[] = [];
        let subjectIndex = 0;

        for (const slot of activeSlots) {
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

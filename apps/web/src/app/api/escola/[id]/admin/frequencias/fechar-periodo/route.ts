import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { supabaseServerTyped } from '@/lib/supabaseServer';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import type { Database } from '~types/supabase';
import { buildPautaGeralPayload, renderPautaGeralStream } from '@/lib/pedagogico/pauta-geral';
import { enqueueOutboxEvent, markOutboxEventFailed, markOutboxEventProcessed } from '@/lib/outbox';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const Body = z.object({
  turma_id: z.string().uuid(),
  periodo_letivo_id: z.string().uuid(),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: requestedEscolaId } = await params;
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const turmaId = searchParams.get('turma_id');
    const periodoLetivoId = searchParams.get('periodo_letivo_id');

    if (!turmaId || !periodoLetivoId) {
      return NextResponse.json({ ok: false, error: 'Parâmetros inválidos.' }, { status: 400 });
    }

    const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, requestedEscolaId);
    const effectiveEscolaId = userEscolaId ?? requestedEscolaId;

    if (userEscolaId && userEscolaId !== requestedEscolaId) {
      return NextResponse.json({ ok: false, error: 'Acesso negado a esta escola.' }, { status: 403 });
    }

    const { data: hasAdminRole, error: rolesError } = await supabase
      .rpc('user_has_role_in_school', {
        p_escola_id: requestedEscolaId,
        p_roles: ['admin_escola', 'secretaria', 'admin'],
      });

    if (rolesError) {
      console.error('Error fetching user roles:', rolesError);
      return NextResponse.json({ ok: false, error: 'Erro ao verificar permissões.' }, { status: 500 });
    }

    let isProfessorAssigned = false;
    if (!hasAdminRole) {
      const { data: professor } = await supabase
        .from('professores')
        .select('id')
        .eq('profile_id', user.id)
        .eq('escola_id', effectiveEscolaId)
        .maybeSingle();
      const professorId = (professor as any)?.id as string | undefined;
      if (!professorId) {
        return NextResponse.json({ ok: false, error: 'Você não tem permissão para executar esta ação.' }, { status: 403 });
      }

      const { data: turmaDisciplina } = await supabase
        .from('turma_disciplinas')
        .select('id')
        .eq('escola_id', effectiveEscolaId)
        .eq('turma_id', turmaId)
        .eq('professor_id', professorId)
        .maybeSingle();
      isProfessorAssigned = Boolean(turmaDisciplina);

      if (!isProfessorAssigned) {
        const { data: tdp } = await supabase
          .from('turma_disciplinas_professores')
          .select('id')
          .eq('escola_id', effectiveEscolaId)
          .eq('turma_id', turmaId)
          .eq('professor_id', professorId)
          .maybeSingle();
        isProfessorAssigned = Boolean(tdp);
      }

      if (!isProfessorAssigned) {
        return NextResponse.json({ ok: false, error: 'Você não tem permissão para executar esta ação.' }, { status: 403 });
      }
    }

    const { data: statusRow, error } = await supabase
      .from('frequencia_status_periodo')
      .select('id')
      .eq('escola_id', effectiveEscolaId)
      .eq('turma_id', turmaId)
      .eq('periodo_letivo_id', periodoLetivoId)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error checking fechamento status:', error);
      return NextResponse.json({ ok: false, error: 'Erro ao verificar fechamento.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, closed: Boolean(statusRow) }, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('Error in fechar-periodo GET API:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let supabase: any = null;
  const outboxEventId: string | null = null;
  try {
    const { id: requestedEscolaId } = await params;
    supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    const parse = Body.safeParse(await req.json().catch(() => ({})));
    if (!parse.success) {
      return NextResponse.json({ ok: false, error: 'Dados inválidos.', issues: parse.error.issues }, { status: 400 });
    }

    const idempotencyKey = req.headers.get('idempotency-key');
    if (!idempotencyKey) {
      return NextResponse.json({ ok: false, error: 'Idempotency-Key header is required' }, { status: 400 });
    }

    const { turma_id, periodo_letivo_id } = parse.data;

    const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, requestedEscolaId);
    const effectiveEscolaId = userEscolaId ?? requestedEscolaId;

    if (userEscolaId && userEscolaId !== requestedEscolaId) {
      return NextResponse.json({ ok: false, error: 'Acesso negado a esta escola.' }, { status: 403 });
    }

    const { data: hasAdminRole, error: rolesError } = await supabase
      .rpc('user_has_role_in_school', {
        p_escola_id: requestedEscolaId,
        p_roles: ['admin_escola', 'secretaria', 'admin'],
      });

    if (rolesError) {
      console.error('Error fetching user roles:', rolesError);
      return NextResponse.json({ ok: false, error: 'Erro ao verificar permissões.' }, { status: 500 });
    }

    let isProfessorAssigned = false;
    if (!hasAdminRole) {
      const { data: professor } = await supabase
        .from('professores')
        .select('id')
        .eq('profile_id', user.id)
        .eq('escola_id', effectiveEscolaId)
        .maybeSingle();
      const professorId = (professor as any)?.id as string | undefined;
      if (!professorId) {
        return NextResponse.json({ ok: false, error: 'Você não tem permissão para executar esta ação.' }, { status: 403 });
      }

      const { data: turmaDisciplina } = await supabase
        .from('turma_disciplinas')
        .select('id')
        .eq('escola_id', effectiveEscolaId)
        .eq('turma_id', turma_id)
        .eq('professor_id', professorId)
        .maybeSingle();
      isProfessorAssigned = Boolean(turmaDisciplina);

      if (!isProfessorAssigned) {
      const { data: tdp } = await supabase
        .from('turma_disciplinas_professores')
        .select('id')
        .eq('escola_id', effectiveEscolaId)
          .eq('turma_id', turma_id)
          .eq('professor_id', professorId)
          .maybeSingle();
        isProfessorAssigned = Boolean(tdp);
      }

    if (!isProfessorAssigned) {
      return NextResponse.json({ ok: false, error: 'Você não tem permissão para executar esta ação.' }, { status: 403 });
    }
  }

    // A lógica de negócio foi movida para a RPC `fechar_periodo_academico`.
    // A RPC irá travar tanto as frequências quanto as notas de forma atômica e auditada.
    const { error } = await supabase.rpc('fechar_periodo_academico', {
      p_escola_id: effectiveEscolaId,
      p_turma_id: turma_id,
      p_periodo_letivo_id: periodo_letivo_id,
    });

    if (error) {
      console.error('Error calling fechar_periodo_academico RPC:', error);
      return NextResponse.json({ ok: false, error: 'Erro ao fechar o período.' }, { status: 500 });
    }

    let pdfGenerated = false;
    let pdfError: string | null = null;

    try {
      const { data: existing } = await supabase
        .from('pautas_oficiais')
        .select('id, status')
        .eq('escola_id', effectiveEscolaId)
        .eq('turma_id', turma_id)
        .eq('periodo_letivo_id', periodo_letivo_id)
        .eq('tipo', 'trimestral')
        .maybeSingle();

      if (!existing || existing.status === 'FAILED') {
        const { data: periodo } = await supabase
          .from('periodos_letivos')
          .select('numero')
          .eq('escola_id', effectiveEscolaId)
          .eq('id', periodo_letivo_id)
          .maybeSingle();

        const periodoNumero = periodo?.numero ?? null;
        if (!periodoNumero) {
          throw new Error('Período letivo inválido para pauta oficial.');
        }

        const { data: pautaRow } = await supabase
          .from('pautas_oficiais')
          .upsert({
            escola_id: effectiveEscolaId,
            turma_id: turma_id,
            periodo_letivo_id,
            pdf_path: '',
            hash: randomUUID(),
            tipo: 'trimestral',
            status: 'PROCESSING',
            generated_at: new Date().toISOString(),
          }, { onConflict: 'escola_id,turma_id,periodo_letivo_id,tipo' })
          .select('id')
          .maybeSingle();

        if (!pautaRow?.id) {
          throw new Error('Falha ao iniciar geração da pauta oficial.');
        }

        const payload = await buildPautaGeralPayload({
          supabase,
          escolaId: effectiveEscolaId,
          turmaId: turma_id,
          periodoNumero,
        });

        const pdfStream = await renderPautaGeralStream(payload);
        const pdfPath = `${effectiveEscolaId}/${turma_id}/${periodo_letivo_id}/pauta_geral.pdf`;
        const adminUrl = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
        const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
        const admin = adminUrl && serviceKey ? createAdminClient<Database>(adminUrl, serviceKey) : null;
        const storageClient = (admin ?? supabase) as any;

        const { error: uploadError } = await storageClient.storage
          .from('pautas_oficiais_fechadas')
          .upload(pdfPath, pdfStream, {
            upsert: true,
            contentType: 'application/pdf',
          });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        const { error: updateError } = await supabase
          .from('pautas_oficiais')
          .update({ status: 'SUCCESS', pdf_path: pdfPath, error_message: null })
          .eq('id', pautaRow.id);

        if (updateError) {
          throw new Error(updateError.message);
        }

        pdfGenerated = true;
      }
    } catch (err) {
      pdfError = err instanceof Error ? err.message : String(err);
      console.error('Erro ao gerar pauta oficial:', pdfError);
      await supabase
        .from('pautas_oficiais')
        .update({ status: 'FAILED', error_message: pdfError })
        .eq('escola_id', effectiveEscolaId)
        .eq('turma_id', turma_id)
        .eq('periodo_letivo_id', periodo_letivo_id)
        .eq('tipo', 'trimestral');
    }

    return NextResponse.json({ ok: true, pdf_generated: pdfGenerated, pdf_error: pdfError }, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('Error in fechar-periodo frequencias API:', message);
    if (supabase) {
      await markOutboxEventFailed(supabase, outboxEventId, message).catch(() => null);
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

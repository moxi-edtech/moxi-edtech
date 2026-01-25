import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServerTyped } from '@/lib/supabaseServer';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import type { Database } from '~types/supabase';

export const dynamic = 'force-dynamic';

const turmaSchema = z.object({
  classeId: z.string().uuid(),
  quantidade: z.number().int().min(1).max(10).optional().default(1),
});

const turmaTurnoSchema = z.object({
  classeId: z.string().uuid(),
  turno: z.enum(['M', 'T', 'N']),
  quantidade: z.number().int().min(1).max(10).optional().default(1),
});

const bodySchema = z.object({
  cursoId: z.string().uuid(),
  anoLetivo: z.number().int().min(2020).max(2050),
  turnos: z.array(z.enum(['M', 'T', 'N'])).optional(),
  classes: z.array(turmaSchema).optional(),
  turmas: z.array(turmaTurnoSchema).optional(),
  capacidadeMaxima: z.number().int().min(1).max(80).optional(),
});

const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: requestedEscolaId } = await params;
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, requestedEscolaId);

    if (!userEscolaId || userEscolaId !== requestedEscolaId) {
      return NextResponse.json({ ok: false, error: 'Acesso negado a esta escola.' }, { status: 403 });
    }

    const { data: hasRole, error: rolesError } = await supabase
      .rpc('user_has_role_in_school', {
        p_escola_id: userEscolaId,
        p_roles: ['admin_escola', 'secretaria', 'admin'],
      });

    if (rolesError) {
      return NextResponse.json({ ok: false, error: 'Erro ao verificar permissões.' }, { status: 500 });
    }

    if (!hasRole) {
      return NextResponse.json({ ok: false, error: 'Você não tem permissão para executar esta ação.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Dados inválidos.', issues: parsed.error.issues }, { status: 400 });
    }

    const { cursoId, anoLetivo, turnos, classes, turmas, capacidadeMaxima } = parsed.data;

    const { data: anoLetivoRow } = await supabase
      .from('anos_letivos')
      .select('id')
      .eq('escola_id', userEscolaId)
      .eq('ano', anoLetivo)
      .maybeSingle();

    if (!anoLetivoRow?.id) {
      return NextResponse.json({ ok: false, error: 'Ano letivo não encontrado.' }, { status: 400 });
    }

    const { data: published } = await supabase
      .from('curso_curriculos')
      .select('id')
      .eq('escola_id', userEscolaId)
      .eq('curso_id', cursoId)
      .eq('ano_letivo_id', anoLetivoRow.id)
      .eq('status', 'published')
      .limit(1);

    if (!published || published.length === 0) {
      return NextResponse.json({ ok: false, error: 'Currículo publicado não encontrado.' }, { status: 400 });
    }

    const inserts: any[] = [];
    if (turmas && turmas.length > 0) {
      turmas.forEach((item) => {
        const quantidade = item.quantidade ?? 1;
        const turmaLetters = letters.slice(0, quantidade);
        turmaLetters.forEach((letter) => {
          inserts.push({
            escola_id: userEscolaId,
            curso_id: cursoId,
            classe_id: item.classeId,
            ano_letivo: anoLetivo,
            nome: letter,
            turno: item.turno,
            capacidade_maxima: capacidadeMaxima ?? 35,
            status_validacao: 'ativo',
          });
        });
      });
    } else if (classes && classes.length > 0 && turnos && turnos.length > 0) {
      classes.forEach((cls) => {
        const quantidade = cls.quantidade ?? 1;
        const turmaLetters = letters.slice(0, quantidade);
        turmaLetters.forEach((letter) => {
          turnos.forEach((turno) => {
            inserts.push({
              escola_id: userEscolaId,
              curso_id: cursoId,
              classe_id: cls.classeId,
              ano_letivo: anoLetivo,
              nome: letter,
              turno,
              capacidade_maxima: capacidadeMaxima ?? 35,
              status_validacao: 'ativo',
            });
          });
        });
      });
    }

    if (inserts.length === 0) {
      return NextResponse.json({ ok: false, error: 'Nenhuma turma para gerar.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('turmas')
      .upsert(inserts, {
        onConflict: 'escola_id,curso_id,classe_id,ano_letivo,nome,turno',
        ignoreDuplicates: false,
      })
      .select('id, classe_id, turno, nome');

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

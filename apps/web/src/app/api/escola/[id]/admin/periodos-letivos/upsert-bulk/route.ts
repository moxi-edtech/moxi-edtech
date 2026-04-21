import { NextResponse } from 'next/server';
import { supabaseServerTyped } from '@/lib/supabaseServer';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import { z } from 'zod';
import type { Database } from '~types/supabase';

export const dynamic = 'force-dynamic';

const periodoSchema = z.object({
  id: z.string().uuid().optional(),
  ano_letivo_id: z.string().uuid(),
  tipo: z.enum(['TRIMESTRE', 'SEMESTRE', 'BIMESTRE']),
  numero: z.number().int().min(1).max(4),
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  trava_notas_em: z.string().datetime().optional().nullable(),
});

const upsertBulkSchema = z.array(periodoSchema);

type PeriodoInput = z.infer<typeof periodoSchema>;

const parseIsoDate = (value: string): Date | null => {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatIsoDate = (date: Date) => date.toISOString().slice(0, 10);

const addDaysUtc = (date: Date, days: number) => {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
};

const normalizePeriodosByAnoRange = (
  periodos: PeriodoInput[],
  anoDataInicio: string,
  anoDataFim: string
): PeriodoInput[] => {
  const startDate = parseIsoDate(anoDataInicio);
  const endDate = parseIsoDate(anoDataFim);
  if (!startDate || !endDate || endDate < startDate || periodos.length === 0) return periodos;

  const sorted = [...periodos].sort((a, b) => a.numero - b.numero);
  const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  const parts = sorted.length;
  const baseSize = Math.floor(totalDays / parts);
  let remainder = totalDays % parts;

  let cursor = startDate;
  return sorted.map((periodo) => {
    const segmentSize = baseSize + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);

    const segmentStart = cursor;
    const segmentEnd = addDaysUtc(segmentStart, Math.max(0, segmentSize - 1));
    cursor = addDaysUtc(segmentEnd, 1);

    return {
      ...periodo,
      data_inicio: formatIsoDate(segmentStart),
      data_fim: formatIsoDate(segmentEnd),
    };
  });
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    const { id: requestedEscolaId } = await (params as any);
    const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, requestedEscolaId);

    if (!userEscolaId) {
      return NextResponse.json({ ok: false, error: 'Acesso negado a esta escola.' }, { status: 403 });
    }

    const { data: hasRole, error: rolesError } = await (supabase as any)
      .rpc('user_has_role_in_school', {
        p_escola_id: userEscolaId,
        p_roles: ['admin_escola', 'secretaria', 'admin'],
      });

    if (rolesError) {
      console.error('Error fetching user roles:', rolesError);
      return NextResponse.json({ ok: false, error: 'Erro ao verificar permissões.' }, { status: 500 });
    }

    if (!hasRole) {
      return NextResponse.json({ ok: false, error: 'Você não tem permissão para executar esta ação.' }, { status: 403 });
    }

    const body = await req.json();
    const parseResult = upsertBulkSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ ok: false, error: 'Dados inválidos.', issues: parseResult.error.issues }, { status: 400 });
    }

    const firstAnoLetivoId = parseResult.data[0]?.ano_letivo_id;
    const mixedAnoLetivoIds = parseResult.data.some((item) => item.ano_letivo_id !== firstAnoLetivoId);
    if (mixedAnoLetivoIds) {
      return NextResponse.json({ ok: false, error: 'Todos os períodos devem pertencer ao mesmo ano letivo.' }, { status: 400 });
    }
    let normalizedPayload: PeriodoInput[] = parseResult.data;

    if (firstAnoLetivoId) {
      const { data: anoRows, error: anoError } = await (supabase as any)
        .from('anos_letivos')
        .select('id, data_inicio, data_fim')
        .eq('escola_id', userEscolaId)
        .eq('id', firstAnoLetivoId)
        .limit(1);

      if (anoError) {
        console.error('Error fetching ano_letivo range:', anoError);
        return NextResponse.json({ ok: false, error: 'Erro ao carregar intervalo do ano letivo.' }, { status: 500 });
      }

      const ano = Array.isArray(anoRows) ? anoRows[0] : null;
      if (ano?.data_inicio && ano?.data_fim) {
        normalizedPayload = normalizePeriodosByAnoRange(parseResult.data, ano.data_inicio, ano.data_fim);
      }
    }

    const { data, error } = await (supabase as any).rpc('upsert_bulk_periodos_letivos', {
      p_escola_id: userEscolaId,
      p_periodos_data: normalizedPayload,
    });

    if (error) {
      console.error('Error upserting periodos letivos:', error);
      return NextResponse.json({ ok: false, error: 'Erro ao salvar os períodos letivos.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data }, { status: 200 });

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('Error in periodos-letivos upsert-bulk API:', message);
    return NextResponse.json({ 
      ok: false, 
      error: message,
      stack: e instanceof Error ? e.stack : undefined 
    }, { status: 500 });
  }
}

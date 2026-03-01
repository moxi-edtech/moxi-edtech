import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { isSuperAdminRole } from '@/lib/auth/requireSuperAdminAccess';
import { recordAuditServer } from '@/lib/audit';

export const dynamic = 'force-dynamic';

type BillingHistoricoStatus = 'pendente' | 'confirmado' | 'falhado';

function parseMonthBounds(periodo: string | null) {
  if (!periodo || !/^\d{4}-\d{2}$/.test(periodo)) {
    return null;
  }

  const start = new Date(`${periodo}-01T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) {
    return null;
  }

  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function toCsvCell(value: unknown) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

async function checkSuperAdmin(supabase: Awaited<ReturnType<typeof supabaseServer>>, userId: string) {
  const { data: rows } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  const role = (rows?.[0] as { role?: string } | undefined)?.role;
  return isSuperAdminRole(role);
}

export async function GET(req: NextRequest) {
  try {
    const s = await supabaseServer();
    const { data: sessionData } = await s.auth.getUser();
    const user = sessionData?.user;

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    if (!(await checkSuperAdmin(s, user.id))) {
      return NextResponse.json({ ok: false, error: 'Somente Super Admin' }, { status: 403 });
    }

    const url = req.nextUrl;
    const escolaId = url.searchParams.get('escola_id') || '';
    const status = (url.searchParams.get('status') || '').trim();
    const periodo = parseMonthBounds(url.searchParams.get('periodo'));
    const format = (url.searchParams.get('format') || 'json').toLowerCase();

    const page = Math.max(Number.parseInt(url.searchParams.get('page') || '1', 10), 1);
    const pageSize = Math.min(Math.max(Number.parseInt(url.searchParams.get('page_size') || '20', 10), 1), 50);

    const baseQuery = () => {
      const query = s
        .from('pagamentos_saas')
        .select(
          `
          id,
          escola_id,
          assinatura_id,
          valor_kz,
          metodo,
          status,
          referencia_ext,
          confirmado_por,
          confirmado_em,
          periodo_inicio,
          periodo_fim,
          created_at,
          escolas:escola_id (id, nome),
          assinaturas:assinatura_id (plano, ciclo)
        `,
          { count: 'exact' },
        )
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });

      if (escolaId) {
        query.eq('escola_id', escolaId);
      }

      if (status) {
        query.eq('status', status);
      }

      if (periodo) {
        query.gte('periodo_inicio', periodo.start);
        query.lt('periodo_inicio', periodo.end);
      }

      return query;
    };

    if (format === 'csv') {
      const { data, error } = await baseQuery().limit(5000);
      if (error) throw error;

      const header = [
        'escola',
        'plano',
        'ciclo',
        'valor_kz',
        'status',
        'metodo',
        'referencia',
        'data_evento',
        'actor',
      ];

      const rows = (data || []).map((row) => {
        const escolaNome = (row.escolas as { nome?: string } | null)?.nome || 'Escola sem nome';
        const assinatura = (row.assinaturas as { plano?: string; ciclo?: string } | null) || {};

        return [
          escolaNome,
          assinatura.plano || '',
          assinatura.ciclo || '',
          row.valor_kz,
          row.status,
          row.metodo,
          row.referencia_ext || '',
          row.confirmado_em || row.created_at,
          row.confirmado_por || '',
        ];
      });

      const csv = [
        header.map(toCsvCell).join(','),
        ...rows.map((line) => line.map(toCsvCell).join(',')),
      ].join('\n');

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="historico-receitas.csv"',
        },
      });
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await baseQuery().range(from, to);
    if (error) throw error;

    const actorIds = Array.from(new Set((data || []).map((item) => item.confirmado_por).filter(Boolean)));
    const actorNameMap = new Map<string, string>();

    if (actorIds.length > 0) {
      const { data: actors } = await s
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', actorIds);

      for (const actor of actors || []) {
        actorNameMap.set(actor.user_id, actor.full_name || actor.email || actor.user_id);
      }
    }

    const items = (data || []).map((row) => {
      const escola = (row.escolas as { id?: string; nome?: string } | null) || {};
      const assinatura = (row.assinaturas as { plano?: string; ciclo?: string } | null) || {};
      const actorId = row.confirmado_por || null;

      return {
        id: row.id,
        escola_id: row.escola_id,
        escola_nome: escola.nome || 'Escola sem nome',
        plano: assinatura.plano || null,
        ciclo: assinatura.ciclo || null,
        valor_kz: row.valor_kz,
        status: row.status,
        metodo: row.metodo,
        referencia: row.referencia_ext,
        data_evento: row.confirmado_em || row.created_at,
        actor_id: actorId,
        actor_nome: actorId ? actorNameMap.get(actorId) || actorId : 'Sistema',
        periodo_inicio: row.periodo_inicio,
        periodo_fim: row.periodo_fim,
      };
    });

    return NextResponse.json({
      ok: true,
      items,
      pagination: {
        page,
        page_size: pageSize,
        total: count || 0,
        total_pages: Math.max(Math.ceil((count || 0) / pageSize), 1),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const s = await supabaseServer();
    const { data: sessionData } = await s.auth.getUser();
    const user = sessionData?.user;

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    if (!(await checkSuperAdmin(s, user.id))) {
      return NextResponse.json({ ok: false, error: 'Somente Super Admin' }, { status: 403 });
    }

    const body = await req.json();
    const pagamentoId = String(body?.id || '').trim();
    const novoStatus = String(body?.status || '').trim() as BillingHistoricoStatus;
    const novoMetodo = typeof body?.metodo === 'string' ? body.metodo.trim() : undefined;
    const novaReferencia = typeof body?.referencia_ext === 'string' ? body.referencia_ext.trim() : undefined;

    if (!pagamentoId) {
      return NextResponse.json({ ok: false, error: 'ID de pagamento é obrigatório' }, { status: 400 });
    }

    if (!novoStatus || !['pendente', 'confirmado', 'falhado'].includes(novoStatus)) {
      return NextResponse.json({ ok: false, error: 'Status inválido' }, { status: 400 });
    }

    const { data: before, error: beforeError } = await s
      .from('pagamentos_saas')
      .select('id, escola_id, status, metodo, referencia_ext, confirmado_em, confirmado_por')
      .eq('id', pagamentoId)
      .single();

    if (beforeError || !before) {
      return NextResponse.json({ ok: false, error: 'Pagamento não encontrado' }, { status: 404 });
    }

    const payload: Record<string, unknown> = {
      status: novoStatus,
      confirmado_por: user.id,
      confirmado_em: new Date().toISOString(),
    };

    if (novoMetodo !== undefined) payload.metodo = novoMetodo;
    if (novaReferencia !== undefined) payload.referencia_ext = novaReferencia;

    const { error: updateError } = await s
      .from('pagamentos_saas')
      .update(payload)
      .eq('id', pagamentoId);

    if (updateError) throw updateError;

    await recordAuditServer({
      escolaId: before.escola_id,
      portal: 'super_admin',
      acao: 'BILLING_HISTORY_ADJUSTMENT',
      entity: 'pagamentos_saas',
      entityId: pagamentoId,
      details: {
        before,
        after: {
          status: novoStatus,
          metodo: payload.metodo ?? before.metodo,
          referencia_ext: payload.referencia_ext ?? before.referencia_ext,
        },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

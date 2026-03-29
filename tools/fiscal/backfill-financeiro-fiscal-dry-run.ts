#!/usr/bin/env tsx
import { createSqlClient, resolveDbUrl } from "./_common";

type Args = {
  empresaId?: string;
  escolaId?: string;
  limit: number;
};

function parseArgs(argv: string[]): Args {
  let empresaId: string | undefined;
  let escolaId: string | undefined;
  let limit = 100;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--empresa-id") empresaId = argv[i + 1];
    if (arg === "--escola-id") escolaId = argv[i + 1];
    if (arg === "--limit") limit = Number(argv[i + 1] ?? 100);
  }

  if (!Number.isFinite(limit) || limit <= 0) limit = 100;
  return { empresaId, escolaId, limit };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dbUrl = resolveDbUrl();
  const sql = createSqlClient(dbUrl);

  try {
    const escolaFilter = args.escolaId ?? null;

    const pagamentosGap = await sql<{
      pagamento_id: string;
      escola_id: string;
      mensalidade_id: string | null;
      status: string;
      status_fiscal: string | null;
      created_at: string;
      link_status: string | null;
      fiscal_documento_id: string | null;
    }[]>`
      select
        p.id as pagamento_id,
        p.escola_id,
        p.mensalidade_id,
        p.status,
        p.status_fiscal,
        p.created_at,
        l.status as link_status,
        l.fiscal_documento_id
      from public.pagamentos p
      left join public.financeiro_fiscal_links l
        on l.origem_tipo = 'financeiro_pagamentos_registrar'
       and l.origem_id = p.id::text
      where (${escolaFilter}::uuid is null or p.escola_id = ${escolaFilter}::uuid)
        and p.status in ('settled', 'pago')
        and (l.id is null or l.status <> 'ok' or p.status_fiscal is distinct from 'ok')
      order by p.created_at desc
      limit ${args.limit}
    `;

    const mensalidadesGap = await sql<{
      mensalidade_id: string;
      escola_id: string | null;
      status: string | null;
      status_fiscal: string | null;
      created_at: string;
      link_status: string | null;
      fiscal_documento_id: string | null;
    }[]>`
      select
        m.id as mensalidade_id,
        m.escola_id,
        m.status,
        m.status_fiscal,
        m.created_at,
        l.status as link_status,
        l.fiscal_documento_id
      from public.mensalidades m
      left join public.financeiro_fiscal_links l
        on l.origem_tipo = 'financeiro_recibos_emitir'
       and l.origem_id = m.id::text
      where (${escolaFilter}::uuid is null or m.escola_id = ${escolaFilter}::uuid)
        and m.status = 'pago'
        and (l.id is null or l.status <> 'ok' or m.status_fiscal is distinct from 'ok')
      order by m.created_at desc
      limit ${args.limit}
    `;

    const pendingFailed = await sql<{
      origem_tipo: string;
      status: string;
      total: number;
    }[]>`
      select origem_tipo, status, count(*)::int as total
      from public.financeiro_fiscal_links
      where status in ('pending', 'failed')
        and (${escolaFilter}::uuid is null or escola_id = ${escolaFilter}::uuid)
      group by origem_tipo, status
      order by origem_tipo, status
    `;

    const output = {
      dry_run: true,
      filters: {
        empresa_id: args.empresaId ?? null,
        escola_id: args.escolaId ?? null,
        limit: args.limit,
      },
      summary: {
        pagamentos_gap: pagamentosGap.length,
        mensalidades_gap: mensalidadesGap.length,
        pending_failed_groups: pendingFailed.length,
      },
      pending_failed: pendingFailed,
      sample_pagamentos_gap: pagamentosGap,
      sample_mensalidades_gap: mensalidadesGap,
    };

    console.log(JSON.stringify(output, null, 2));
  } finally {
    await sql.end({ timeout: 1 });
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    JSON.stringify(
      {
        dry_run: true,
        ok: false,
        error: message,
      },
      null,
      2
    )
  );
  process.exit(1);
});

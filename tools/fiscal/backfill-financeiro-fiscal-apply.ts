#!/usr/bin/env tsx
import { createSqlClient, resolveDbUrl } from "./_common";

type Args = {
  escolaId?: string;
  empresaId?: string;
  limit: number;
  yes: boolean;
};

type CandidatePagamento = {
  pagamento_id: string;
  escola_id: string;
  empresa_id: string;
  mensalidade_id: string | null;
  status_fiscal: string | null;
};

type CandidateMensalidade = {
  mensalidade_id: string;
  escola_id: string;
  empresa_id: string;
  status_fiscal: string | null;
};

function parseArgs(argv: string[]): Args {
  let escolaId: string | undefined;
  let empresaId: string | undefined;
  let limit = 200;
  let yes = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--escola-id") escolaId = argv[i + 1];
    if (arg === "--empresa-id") empresaId = argv[i + 1];
    if (arg === "--limit") limit = Number(argv[i + 1] ?? 200);
    if (arg === "--yes") yes = true;
  }

  if (!Number.isFinite(limit) || limit <= 0) limit = 200;

  return {
    escolaId,
    empresaId,
    limit,
    yes,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dbUrl = resolveDbUrl();
  const sql = createSqlClient(dbUrl);
  const nowIso = new Date().toISOString();

  try {
    const pagamentosCandidates = await sql<CandidatePagamento[]>`
      with binding as (
        select distinct on (b.escola_id)
          b.escola_id,
          b.empresa_id
        from public.fiscal_escola_bindings b
        where b.effective_to is null
        order by b.escola_id, b.is_primary desc, b.effective_from desc
      )
      select
        p.id as pagamento_id,
        p.escola_id,
        binding.empresa_id,
        p.mensalidade_id,
        p.status_fiscal
      from public.pagamentos p
      inner join binding on binding.escola_id = p.escola_id
      left join public.financeiro_fiscal_links l
        on l.origem_tipo = 'financeiro_pagamentos_registrar'
       and l.origem_id = p.id::text
      where p.status in ('settled', 'pago')
        and p.status_fiscal is distinct from 'ok'
        and l.id is null
        and (${args.escolaId ?? null}::uuid is null or p.escola_id = ${args.escolaId ?? null}::uuid)
        and (${args.empresaId ?? null}::uuid is null or binding.empresa_id = ${args.empresaId ?? null}::uuid)
      order by p.created_at asc
      limit ${args.limit}
    `;

    const mensalidadesCandidates = await sql<CandidateMensalidade[]>`
      with binding as (
        select distinct on (b.escola_id)
          b.escola_id,
          b.empresa_id
        from public.fiscal_escola_bindings b
        where b.effective_to is null
        order by b.escola_id, b.is_primary desc, b.effective_from desc
      )
      select
        m.id as mensalidade_id,
        m.escola_id,
        binding.empresa_id,
        m.status_fiscal
      from public.mensalidades m
      inner join binding on binding.escola_id = m.escola_id
      left join public.financeiro_fiscal_links l
        on l.origem_tipo = 'financeiro_recibos_emitir'
       and l.origem_id = m.id::text
      where m.status = 'pago'
        and m.status_fiscal is distinct from 'ok'
        and l.id is null
        and (${args.escolaId ?? null}::uuid is null or m.escola_id = ${args.escolaId ?? null}::uuid)
        and (${args.empresaId ?? null}::uuid is null or binding.empresa_id = ${args.empresaId ?? null}::uuid)
      order by m.created_at asc
      limit ${args.limit}
    `;

    if (!args.yes) {
      console.log(
        JSON.stringify(
          {
            ok: true,
            dry_run: true,
            message: "Use --yes para aplicar alterações.",
            filters: {
              escola_id: args.escolaId ?? null,
              empresa_id: args.empresaId ?? null,
              limit: args.limit,
            },
            candidates: {
              pagamentos: pagamentosCandidates.length,
              mensalidades: mensalidadesCandidates.length,
            },
            sample: {
              pagamentos: pagamentosCandidates.slice(0, 10),
              mensalidades: mensalidadesCandidates.slice(0, 10),
            },
          },
          null,
          2
        )
      );
      return;
    }

    let pagamentosInserted = 0;
    let pagamentosUpdated = 0;
    let mensalidadesInserted = 0;
    let mensalidadesUpdated = 0;

    for (const row of pagamentosCandidates) {
      const idempotencyKey = `backfill:financeiro_pagamentos_registrar:${row.pagamento_id}`;
      const payloadSnapshot = {
        origem_operacao: "financeiro_pagamentos_registrar",
        origem_backfill: true,
        backfill_at: nowIso,
        pagamento_id: row.pagamento_id,
        mensalidade_id: row.mensalidade_id,
      };

      const insertRows = await sql<{ id: string }[]>`
        insert into public.financeiro_fiscal_links (
          escola_id,
          empresa_id,
          origem_tipo,
          origem_id,
          fiscal_documento_id,
          status,
          idempotency_key,
          payload_snapshot,
          fiscal_error
        )
        values (
          ${row.escola_id}::uuid,
          ${row.empresa_id}::uuid,
          'financeiro_pagamentos_registrar',
          ${row.pagamento_id},
          null,
          'pending',
          ${idempotencyKey},
          ${JSON.stringify(payloadSnapshot)}::jsonb,
          null
        )
        on conflict (origem_tipo, origem_id) do nothing
        returning id
      `;
      if (insertRows.length > 0) pagamentosInserted += 1;

      const updatedRows = await sql<{ id: string }[]>`
        update public.pagamentos
        set
          status_fiscal = 'pending',
          fiscal_error = null
        where id = ${row.pagamento_id}::uuid
          and status_fiscal is null
        returning id
      `;
      if (updatedRows.length > 0) pagamentosUpdated += 1;
    }

    for (const row of mensalidadesCandidates) {
      const idempotencyKey = `backfill:financeiro_recibos_emitir:${row.mensalidade_id}`;
      const payloadSnapshot = {
        origem_operacao: "financeiro_recibos_emitir",
        origem_backfill: true,
        backfill_at: nowIso,
        mensalidade_id: row.mensalidade_id,
      };

      const insertRows = await sql<{ id: string }[]>`
        insert into public.financeiro_fiscal_links (
          escola_id,
          empresa_id,
          origem_tipo,
          origem_id,
          fiscal_documento_id,
          status,
          idempotency_key,
          payload_snapshot,
          fiscal_error
        )
        values (
          ${row.escola_id}::uuid,
          ${row.empresa_id}::uuid,
          'financeiro_recibos_emitir',
          ${row.mensalidade_id},
          null,
          'pending',
          ${idempotencyKey},
          ${JSON.stringify(payloadSnapshot)}::jsonb,
          null
        )
        on conflict (origem_tipo, origem_id) do nothing
        returning id
      `;
      if (insertRows.length > 0) mensalidadesInserted += 1;

      const updatedRows = await sql<{ id: string }[]>`
        update public.mensalidades
        set
          status_fiscal = 'pending',
          fiscal_error = null
        where id = ${row.mensalidade_id}::uuid
          and status_fiscal is null
        returning id
      `;
      if (updatedRows.length > 0) mensalidadesUpdated += 1;
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          dry_run: false,
          applied_at: nowIso,
          filters: {
            escola_id: args.escolaId ?? null,
            empresa_id: args.empresaId ?? null,
            limit: args.limit,
          },
          candidates: {
            pagamentos: pagamentosCandidates.length,
            mensalidades: mensalidadesCandidates.length,
          },
          applied: {
            pagamentos_links_inserted: pagamentosInserted,
            pagamentos_status_pending_updated: pagamentosUpdated,
            mensalidades_links_inserted: mensalidadesInserted,
            mensalidades_status_pending_updated: mensalidadesUpdated,
          },
        },
        null,
        2
      )
    );
  } finally {
    await sql.end({ timeout: 1 });
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    JSON.stringify(
      {
        ok: false,
        dry_run: false,
        error: message,
      },
      null,
      2
    )
  );
  process.exit(1);
});

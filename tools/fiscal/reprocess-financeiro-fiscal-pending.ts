#!/usr/bin/env tsx
import { KMSClient, SignCommand } from "@aws-sdk/client-kms";
import { createSqlClient, resolveDbUrl } from "./_common";

type Args = {
  escolaId?: string;
  empresaId?: string;
  actingUserId?: string;
  limit: number;
  yes: boolean;
};

type PendingLink = {
  id: string;
  escola_id: string;
  empresa_id: string;
  origem_tipo: string;
  origem_id: string;
  status: "pending" | "failed" | "ok";
};

type SerieRow = {
  id: string;
  prefixo: string;
  origem_documento: string;
};

type PagamentoRow = {
  id: string;
  mensalidade_id: string | null;
  valor_pago: number;
  data_pagamento: string | Date | null;
  settled_at: string | Date | null;
  created_at: string | Date;
};

type MensalidadeRow = {
  id: string;
  valor: number;
  valor_previsto: number | null;
  data_pagamento_efetiva: string | Date | null;
  created_at: string | Date;
};

type EmitResult = {
  ok: boolean;
  documento_id: string;
  numero_formatado: string;
  hash_control: string;
  key_version: number;
  status?: string;
  canonical_string?: string;
};

type FinalizeResult = {
  ok: boolean;
  documento_id: string;
  numero_formatado: string;
  hash_control: string;
  key_version: number;
  status?: string;
};

const CONSUMIDOR_FINAL_NIF = "999999999";
const CONSUMIDOR_FINAL_NOME = "Consumidor final";
const DESCONHECIDO = "Desconhecido";

function parseArgs(argv: string[]): Args {
  let escolaId: string | undefined;
  let empresaId: string | undefined;
  let actingUserId: string | undefined;
  let limit = 200;
  let yes = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--escola-id") escolaId = argv[i + 1];
    if (arg === "--empresa-id") empresaId = argv[i + 1];
    if (arg === "--acting-user-id") actingUserId = argv[i + 1];
    if (arg === "--limit") limit = Number(argv[i + 1] ?? 200);
    if (arg === "--yes") yes = true;
  }

  if (!Number.isFinite(limit) || limit <= 0) limit = 200;
  return { escolaId, empresaId, actingUserId, limit, yes };
}

function valueOr<T>(value: T | null | undefined, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  return value;
}

function toDateOnly(input: string | Date): string {
  if (input instanceof Date) {
    return input.toISOString().slice(0, 10);
  }
  return String(input).slice(0, 10);
}

function parseKmsPrivateKeyRef(privateKeyRef: string) {
  const ref = privateKeyRef.trim();
  if (!ref) {
    return { region: null as string | null, keyId: null as string | null };
  }

  if (ref.startsWith("arn:aws:kms:")) {
    const parts = ref.split(":");
    return { region: parts[3] || null, keyId: ref };
  }

  if (ref.startsWith("kms://")) {
    const raw = ref.slice("kms://".length).replace(/^\/+/, "");
    if (!raw) return { region: null, keyId: null };
    const slash = raw.indexOf("/");
    if (slash === -1) return { region: null, keyId: raw };
    const first = raw.slice(0, slash);
    const rest = raw.slice(slash + 1);
    const looksLikeRegion = /^[a-z]{2}-[a-z]+-\d+$/.test(first);
    if (looksLikeRegion && rest) return { region: first, keyId: rest };
    return { region: null, keyId: raw };
  }

  return { region: null, keyId: ref };
}

async function signCanonicalString(params: { canonicalString: string; privateKeyRef: string | null }) {
  const envRegion = process.env.AWS_REGION?.trim() || "";
  const envKeyId = process.env.AWS_KMS_KEY_ID?.trim() || "";
  const algorithm = (process.env.AWS_KMS_SIGNING_ALGORITHM?.trim() || "RSASSA_PSS_SHA_256") as
    | "RSASSA_PSS_SHA_256"
    | "RSASSA_PKCS1_V1_5_SHA_256";

  const parsed = params.privateKeyRef ? parseKmsPrivateKeyRef(params.privateKeyRef) : { region: null, keyId: null };
  const region = parsed.region || envRegion;
  const keyId = parsed.keyId || envKeyId;

  if (!region || !keyId) {
    throw new Error("KMS config missing: AWS_REGION e AWS_KMS_KEY_ID (ou private_key_ref) são obrigatórios.");
  }

  const client = new KMSClient({ region });
  const result = await client.send(
    new SignCommand({
      KeyId: keyId,
      Message: Buffer.from(params.canonicalString, "utf8"),
      MessageType: "RAW",
      SigningAlgorithm: algorithm,
    })
  );

  if (!result.Signature) {
    throw new Error("KMS returned empty signature.");
  }

  return Buffer.from(result.Signature).toString("base64");
}

async function pickSerieFR(sql: ReturnType<typeof createSqlClient>, empresaId: string): Promise<SerieRow> {
  const rows = await sql<SerieRow[]>`
    select id, prefixo, origem_documento
    from public.fiscal_series
    where empresa_id = ${empresaId}::uuid
      and tipo_documento = 'FR'
      and ativa = true
      and descontinuada_em is null
    order by
      case when prefixo = 'FR' then 0 else 1 end,
      case when origem_documento = 'integrado' then 0 else 1 end,
      created_at asc
    limit 1
  `;

  const serie = rows[0];
  if (!serie) {
    throw new Error(`SERIE_NAO_ENCONTRADA: empresa ${empresaId} sem série FR ativa.`);
  }
  return serie;
}

async function emitAndSign(params: {
  sql: ReturnType<typeof createSqlClient>;
  empresaId: string;
  serie: SerieRow;
  origemTipo: string;
  origemId: string;
  invoiceDate: string;
  valor: number;
  descricao: string;
}): Promise<FinalizeResult> {
  const cliente = {
    nome: CONSUMIDOR_FINAL_NOME,
    nif: CONSUMIDOR_FINAL_NIF,
    address_detail: DESCONHECIDO,
    city: DESCONHECIDO,
    postal_code: DESCONHECIDO,
    country: DESCONHECIDO,
  };

  const itens = [
    {
      descricao: params.descricao,
      product_code: "SERV_INTEGRADO_1",
      product_number_code: "SERV_INTEGRADO_1",
      quantidade: 1,
      preco_unit: Number(params.valor.toFixed(2)),
      taxa_iva: 14,
    },
  ];

  const metadata = {
    origem_integracao: "financeiro_fiscal_reprocess_tool",
    origem_operacao: params.origemTipo,
    origem_id: params.origemId,
    reprocessamento: true,
    processed_at: new Date().toISOString(),
  };

  const emitRows = await params.sql<{ result: EmitResult }[]>`
    select public.fiscal_emitir_documento(
      ${params.empresaId}::uuid,
      ${params.serie.id}::uuid,
      'FR',
      ${params.serie.prefixo},
      ${params.serie.origem_documento},
      ${params.sql.json(cliente)}::jsonb,
      ${params.invoiceDate}::date,
      'AOA',
      ${params.sql.json(itens)}::jsonb,
      null::uuid,
      null::uuid,
      null::numeric,
      ${params.sql.json(metadata)}::jsonb,
      ''::text,
      null::text
    ) as result
  `;

  const emitResult = emitRows[0]?.result;
  if (!emitResult || !emitResult.ok || !emitResult.documento_id) {
    throw new Error("FISCAL_RPC_INCONSISTENTE: emissão não retornou documento válido.");
  }

  if (emitResult.status !== "pendente_assinatura" || !emitResult.canonical_string) {
    return emitResult;
  }

  const keyRows = await params.sql<{ private_key_ref: string | null }[]>`
    select private_key_ref
    from public.fiscal_chaves
    where empresa_id = ${params.empresaId}::uuid
      and key_version = ${emitResult.key_version}
    limit 1
  `;

  const assinaturaBase64 = await signCanonicalString({
    canonicalString: emitResult.canonical_string,
    privateKeyRef: keyRows[0]?.private_key_ref ?? null,
  });

  const finalizeRows = await params.sql<{ result: FinalizeResult }[]>`
    select public.fiscal_finalizar_assinatura(
      p_documento_id := ${emitResult.documento_id}::uuid,
      p_assinatura_base64 := ${assinaturaBase64},
      p_hash_control := ${emitResult.hash_control},
      p_canonical_string := ${emitResult.canonical_string}
    ) as result
  `;

  const finalizeResult = finalizeRows[0]?.result;
  if (!finalizeResult || !finalizeResult.ok || !finalizeResult.documento_id) {
    throw new Error("FISCAL_FINALIZE_INCONSISTENTE: finalização da assinatura falhou.");
  }

  return finalizeResult;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dbUrl = resolveDbUrl();
  const sql = createSqlClient(dbUrl);
  const actingUserId =
    args.actingUserId?.trim() ||
    process.env.FISCAL_ACTING_USER_ID?.trim() ||
    "a19f49e6-f9d7-48c2-af7b-0a58335b9330";

  try {
    const links = await sql<PendingLink[]>`
      select id, escola_id, empresa_id, origem_tipo, origem_id, status
      from public.financeiro_fiscal_links
      where origem_tipo in ('financeiro_pagamentos_registrar', 'financeiro_recibos_emitir')
        and status in ('pending', 'failed')
        and fiscal_documento_id is null
        and (${args.escolaId ?? null}::uuid is null or escola_id = ${args.escolaId ?? null}::uuid)
        and (${args.empresaId ?? null}::uuid is null or empresa_id = ${args.empresaId ?? null}::uuid)
      order by created_at asc
      limit ${args.limit}
    `;

    if (!args.yes) {
      console.log(
        JSON.stringify(
          {
            ok: true,
            dry_run: true,
            message: "Use --yes para executar o reprocessamento.",
            filters: {
              escola_id: args.escolaId ?? null,
              empresa_id: args.empresaId ?? null,
              acting_user_id: actingUserId || null,
              limit: args.limit,
            },
            pending_links: links.length,
            sample: links.slice(0, 20),
          },
          null,
          2
        )
      );
      return;
    }

    if (actingUserId) {
      await sql`select set_config('request.jwt.claim.sub', ${actingUserId}, false)`;
      await sql`select set_config('request.jwt.claim.role', 'authenticated', false)`;
    }

    let success = 0;
    let failed = 0;
    const failures: Array<{ link_id: string; origem_tipo: string; origem_id: string; error: string }> = [];
    const serieCache = new Map<string, SerieRow>();

    for (const link of links) {
      try {
        let serie = serieCache.get(link.empresa_id);
        if (!serie) {
          serie = await pickSerieFR(sql, link.empresa_id);
          serieCache.set(link.empresa_id, serie);
        }

        if (link.origem_tipo === "financeiro_pagamentos_registrar") {
          const pagamentoRows = await sql<PagamentoRow[]>`
            select id, mensalidade_id, valor_pago, data_pagamento, settled_at, created_at
            from public.pagamentos
            where id = ${link.origem_id}::uuid
            limit 1
          `;
          const pagamento = pagamentoRows[0];
          if (!pagamento) {
            throw new Error("Pagamento não encontrado.");
          }

          const mensalidadeRows = pagamento.mensalidade_id
            ? await sql<MensalidadeRow[]>`
                select id, valor, valor_previsto, data_pagamento_efetiva, created_at
                from public.mensalidades
                where id = ${pagamento.mensalidade_id}::uuid
                limit 1
              `
            : [];
          const mensalidade = mensalidadeRows[0] ?? null;

          const valorBase = Number(
            valueOr(mensalidade?.valor_previsto, valueOr(mensalidade?.valor, pagamento.valor_pago))
          );
          if (!Number.isFinite(valorBase) || valorBase <= 0) {
            throw new Error("Valor inválido para emissão fiscal.");
          }

          const invoiceDate =
            toDateOnly(
              pagamento.data_pagamento ??
                pagamento.settled_at ??
                mensalidade?.data_pagamento_efetiva ??
                pagamento.created_at
            );

          const emit = await emitAndSign({
            sql,
            empresaId: link.empresa_id,
            serie,
            origemTipo: link.origem_tipo,
            origemId: link.origem_id,
            invoiceDate,
            valor: valorBase,
            descricao: pagamento.mensalidade_id
              ? `Pagamento mensalidade ${pagamento.mensalidade_id}`
              : `Pagamento ${pagamento.id}`,
          });

          await sql`
            update public.financeiro_fiscal_links
            set
              status = 'ok',
              fiscal_documento_id = ${emit.documento_id}::uuid,
              fiscal_error = null,
              updated_at = now()
            where id = ${link.id}::uuid
          `;

          await sql`
            update public.pagamentos
            set
              status_fiscal = 'ok',
              fiscal_documento_id = ${emit.documento_id}::uuid,
              fiscal_error = null
            where id = ${pagamento.id}::uuid
          `;

          if (pagamento.mensalidade_id) {
            await sql`
              update public.mensalidades
              set
                status_fiscal = 'ok',
                fiscal_documento_id = ${emit.documento_id}::uuid,
                fiscal_error = null
              where id = ${pagamento.mensalidade_id}::uuid
                and (status_fiscal is null or status_fiscal <> 'ok')
            `;
          }

          success += 1;
          continue;
        }

        if (link.origem_tipo === "financeiro_recibos_emitir") {
          const mensalidadeRows = await sql<MensalidadeRow[]>`
            select id, valor, valor_previsto, data_pagamento_efetiva, created_at
            from public.mensalidades
            where id = ${link.origem_id}::uuid
            limit 1
          `;
          const mensalidade = mensalidadeRows[0];
          if (!mensalidade) {
            throw new Error("Mensalidade não encontrada.");
          }

          const valorBase = Number(valueOr(mensalidade.valor_previsto, mensalidade.valor));
          if (!Number.isFinite(valorBase) || valorBase <= 0) {
            throw new Error("Valor inválido para emissão fiscal.");
          }

          const invoiceDate = toDateOnly(mensalidade.data_pagamento_efetiva ?? mensalidade.created_at);

          const emit = await emitAndSign({
            sql,
            empresaId: link.empresa_id,
            serie,
            origemTipo: link.origem_tipo,
            origemId: link.origem_id,
            invoiceDate,
            valor: valorBase,
            descricao: `Recebimento mensalidade ${mensalidade.id}`,
          });

          await sql`
            update public.financeiro_fiscal_links
            set
              status = 'ok',
              fiscal_documento_id = ${emit.documento_id}::uuid,
              fiscal_error = null,
              updated_at = now()
            where id = ${link.id}::uuid
          `;

          await sql`
            update public.mensalidades
            set
              status_fiscal = 'ok',
              fiscal_documento_id = ${emit.documento_id}::uuid,
              fiscal_error = null
            where id = ${mensalidade.id}::uuid
          `;

          success += 1;
          continue;
        }

        throw new Error(`origem_tipo não suportado: ${link.origem_tipo}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failed += 1;
        failures.push({
          link_id: link.id,
          origem_tipo: link.origem_tipo,
          origem_id: link.origem_id,
          error: message,
        });

        await sql`
          update public.financeiro_fiscal_links
          set
            status = 'failed',
            fiscal_error = ${message},
            updated_at = now()
          where id = ${link.id}::uuid
        `;

        if (link.origem_tipo === "financeiro_pagamentos_registrar") {
          await sql`
            update public.pagamentos
            set
              status_fiscal = 'pending',
              fiscal_error = ${message}
            where id = ${link.origem_id}::uuid
          `;
        } else if (link.origem_tipo === "financeiro_recibos_emitir") {
          await sql`
            update public.mensalidades
            set
              status_fiscal = 'pending',
              fiscal_error = ${message}
            where id = ${link.origem_id}::uuid
          `;
        }
      }
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          dry_run: false,
          processed_total: links.length,
          success,
          failed,
          failures,
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

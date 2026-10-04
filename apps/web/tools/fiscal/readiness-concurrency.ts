import postgres from "postgres";
import { randomUUID } from "node:crypto";

const databaseUrl = process.env.FISCAL_READINESS_DATABASE_URL?.trim();
const empresaId = process.env.FISCAL_READINESS_EMPRESA_ID?.trim();
const userId = process.env.FISCAL_READINESS_USER_ID?.trim();
const target = process.env.FISCAL_READINESS_TARGET?.trim().toLowerCase();
const concurrencyRaw = process.env.FISCAL_READINESS_CONCURRENCY?.trim() || "100";
const concurrency = Number.parseInt(concurrencyRaw, 10);

if (!databaseUrl || !empresaId || !userId) {
  throw new Error(
    "READINESS_CONFIG_MISSING: FISCAL_READINESS_DATABASE_URL, FISCAL_READINESS_EMPRESA_ID and FISCAL_READINESS_USER_ID are required"
  );
}
if (!["staging", "branch"].includes(target ?? "")) {
  throw new Error(
    "READINESS_PRODUCTION_FORBIDDEN: set FISCAL_READINESS_TARGET=staging or branch"
  );
}
if (!Number.isSafeInteger(concurrency) || concurrency < 2 || concurrency > 100) {
  throw new Error("READINESS_CONCURRENCY_INVALID");
}

const sql = postgres(databaseUrl, {
  max: concurrency,
  idle_timeout: 5,
  connect_timeout: 10,
});

const fixtureId = randomUUID();
const prefix = `RD-${Date.now()}`;

async function reserve() {
  return sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub',${userId},true)`;
    await tx`select set_config('request.jwt.claim.role','authenticated',true)`;
    const rows = await tx`
      select numero,numero_formatado
      from public.fiscal_reservar_numero_serie(${fixtureId}::uuid)
    `;
    return Number(rows[0]?.numero);
  });
}

try {
  await sql`
    insert into public.fiscal_series(
      id,empresa_id,tipo_documento,prefixo,origem_documento,
      ultimo_numero,ativa,agt_status,metadata
    )
    values(
      ${fixtureId}::uuid,${empresaId}::uuid,'PP',${prefix},'interno',
      0,true,'legacy',
      ${sql.json({ readiness_fixture: true, purpose: "100-concurrency" })}
    )
  `;

  const numbers = await Promise.all(
    Array.from({ length: concurrency }, () => reserve())
  );
  const sorted = [...numbers].sort((a, b) => a - b);
  const unique = new Set(sorted);
  const expected = Array.from({ length: concurrency }, (_, i) => i + 1);

  if (
    unique.size !== concurrency ||
    sorted.length !== expected.length ||
    sorted.some((value, index) => value !== expected[index])
  ) {
    throw new Error(
      `READINESS_CONCURRENCY_FAILED: returned=${sorted.length} unique=${unique.size} first=${sorted[0]} last=${sorted.at(-1)}`
    );
  }

  const [series] = await sql`
    select ultimo_numero
    from public.fiscal_series
    where id=${fixtureId}::uuid
  `;

  if (Number(series?.ultimo_numero) !== concurrency) {
    throw new Error(
      `READINESS_COUNTER_FAILED: expected=${concurrency} actual=${series?.ultimo_numero}`
    );
  }

  console.log(
    JSON.stringify({
      ok: true,
      scenario: "atomic_series_numbering",
      concurrency,
      unique: unique.size,
      first: sorted[0],
      last: sorted.at(-1),
    })
  );
} finally {
  await sql`
    delete from public.fiscal_series
    where id=${fixtureId}::uuid
      and metadata->>'readiness_fixture'='true'
  `.catch(() => null);
  await sql.end({ timeout: 5 });
}

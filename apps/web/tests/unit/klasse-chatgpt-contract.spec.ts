import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { allowedRolesByTool, toolSchemas, writeToolNames } from "../../src/lib/integrations/klasse-chatgpt/schemas";
import { rpcByTool } from "../../src/lib/integrations/klasse-chatgpt/tools";

const READ_MIGRATION = "../../supabase/migrations/20260927232530_klasse_chatgpt_readonly_rpcs.sql";
const WRITE_MIGRATION = "../../supabase/migrations/20260928120000_klasse_chatgpt_write_rpcs.sql";

const readMigration = readFileSync(READ_MIGRATION, "utf8");
const writeMigration = readFileSync(WRITE_MIGRATION, "utf8");
const allSql = `${readMigration}\n${writeMigration}`;

const profileOf = (name: string) => {
  // Recorta a definição da função até ao fim do corpo, para inspeccionar só ela.
  const start = allSql.indexOf(`FUNCTION public.${name}(`);
  assert.notEqual(start, -1, `a função ${name} não existe em nenhuma migração`);
  const rest = allSql.slice(start);
  const end = rest.indexOf("$$;");
  return end === -1 ? rest : rest.slice(0, end);
};

test("public tool schemas never accept a tenant id", () => {
  for (const [name, schema] of Object.entries(toolSchemas)) {
    const shape = (schema as unknown as { shape?: Record<string, unknown> }).shape;
    if (shape) {
      for (const tenantKey of ["escola_id", "school_id", "escolaId", "escola"]) {
        assert.equal(
          Object.prototype.hasOwnProperty.call(shape, tenantKey),
          false,
          `${name} expõe ${tenantKey}: o tenant tem de vir do JWT`,
        );
      }
    }

    // Mesmo que um chamador os envie, o zod descarta-os.
    const parsed = schema.safeParse({
      school_id: "00000000-0000-0000-0000-000000000000",
      escola_id: "00000000-0000-0000-0000-000000000000",
    });
    if (parsed.success) {
      assert.equal("school_id" in parsed.data, false);
      assert.equal("escola_id" in parsed.data, false);
    }
  }
});

test("every tool maps to an RPC that actually exists in a migration", () => {
  for (const tool of Object.keys(toolSchemas)) {
    const rpc = (rpcByTool as Record<string, string>)[tool];
    assert.ok(rpc, `${tool} não tem RPC associada`);
    assert.ok(
      allSql.includes(`FUNCTION public.${rpc}(`),
      `${tool} aponta para ${rpc}, que não está definida em nenhuma migração`,
    );
  }
});

test("every tool declares at least one allowed role", () => {
  for (const tool of Object.keys(toolSchemas)) {
    const roles = allowedRolesByTool[tool as keyof typeof allowedRolesByTool];
    assert.ok(Array.isArray(roles) && roles.length > 0, `${tool} não declara papéis autorizados`);
  }
});

test("write tools are declared and gated", () => {
  assert.ok(writeToolNames.length >= 4, "as ferramentas de escrita desapareceram");
  for (const tool of writeToolNames) {
    assert.ok(tool in rpcByTool, `${tool} de escrita sem RPC`);
    assert.ok(tool in allowedRolesByTool, `${tool} de escrita sem papéis`);
  }
});

test("write wrappers are invoker functions and denied to anon", () => {
  for (const fn of [
    "klasse_write_escola_id",
    "klasse_record_attendance",
    "klasse_record_grades",
    "klasse_prepare_payment",
    "klasse_confirm_payment",
    "klasse_pending_confirmations",
  ]) {
    const body = profileOf(fn);
    assert.match(body, /SECURITY INVOKER/, `${fn} devia ser SECURITY INVOKER`);
    assert.doesNotMatch(body, /SECURITY DEFINER/, `${fn} não pode ser SECURITY DEFINER`);

    // Sem EXECUTE para anon. Verificado por função, não por contagem global:
    // uma contagem não diz QUAL ficou por proteger.
    assert.match(
      writeMigration,
      new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}\\([^)]*\\) FROM PUBLIC, anon`),
      `${fn} não tem REVOKE ... FROM PUBLIC, anon`,
    );
  }

  assert.doesNotMatch(writeMigration, /service_role/i);
  assert.doesNotMatch(writeMigration, /DISABLE ROW LEVEL SECURITY/i);
});

test("the confirmation tables keep RLS on and grant nothing to anon", () => {
  for (const table of ["integration_write_tokens", "integration_write_log"]) {
    assert.match(
      writeMigration,
      new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`),
      `${table} sem RLS ligado`,
    );
    assert.match(writeMigration, new RegExp(`REVOKE ALL ON public\\.${table} FROM PUBLIC, anon`));
  }
});

test("the payment path is two-phase: prepare does not write", () => {
  const prepare = profileOf("klasse_prepare_payment");
  // Só pode escrever no livro de tokens. Nenhuma tabela de negócio.
  assert.doesNotMatch(prepare, /INSERT INTO public\.(pagamentos|financeiro_titulos|mensalidades)\b/i);
  assert.doesNotMatch(prepare, /UPDATE public\.(pagamentos|mensalidades)\b/i);
  assert.doesNotMatch(prepare, /financeiro_registrar_pagamento_secretaria/);

  const confirm = profileOf("klasse_confirm_payment");
  assert.match(confirm, /financeiro_registrar_pagamento_secretaria/);
  // O token é a chave de idempotência: reenviá-lo não pode cobrar duas vezes.
  assert.match(confirm, /idempotency_key/);
  assert.match(confirm, /used_at IS NOT NULL/);
});

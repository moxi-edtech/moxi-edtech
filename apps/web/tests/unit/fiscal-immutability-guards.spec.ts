import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

async function migration(name: string) {
  return readFile(path.resolve(process.cwd(), "../../supabase/migrations", name), "utf8");
}

test("BILL-001/002 keep fiscal documents, items and events non-mutable to normal API roles", async () => {
  const sql = await migration("20260927135510_bill_001_005_fiscal_hardening.sql");
  assert.match(sql, /REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public\.fiscal_documentos FROM anon, authenticated/);
  assert.match(sql, /REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public\.fiscal_documento_itens FROM anon, authenticated/);
  assert.match(sql, /REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public\.fiscal_documentos_eventos FROM anon, authenticated/);
  assert.match(sql, /BEFORE DELETE ON public\.fiscal_documentos/);
  assert.match(sql, /BEFORE UPDATE OR DELETE ON public\.fiscal_documento_itens/);
  assert.match(sql, /BEFORE UPDATE OR DELETE ON public\.fiscal_documentos_eventos/);
});

test("BILL-001/003 least privilege does not give service_role direct mutation of immutable fiscal rows", async () => {
  const sql = await migration("20260927140841_bill_001_003_least_privilege.sql");
  for (const table of [
    "fiscal_documentos",
    "fiscal_documento_itens",
    "fiscal_documentos_eventos",
  ]) {
    const pattern =
      "REVOKE INSERT, UPDATE, DELETE, TRUNCATE\\s+ON TABLE public\\." +
      table +
      "\\s+FROM service_role";
    assert.match(sql, new RegExp(pattern, "i"));
  }
});

test("SAF-T validated evidence remains non-deletable and immutable", async () => {
  const sql = await migration("20260927172749_bill_008_saft_export_evidence_immutability.sql");
  assert.match(sql, /BEFORE UPDATE OR DELETE ON public\.fiscal_saft_exports/);
  assert.match(sql, /evidência SAF-T não pode ser apagada/);
  assert.match(sql, /exportação SAF-T validada é imutável/);
  assert.match(
    sql,
    /REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER\s+ON TABLE public\.fiscal_saft_exports\s+FROM authenticated/i
  );
});

test("financial ledger remains append-only for application roles", async () => {
  // The original #137 test used a migration not in production or main.
  // Production protects UPDATE/DELETE with a row trigger and TRUNCATE
  // with explicit revokes for application roles; the privileged
  // TRUNCATE trigger proposed on #137 has NOT been deployed.
  const sql = await migration("20260927153607_bill_007_payment_allocations_and_ledger_hardening.sql");
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.financeiro_block_immutable_row/);
  assert.match(sql, /CREATE TRIGGER trg_fin_ledger_immutable/);
  assert.match(sql, /REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public\.financeiro_ledger FROM authenticated, service_role/);
});

test("BILL-009 emitter preserves the reserved number instead of recomputing it", async () => {
  const sql = await migration("20260927183018_bill_009_preserve_reserved_agt_invoice_no.sql");
  assert.match(
    sql,
    /SELECT numero, numero_formatado\s+INTO v_numero, v_numero_formatado\s+FROM public\.fiscal_reservar_numero_serie\(p_serie_id\)/i
  );
  assert.match(sql, /'numero_formatado', v_numero_formatado/);
});

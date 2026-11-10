import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { resolveRematriculaWindow } from "../../src/lib/secretaria/rematricula-window";

type Window = {
  id: string; ano_letivo: number; ativa: boolean; data_inicio: string; data_fim: string;
};

function mockClient(record: Window | null) {
  const filters: Record<string, unknown> = {};
  const query = {
    select() { return this; },
    eq(key: string, value: unknown) { filters[key] = value; return this; },
    order() { return this; },
    limit() { return this; },
    async maybeSingle() { return { data: record, error: null }; },
  };
  return { from: (table: string) => {
    assert.equal(table, "rematricula_janelas");
    return query;
  }, filters };
}

test("janela inativa permanece configurada como informação de calendário", async () => {
  const now = Date.now();
  const record = {
    id: "window-1", ano_letivo: 2026, ativa: false,
    data_inicio: new Date(now - 60_000).toISOString(), data_fim: new Date(now + 60_000).toISOString(),
  };
  const client = mockClient(record);
  const result = await resolveRematriculaWindow(client, "school-1", 2026);
  assert.deepEqual(result, { configured: true, open: false, window: record });
  assert.equal(client.filters["ano_letivo"], 2026);
  assert.equal(client.filters["escola_id"], "school-1");
  assert.equal(client.filters["ativa"], undefined);
});

test("janela expirada e janela vigente são distinguidas", async () => {
  const now = Date.now();
  const ended = { id: "a", ano_letivo: 2026, ativa: true,
    data_inicio: new Date(now - 200_000).toISOString(), data_fim: new Date(now - 100_000).toISOString() };
  const open = { ...ended, data_fim: new Date(now + 100_000).toISOString() };
  assert.equal((await resolveRematriculaWindow(mockClient(ended), "school", 2026)).open, false);
  assert.equal((await resolveRematriculaWindow(mockClient(open), "school", 2026)).open, true);
  assert.equal((await resolveRematriculaWindow(mockClient(null), "school", 2026)).configured, false);
});

test("reabertura contextual exige direção, motivo e sessão ativa com prazo válido", () => {
  const route = readFileSync(new URL("../../src/app/api/secretaria/rematricula/janelas/route.ts", import.meta.url), "utf8");
  assert.match(route, /balcao_reopen: z\.literal\(true\)/);
  assert.match(route, /requireRoleInSchool\(/);
  assert.match(route, /"admin_escola", "staff_admin", "admin_secretaria", "diretor"/);
  assert.match(route, /observacao\.trim\(\)\.length < 10/);
  assert.match(route, /\.eq\("id", anoLetivoId\)/);
  assert.match(route, /\.eq\("ativo", true\)/);
  assert.match(route, /data_fim/);
  assert.match(route, /expected_updated_at/);
  assert.match(route, /\.eq\("updated_at", parsed\.data\.expected_updated_at\)/);
  assert.match(route, /WindowPermissionError/);
  assert.match(route, /from\("escola_auditoria"\)/);
  assert.match(route, /dados: \{ actor_id: access\.userId, motivo: reason, antes: before, depois: item \}/);
  assert.match(route, /audit_warning/);
});

test("Balcão permite rematrícula fora de época sem solicitar reabertura", () => {
  const balcao = readFileSync(new URL("../../src/components/secretaria/BalcaoAtendimento.tsx", import.meta.url), "utf8");
  const status = readFileSync(new URL("../../src/app/api/secretaria/balcao/rematriculas/status/route.ts", import.meta.url), "utf8");
  const confirm = readFileSync(new URL("../../src/app/api/secretaria/balcao/rematriculas/route.ts", import.meta.url), "utf8");
  assert.match(balcao, /Rematrícula fora de época/);
  assert.doesNotMatch(balcao, /rematriculaState === "WINDOW_CLOSED"/);
  assert.doesNotMatch(balcao, /<RematriculaWindowRecovery/);
  assert.doesNotMatch(balcao, /<BalcaoLateRematriculaAuthorization/);
  assert.doesNotMatch(status, /status = "WINDOW_CLOSED"|autorizacaoForaPrazo/);
  assert.match(status, /rematricula_fora_epoca_permitida: true/);
  assert.doesNotMatch(confirm, /tem_autorizacao_rematricula_fora_prazo/);
});

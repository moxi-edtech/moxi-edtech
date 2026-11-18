import { test, expect, type Browser, type BrowserContext } from "@playwright/test";
import { randomUUID } from "node:crypto";

// Só para staging isolado com dados 100% sintéticos. NUNCA executar na produção.
// As credenciais e os UUIDs são injectados pelo gate manual, não no repositório.
const vars = [
  "TEST_AUDIT_STAGING_BASE_URL",
  "TEST_AUDIT_TEACHER_EMAIL", "TEST_AUDIT_TEACHER_PASSWORD",
  "TEST_AUDIT_DIRECTOR_EMAIL", "TEST_AUDIT_DIRECTOR_PASSWORD",
  "TEST_AUDIT_FOREIGN_EMAIL", "TEST_AUDIT_FOREIGN_PASSWORD",
  "TEST_AUDIT_ANO_ID", "TEST_AUDIT_TURMA_ID",
  "TEST_AUDIT_DISCIPLINA_ID", "TEST_AUDIT_TURMA_DISCIPLINA_ID",
  "TEST_AUDIT_ALUNO_ID", "TEST_AUDIT_TRIMESTRE",
] as const;
const config = Object.fromEntries(vars.map((key) => [key, process.env[key] ?? ""])) as Record<typeof vars[number], string>;
const staging = process.env.TEST_AUDIT_STAGING === "1";
const ready = staging && vars.every((key) => Boolean(config[key]));
test.skip(!ready, "Exige staging explicitamente autorizado, três utilizadores sintéticos e currículo preparado.");

async function login(browser: Browser, email: string, password: string): Promise<BrowserContext> {
  const context = await browser.newContext({ baseURL: config.TEST_AUDIT_STAGING_BASE_URL });
  const page = await context.newPage();
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#senha").fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/redirect|\/escola\/|\/professor|\/secretaria|\/admin|\/operacoes/, { timeout: 30_000 });
  await expect.poll(async () => {
    const r = await context.request.get("/api/professor/notas/reabertura");
    return r.status();
  }).toBe(200);
  return context;
}

test("pedido → aprovação → gravação → leitura → revogação com isolamento", async ({ browser }) => {
  const hostname = new URL(config.TEST_AUDIT_STAGING_BASE_URL).hostname;
  if (hostname === "app.klasse.ao" || hostname === "klasse.ao" || hostname === "www.klasse.ao") {
    throw new Error("Recusado: testes de escrita não podem executar em produção.");
  }
  const teacher = await login(browser, config.TEST_AUDIT_TEACHER_EMAIL, config.TEST_AUDIT_TEACHER_PASSWORD);
  const trimestre = Number(config.TEST_AUDIT_TRIMESTRE);
  expect(trimestre).toBeGreaterThanOrEqual(1);
  expect(trimestre).toBeLessThanOrEqual(3);
  const scope = {
    ano_letivo_id: config.TEST_AUDIT_ANO_ID,
    turma_id: config.TEST_AUDIT_TURMA_ID,
    disciplina_id: config.TEST_AUDIT_DISCIPLINA_ID,
    trimestre,
  };
  const request = await teacher.request.post("/api/professor/notas/reabertura", {
    data: { ...scope, motivo: "Rectificação E2E em turma sintética" },
  });
  expect(request.status(), await request.text()).toBe(201);
  const pedido = (await request.json()).item;
  expect(pedido.status).toBe("PENDENTE");

  // O docente não pode decidir, nem mesmo se conhece o UUID do pedido.
  const teacherDecision = await teacher.request.patch("/api/secretaria/notas/reabertura", {
    data: { id: pedido.id, status: "APROVADO" },
  });
  expect(teacherDecision.status()).toBe(403);

  const foreign = await browser.newContext({ baseURL: config.TEST_AUDIT_STAGING_BASE_URL });
  const foreignPage = await foreign.newPage();
  await foreignPage.goto("/login");
  await foreignPage.locator("#email").fill(config.TEST_AUDIT_FOREIGN_EMAIL);
  await foreignPage.locator("#senha").fill(config.TEST_AUDIT_FOREIGN_PASSWORD);
  await foreignPage.locator('button[type="submit"]').click();
  await foreignPage.waitForURL(/\/redirect|\/escola\/|\/professor|\/secretaria/, { timeout: 30_000 });
  const foreignDecision = await foreign.request.patch("/api/secretaria/notas/reabertura", {
    data: { id: pedido.id, status: "APROVADO" },
  });
  expect([403, 409]).toContain(foreignDecision.status());
  const foreignList = await foreign.request.get("/api/secretaria/notas/reabertura?status=PENDENTE");
  if (foreignList.ok()) expect(JSON.stringify(await foreignList.json())).not.toContain(pedido.id);

  const director = await browser.newContext({ baseURL: config.TEST_AUDIT_STAGING_BASE_URL });
  const directorPage = await director.newPage();
  await directorPage.goto("/login");
  await directorPage.locator("#email").fill(config.TEST_AUDIT_DIRECTOR_EMAIL);
  await directorPage.locator("#senha").fill(config.TEST_AUDIT_DIRECTOR_PASSWORD);
  await directorPage.locator('button[type="submit"]').click();
  await directorPage.waitForURL(/\/redirect|\/escola\/|\/professor|\/secretaria/, { timeout: 30_000 });
  const decision = await director.request.patch("/api/secretaria/notas/reabertura", {
    data: { id: pedido.id, status: "APROVADO" },
  });
  expect(decision.status(), await decision.text()).toBe(200);

  const params = new URLSearchParams({
    turma_id: scope.turma_id, disciplina_id: scope.disciplina_id,
    ano_letivo_id: scope.ano_letivo_id, trimestre: String(trimestre),
  });
  const status = await teacher.request.get(`/api/professor/notas/reabertura?${params}`);
  expect(status.status()).toBe(200);
  expect((await status.json()).can_edit).toBe(true);

  const grade = await teacher.request.post("/api/professor/notas", {
    headers: { "Idempotency-Key": randomUUID() },
    data: {
      ...scope, turma_disciplina_id: config.TEST_AUDIT_TURMA_DISCIPLINA_ID,
      tipo_avaliacao: "MAC", notas: [{ aluno_id: config.TEST_AUDIT_ALUNO_ID, valor: 15 }],
    },
  });
  expect(grade.status(), await grade.text()).toBe(200);
  expect((await grade.json()).ok).toBe(true);

  const readParams = new URLSearchParams({
    turmaId: scope.turma_id, disciplinaId: scope.disciplina_id,
    turmaDisciplinaId: config.TEST_AUDIT_TURMA_DISCIPLINA_ID,
    ano_letivo_id: scope.ano_letivo_id, trimestre: String(trimestre), detalhado: "1",
  });
  const read = await teacher.request.get(`/api/professor/pauta?${readParams}`);
  expect(read.status(), await read.text()).toBe(200);
  const rows = await read.json();
  const pupil = rows.find((row: { aluno_id: string }) => row.aluno_id === config.TEST_AUDIT_ALUNO_ID);
  expect(pupil?.componentes?.MAC).toBe(15);

  const revoked = await director.request.patch("/api/secretaria/notas/reabertura", {
    data: { id: pedido.id, status: "EXPIRADO", motivo_decisao: "Fim da rectificação sintética" },
  });
  expect(revoked.status(), await revoked.text()).toBe(200);
  const final = await teacher.request.get(`/api/professor/notas/reabertura?${params}`);
  expect((await final.json()).can_edit).toBe(false);
  const forbiddenGrade = await teacher.request.post("/api/professor/notas", {
    headers: { "Idempotency-Key": randomUUID() },
    data: {
      ...scope, turma_disciplina_id: config.TEST_AUDIT_TURMA_DISCIPLINA_ID,
      tipo_avaliacao: "MAC", notas: [{ aluno_id: config.TEST_AUDIT_ALUNO_ID, valor: 18 }],
    },
  });
  expect([403, 409]).toContain(forbiddenGrade.status());
  const unchanged = await teacher.request.get(`/api/professor/pauta?${readParams}`);
  const unchangedRows = await unchanged.json();
  expect(unchangedRows.find((row: { aluno_id: string }) =>
    row.aluno_id === config.TEST_AUDIT_ALUNO_ID)?.componentes?.MAC).toBe(15);
  await teacher.close();
  await director.close();
  await foreign.close();
});

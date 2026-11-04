import { test, expect, type Page } from "@playwright/test";

// AUT-006: read-only end-to-end academic case coverage. The test requires
// explicit seeded staging pupils; never create/modify a real school record.
const slug = process.env.TEST_ESCOLA_SLUG;
const email = process.env.TEST_LOGIN_EMAIL;
const password = process.env.TEST_LOGIN_PASSWORD;
const staging = process.env.TEST_RAA_E2E_STAGING === "1";
const enabled = Boolean(staging && slug && email && password);

async function openAcademicSituation(page: Page, alunoId: string) {
  await page.goto("/login");
  await page.fill("#email", email!);
  await page.fill("#senha", password!);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/redirect|\/escola\/.+/, { timeout: 30_000 });

  const params = new URLSearchParams({ alunoId, action: "reenrollment" });
  await page.goto(`/escola/${encodeURIComponent(slug!)}/secretaria/balcao?${params.toString()}`);
  await expect(page.getByRole("region", { name: "Resumo da situação académica" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Próxima ação académica" })).toBeVisible();
  // The selected pupil must remain in the current workspace when inspecting
  // academic issues; this suite intentionally performs no POST/PATCH/PUT.
  expect(new URL(page.url()).searchParams.get("alunoId")).toBe(alunoId);
}

test.describe("AUT-006 academic-cycle exception cases (staging, read-only)", () => {
  test.skip(!enabled, "Requires explicit staging consent and authenticated seeded user.");
  const cases = [
    { kind: "notas", env: "TEST_RAA_NOTAS_ALUNO_ID", status: "Notas por regularizar" },
    { kind: "faltas", env: "TEST_RAA_FALTAS_ALUNO_ID", status: "Faltas por rever" },
    { kind: "disciplina", env: "TEST_RAA_DISCIPLINA_ALUNO_ID", status: "Revisão disciplinar" },
    { kind: "recurso", env: "TEST_RAA_RECURSO_ALUNO_ID", status: "Recurso pendente" },
  ] as const;
  for (const item of cases) {
    test(`shows ${item.kind} with an in-workspace next step`, async ({ page }) => {
      const alunoId = process.env[item.env];
      test.skip(!alunoId, `Requires staging fixture ${item.env}.`);
      await openAcademicSituation(page, alunoId!);
      const summary = page.getByRole("region", { name: "Resumo da situação académica" });
      await expect(summary).toContainText(item.status);
      await expect(page.getByRole("link", { name: /Ver pendências/i })).toBeVisible();
      await page.getByRole("link", { name: /Ver pendências/i }).click();
      await expect(page.getByRole("region", { name: "Pendências do aluno no Balcão" })).toBeVisible();
      expect(new URL(page.url()).searchParams.get("alunoId")).toBe(alunoId);
    });
  }
});

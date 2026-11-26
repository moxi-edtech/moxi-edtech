import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL("../../src/" + path, import.meta.url), "utf8");

test("aluno e professor partilham a identidade institucional sem novas consultas", () => {
  const student = read("components/aluno/dashboard/DashboardLoader.tsx");
  const teacher = read("app/professor/page.tsx");
  const welcome = read("components/portal/ui/PortalWelcomeCard.tsx");
  assert.match(student, /<PortalWelcomeCard role="aluno"/);
  assert.match(teacher, /<PortalWelcomeCard[\s\S]*?role="professor"/);
  assert.match(welcome, /Africa\/Luanda/);
  assert.match(welcome, /aria-hidden="true"/);
  assert.match(welcome, /break-words/);
  assert.doesNotMatch(welcome, /useEffect|useState|fetch\(|"use client"/);
  assert.match(teacher, /prefetch=\{false\} label="Provas"/);
});

test("assinatura estática e cores do crachá limitadas ao cartão", () => {
  const css = read("app/globals.css");
  const asset = readFileSync(new URL("../../public/icons/klasse-welcome-signature.svg", import.meta.url), "utf8");
  assert.match(css, /--welcome-amber: #fea513/);
  assert.match(css, /--welcome-forest: #124527/);
  assert.match(css, /background-repeat: repeat-x/);
  assert.match(asset, /viewBox="0 0 96 24"/);
  assert.doesNotMatch(asset, /<script|https?:\/\/(?!www\.w3\.org)/);
});

test("professor não mascara indicadores indisponíveis com zero", () => {
  const teacher = read("app/professor/page.tsx");
  assert.match(teacher, /pendenciasResumo\?\.avaliacoes_pendentes \?\? null/);
  assert.match(teacher, /pendenciasResumo\?\.faltas_a_lancar \?\? null/);
  assert.match(teacher, /Dados indisponíveis/);
  assert.doesNotMatch(teacher, /animate-ping|blur-3xl/);
});

test("saudação tem uma única data e a fonte local tem licença e pesos reais", () => {
  const welcome = read("components/portal/ui/PortalWelcomeCard.tsx");
  const css = read("app/globals.css");
  const layout = read("app/layout.tsx");
  assert.equal((welcome.match(/<time\b/g) ?? []).length, 1);
  assert.doesNotMatch(welcome, /shortFormatter|shortDate/);
  assert.match(css, /font-weight: 100 800/);
  assert.match(css, /sora-variable\.ttf/);
  assert.match(layout, /rel="preload" href="\/fonts\/sora-variable\.ttf"/);
  assert.doesNotMatch(layout, /userScalable: false|maximumScale: 1|fonts\.googleapis\.com/);
  assert.ok(readFileSync(new URL("../../public/fonts/sora-variable.ttf", import.meta.url)).length > 10000);
  assert.match(readFileSync(new URL("../../public/fonts/OFL-Sora.txt", import.meta.url), "utf8"), /SIL OPEN FONT LICENSE/i);
});

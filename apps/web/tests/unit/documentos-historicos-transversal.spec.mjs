import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const src = (path) => readFileSync(resolve(process.cwd(), "src", path), "utf8");

test("balcão documental seleciona o ano exato por UUID", () => {
  const hub = src("components/secretaria/DocumentosEmissaoHubClient.tsx");
  assert.match(hub, /\{tipo && \(/);
  assert.match(hub, /value=\{item.id\}/);
  assert.match(hub, /anoLetivoId: selectedAnoLetivoId/);
});

test("documentos históricos são leitura académica, não reabertura de pautas", () => {
  const individual = src("app/api/secretaria/documentos/emitir/route.ts");
  const lotes = src("app/api/secretaria/documentos-oficiais/lote/route.ts");
  const certificado = src("app/api/secretaria/documentos/certificado/batch/route.ts");
  assert.match(individual, /tipoDocumento === "boletim_trimestral" \? "WRITE" : "READ"/);
  assert.match(lotes, /\["lista_nominal", "certificado"\]\.includes\(parsed.data.tipo\)/);
  assert.match(certificado, /operation: "READ"/);
});

test("certificado exclui notas de anos posteriores", () => {
  const builder = src("lib/documentos/certificadoSnapshot.ts");
  assert.match(builder, /targetYear = toNumber\(baseSnapshot.ano_letivo\)/);
  assert.match(builder, /row\.year > targetYear/);
  assert.match(builder, /row\.year == null/);
});

test("portal do aluno escolhe a matrícula do ano solicitado", () => {
  const portal = src("app/api/aluno/documentos/emitir/route.ts");
  assert.match(portal, /resolveBoletimMatricula\(supabase/);
  assert.match(portal, /p_session_id: context\.anoLetivoId/);
  assert.match(portal, /p_matricula_id: matriculaId/);
  const policy = readFileSync(resolve(process.cwd(), '../../supabase/migrations/20271203004000_documentos_individuais_gratuidade_ssot.sql'), 'utf8');
  assert.match(policy, /m\.aluno_id=p_aluno_id AND m\.session_id=p_session_id/);
  assert.match(policy, /AND matricula_id = v_matricula/);
  assert.doesNotMatch(portal, /order\('ano_letivo', \{ ascending: false \}\)/);
  assert.match(portal, /Tipo e serviço documental incompatíveis/);
});

test("declaração com notas tem página própria vinculada ao histórico exato", () => {
  const print = src("app/secretaria/documentos/[docId]/notas/print/page.tsx");
  assert.match(print, /doc.tipo !== "declaracao_notas"/);
  assert.match(print, /\.eq\("ano_letivo", ano\)/);
  assert.match(print, /historico.snapshot_status !== "fechado"/);
  assert.match(print, /historico_disciplinas/);
});

test("RPC do aluno não faz fallback para ano diferente", () => {
  const migration = readFileSync(resolve(process.cwd(), "../../supabase/migrations/20271203001000_exact_year_aluno_documento_final.sql"), "utf8");
  assert.match(migration, /CREATE OR REPLACE FUNCTION public.aluno_emitir_documento_final/);
  assert.doesNotMatch(migration, /ORDER BY ano_letivo DESC, id DESC LIMIT 1/);
  assert.match(migration, /AND ano_letivo = p_ano_letivo/);
});

test("certificado não cobra nem emite quando histórico fechado não tem notas", () => {
  const eligibility = src("lib/documentos/certificadoElegibilidade.ts");
  const api = src("app/api/secretaria/documentos/emitir/route.ts");
  const client = src("components/secretaria/DocumentosEmissaoHubClient.tsx");
  assert.match(eligibility, /snapshot_status !== "fechado"/);
  assert.match(eligibility, /disciplinas.length === 0/);
  assert.match(eligibility, /raw == null \|\| raw === ""/);
  assert.match(eligibility, /nota < 0 \|\| nota > 20/);
  assert.match(api, /verificarCertificadoElegivel/);
  assert.match(api, /Abrir Reconciliação Histórica/);
  assert.match(client, /errorAction\.href/);
});

test("impressão nunca exibe diploma oficial com notas ocultas por erro de leitura", () => {
  const print = src("app/aluno/documentos/[docId]/_final/FinalDocumentPrint.tsx");
  const builder = src("lib/documentos/certificadoSnapshot.ts");
  const portal = src("app/api/aluno/documentos/emitir/route.ts");
  assert.match(print, /if \(certificadoPendente\)/);
  assert.match(print, /certificado\.disciplinas\.length === 0/);
  assert.match(builder, /throw new Error\("Não foi possível carregar as fontes oficiais do certificado/);
  assert.match(builder, /source\.year === targetYear/);
  assert.match(portal, /aluno_documento_acesso/);
  const policy = readFileSync(resolve(process.cwd(), '../../supabase/migrations/20271203004000_documentos_individuais_gratuidade_ssot.sql'), 'utf8');
  assert.match(policy, /p_tipo IN \('certificado','declaracao_notas'\)/);
  assert.match(policy, /NOTAS_INCOMPLETAS/);
});

test("RPCs impedem emissão e cobrança sem notas antes da impressão", () => {
  const fs = readFileSync(resolve(process.cwd(), "../../supabase/migrations/20271203002000_documentos_individuais_pagamento_ssot.sql"), "utf8");
  const student = readFileSync(resolve(process.cwd(), "../../supabase/migrations/20271203001000_exact_year_aluno_documento_final.sql"), "utf8");
  assert.match(fs, /IF p_tipo = 'certificado' THEN/);
  assert.match(fs, /NOTAS_INEXISTENTES/);
  assert.match(fs, /NOTAS_INCOMPLETAS/);
  assert.match(student, /CERTIFICADO_NOTAS_INCOMPLETAS/);
});

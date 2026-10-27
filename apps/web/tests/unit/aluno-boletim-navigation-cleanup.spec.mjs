import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';

const src = new URL('../../src/', import.meta.url);
const read = (path) => readFileSync(new URL(path, src), 'utf8');

test('a Secretaria mantém dois endereços, mas apenas uma composição de Documentos', () => {
  const alias = read('app/secretaria/(portal-secretaria)/documentos/page.tsx');
  const canonical = read('app/escola/[id]/(portal)/secretaria/(portal-secretaria)/documentos/page.tsx');
  const workspace = read('components/secretaria/SecretariaDocumentosWorkspace.tsx');
  for (const page of [alias, canonical]) {
    assert.match(page, /<SecretariaDocumentosWorkspace escolaId=\{escolaId\}/);
    assert.doesNotMatch(page, /<DocumentosEmissaoHubClient/);
    assert.doesNotMatch(page, /<DocumentosAprovacoesQueue/);
  }
  assert.match(canonical, /^"use client"/);
  assert.match(workspace, /buildPortalHref\(escolaParam, "\/secretaria\/recebimentos"\)/);
  assert.equal((workspace.match(/<DocumentosEmissaoHubClient/g) ?? []).length, 1);
  assert.equal((workspace.match(/<DocumentosAprovacoesQueue/g) ?? []).length, 1);
});

test('a navegação de boletim não usa /aluno/notas inexistente e preserva o aluno', () => {
  const docs = read('components/aluno/tabs/TabDocumentos.tsx');
  const notas = read('components/aluno/tabs/TabNotas.tsx');
  assert.doesNotMatch(docs, /\/aluno\/notas/);
  assert.match(docs, /buildPortalHref\(escolaSlug, `\/aluno\/academico/);
  assert.match(docs, /queryParams\.set\("studentId", studentId\)/);
  assert.match(docs, /queryParams\.set\("ano_letivo_id", academicYearId\)/);
  assert.match(notas, /buildPortalHref\(escolaSlug, `\/aluno\/documentos/);
});

test('um único serviço inicia novos pedidos de boletim, preservando pagamentos legados', () => {
  const docs = read('components/aluno/tabs/TabDocumentos.tsx');
  const notas = read('components/aluno/tabs/TabNotas.tsx');
  const access = read('lib/aluno/boletimAccess.ts');
  assert.match(docs, /requestedService === BOLETIM_LEGACY_SERVICE_CODE \? BOLETIM_SERVICE_CODE/);
  assert.match(docs, /doc.codigo !== BOLETIM_LEGACY_SERVICE_CODE/);
  assert.doesNotMatch(notas, /servicos.find\(\(item\) => item.codigo === "DOC_DECLARACAO_NOTAS"/);
  assert.match(notas, /item.codigo === BOLETIM_SERVICE_CODE/);
  assert.match(access, /BOLETIM_SERVICE_CODES = \["DOC_BOLETIM_TRIMESTRAL", "DOC_DECLARACAO_NOTAS"\]/);
});

test('a fila de documentos gratuitos não aprova o boletim pago; documentos oficiais continuam', () => {
  const decisions = read('app/api/secretaria/documentos/aprovacoes/route.ts');
  assert.doesNotMatch(decisions, /DOC_BOLETIM_TRIMESTRAL/);
  assert.doesNotMatch(decisions, /DOC_DECLARACAO_NOTAS/);
  const hub = read('components/secretaria/DocumentosEmissaoHubClient.tsx');
  assert.match(hub, /declaracao_notas: "DOC_DECLARACAO_NOTAS"/);
  assert.match(hub, /boletim_trimestral: "DOC_BOLETIM_TRIMESTRAL"/);
});

test('o antigo portal paralelo não existe, e a emissão do boletim continua em API única', () => {
  assert.equal(existsSync(new URL('modelo_portal_do_aluno', src)), false);
  const docs = read('components/aluno/tabs/TabDocumentos.tsx');
  const notes = read('components/aluno/tabs/TabNotas.tsx');
  const compat = read('app/api/aluno/documentos/emitir/route.ts');
  assert.match(docs, /\/api\/aluno\/boletim\/pdf/);
  assert.match(notes, /\/api\/aluno\/boletim\/pdf/);
  assert.match(compat, /\/api\/aluno\/boletim\/pdf/);
  assert.doesNotMatch(compat, /renderToBuffer|\.upload\(/);
});

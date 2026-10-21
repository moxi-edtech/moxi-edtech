import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAT_RESPONSE_TOKEN_CEILING, CHAT_SUMMARY_WORD_TARGET, presentChatResponse,
  extractChatTables, canSubmitChatKey, chatContextKey,
} from '../../src/lib/assistant/chat-presentation';

test('golden mock: concise answer has no preamble and stays within word target', () => {
  const result = presentChatResponse('43 cobranças estão pendentes de confirmação. Consulte o Financeiro para rever os valores.\n\nFonte: fonte sintética; ano 2026.');
  assert.match(result.summary, /^43 cobranças/);
  assert.ok(result.summary.split(/\s+/).length <= CHAT_SUMMARY_WORD_TARGET);
  assert.match(result.details, /Fonte: fonte sintética/);
  assert.ok(CHAT_RESPONSE_TOKEN_CEILING <= 384);
});

test('golden mock: permission denial stays actionable, single sentence', () => {
  const result = presentChatResponse('Sem permissão para consultar notas desta escola. Peça acesso à direcção.');
  assert.match(result.summary, /Sem permissão/);
  assert.match(result.summary, /Peça acesso/);
  assert.equal(result.details, '');
});

test('golden mock: semantic table with complete rows, never a partial numeric truncation', () => {
  const result = presentChatResponse('Há 43 cobranças, de um total de 80, por confirmar.\n\n| Turma | Cobranças |\n| --- | ---: |\n| A | 23 cobranças |\n| B | 20 cobranças |\n\nFonte: visão sintética.');
  assert.equal(result.tables[0].headers[1], 'Cobranças');
  assert.equal(result.tables[0].rows[1][1], '20 cobranças');
  assert.match(result.summary, /43 cobranças, de um total de 80/);
  assert.match(result.details, /Fonte: visão sintética/);
});

test('golden mock: follow-up is bounded to complete lines and retains pagination', () => {
  const result = presentChatResponse('Há 8 docentes na primeira página.\n\n1. Docente Sintético 01 — Turma A\n2. Docente Sintético 02 — Turma B\n\nPágina 1 de 4; use Próxima página.');
  assert.match(result.summary, /8 docentes/);
  assert.match(result.details, /Página 1 de 4/);
  assert.match(result.details, /Docente Sintético 02/);
});

test('IME, desktop/mobile Enter behavior and Shift+Enter', () => {
  const key = {key:'Enter', shiftKey:false, isComposing:false};
  assert.equal(canSubmitChatKey(key,false),true);
  assert.equal(canSubmitChatKey(key,true),false);
  assert.equal(canSubmitChatKey({...key,shiftKey:true},false),false);
  assert.equal(canSubmitChatKey({...key,isComposing:true},false),false);
  assert.equal(canSubmitChatKey({...key,keyCode:229},false),false);
});

test('scope isolation for user, school, academic year and polo', () => {
  const a = chatContextKey('user-a','school-a','year-a','polo-a');
  for (const changed of [
    chatContextKey('user-b','school-a','year-a','polo-a'),
    chatContextKey('user-a','school-b','year-a','polo-a'),
    chatContextKey('user-a','school-a','year-b','polo-a'),
    chatContextKey('user-a','school-a','year-a','polo-b'),
  ]) assert.notEqual(a,changed);
  assert.deepEqual(extractChatTables('Uma linha normal').tables,[]);
});

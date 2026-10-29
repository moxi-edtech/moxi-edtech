import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  ADMISSION_INBOX_STATUSES,
  getAdmissionInboxNextStep,
  type AdmissionInboxStatus,
} from '../../src/lib/admissoes/inbox-next-step';

const expectedPrimary: Record<AdmissionInboxStatus, string> = {
  rascunho: 'share_link',
  pre_candidatura: 'promote',
  submetida: 'review_documents',
  documentos_reenviados: 'review_documents',
  em_analise: 'review_documents',
  aprovada: 'convert',
  aguardando_pagamento: 'convert',
  aguardando_compensacao: 'convert',
  rejeitada: 'next_candidate',
  arquivada: 'next_candidate',
  arquivado: 'next_candidate',
  matriculado: 'next_candidate',
  pendente: 'review_documents',
  lista_espera: 'approve',
};

test('todos os 14 estados da candidatura possuem uma próxima ação explícita', () => {
  assert.equal(ADMISSION_INBOX_STATUSES.length, 14);
  for (const status of ADMISSION_INBOX_STATUSES) {
    const step = getAdmissionInboxNextStep(status);
    assert.equal(step.action, expectedPrimary[status], status);
    assert.ok(step.title.trim(), status);
    assert.ok(step.description.trim(), status);
    assert.ok(step.actionLabel.trim(), status);
    assert.ok(step.listLabel.trim(), status);
    assert.ok(!/(rpc|SSOT|migration|SQL|RLS)/i.test(step.title + ' ' + step.description), status);
  }
});

test('revisão documental precede aprovação ou aceitação de ficheiros reenviados', () => {
  for (const status of ['submetida', 'em_analise'] as const) {
    assert.equal(getAdmissionInboxNextStep(status, 'resumo').action, 'review_documents');
    assert.equal(getAdmissionInboxNextStep(status, 'documentos').action, 'approve');
    assert.equal(getAdmissionInboxNextStep(status, 'historico').action, 'review_documents');
  }
  assert.equal(getAdmissionInboxNextStep('documentos_reenviados', 'resumo').action, 'review_documents');
  assert.equal(getAdmissionInboxNextStep('documentos_reenviados', 'documentos').action, 'accept_documents');
});

test('pendência orienta acompanhamento sem enviar pedidos duplicados automaticamente', () => {
  const pending = getAdmissionInboxNextStep('pendente');
  assert.equal(pending.action, 'review_documents');
  assert.match(pending.description, /já foi enviado/);
  const documentsOpened = getAdmissionInboxNextStep('pendente', 'documentos');
  assert.equal(documentsOpened.action, 'review_history');
  assert.equal(getAdmissionInboxNextStep('pendente', 'historico').action, 'review_documents');
});

test('estados terminais recomendam atender próximo sem reabrir/alterar o registo', () => {
  for (const status of ['matriculado', 'rejeitada', 'arquivada', 'arquivado'] as const) {
    assert.equal(getAdmissionInboxNextStep(status).action, 'next_candidate');
  }
});

test('pagamento pendente e em validação têm orientações diferentes, sem alegar pagamento confirmado', () => {
  const newPayment = getAdmissionInboxNextStep('aguardando_pagamento');
  const validating = getAdmissionInboxNextStep('aguardando_compensacao');
  assert.equal(newPayment.action, 'convert');
  assert.equal(validating.action, 'convert');
  assert.match(newPayment.actionLabel, /Registar pagamento/);
  assert.match(validating.actionLabel, /Validar pagamento/);
  assert.match(newPayment.description, /efetivamente recebido/);
  assert.match(validating.description, /Confira a compensação/);
});

test('estado desconhecido não dispara aprovação ou qualquer escrita', () => {
  assert.equal(getAdmissionInboxNextStep('inesperado').action, 'review_history');
  assert.equal(getAdmissionInboxNextStep(null).action, 'review_history');
});

test('a UI usa a mesma fonte nas linhas e no detalhe e uma única ação principal', () => {
  const inbox = readFileSync('src/components/secretaria/AdmissoesInboxClient.tsx', 'utf8');
  assert.match(inbox, /getAdmissionInboxNextStep\(item\.status\)/);
  assert.match(inbox, /aria-label="Próxima ação da candidatura"/);
  assert.match(inbox, /A seguir: <span/);
  assert.match(inbox, /completedCandidateId === selectedId \? 'matriculado'/);
  assert.match(inbox, /onClick=\{handleNextAction\}/);
  assert.equal((inbox.match(/onClick=\{handleNextAction\}/g) ?? []).length, 1);
  assert.match(inbox, /case 'review_documents':\s*setDetailTab\('documentos'\)/);
  assert.match(inbox, /case 'review_history':\s*setDetailTab\('historico'\)/);
  assert.match(inbox, /case 'approve':\s*void handleApprove\(\)/);
  assert.match(inbox, /case 'accept_documents':\s*void handleAcceptReuploadedDocuments\(\)/);
  assert.match(inbox, /case 'convert':\s*setIsConversionOpen\(true\)/);
  assert.match(inbox, /case 'next_candidate':\s*handleNextCandidate\(\)/);
  assert.doesNotMatch(inbox, /setSelectedId\(filteredItems\[currentIndex \+ 1\]\.id\)/);
});

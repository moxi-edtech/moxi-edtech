import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getAdmissionInboxNextStep } from '../../src/lib/admissoes/inbox-next-step';

const route = (path: string) => readFileSync('src/app/api/secretaria/admissoes/' + path + '/route.ts', 'utf8');
const inbox = readFileSync('src/components/secretaria/AdmissoesInboxClient.tsx', 'utf8');
const conversion = readFileSync('src/components/secretaria/AdmissaoConversionSheet.tsx', 'utf8');

test('efetivar matrícula usa a folha, endpoint e RPC canónica', () => {
  assert.match(inbox, /case 'convert':\s*setIsConversionOpen\(true\)/);
  assert.match(inbox, /isConversionOpen && <AdmissaoConversionSheet/);
  assert.match(conversion, /onClick=\{\(\) => void handleEfetivar\(\)\}/);
  assert.match(conversion, /fetch\('\/api\/secretaria\/admissoes\/draft'/);
  assert.match(conversion, /fetch\('\/api\/secretaria\/admissoes\/convert'/);
  assert.match(conversion, /'Idempotency-Key': idempotencyKey/);
  assert.match(conversion, /candidatura_id: candidaturaId/);
  assert.match(conversion, /turma_id: academic\.turmaId/);
  assert.match(conversion, /onSuccess\(json\.matricula_id\)/);
  const api = route('convert');
  assert.match(api, /supabase\.rpc\('admissao_finalizar_matricula'/);
  for (const param of ['p_escola_id:', 'p_candidatura_id:', 'p_turma_id:', 'p_pagamento:', 'p_idempotency_key:', 'p_observacao:', 'p_override_capacidade:', 'p_override_motivo:']) {
    assert.ok(api.includes(param), param);
  }
  assert.match(api, /if \(!idempotencyKey\)/);
  assert.ok(api.includes("inspectDecreeSync(supabase as any, escolaId, targetYear)"));
  assert.ok(api.includes('.eq("escola_id", escolaId)'));
  assert.match(api, /targetYear == null/);
});

test('o endpoint financeiro separa pagamento do recibo e mantém idempotência', () => {
  const api = route('convert');
  assert.match(api, /rpc\("financeiro_registrar_pagamentos_secretaria_batch"/);
  assert.match(api, /rpc\("financeiro_registrar_pagamento_secretaria"/);
  assert.match(api, /rpc\('emitir_recibo_servicos'/);
  assert.match(api, /idempotencyKey\}:pagamento/);
  assert.match(api, /pagamento_id: pagamento\?\.id \?\? null/);
  assert.match(api, /status: 'pending'/);
});

test('guardar candidatura existente nunca cria silenciosamente outra candidatura', () => {
  const api = route('draft');
  assert.match(api, /rpc\("admissao_upsert_draft", rpcArgs\)/);
  assert.match(api, /candidaturaId && candidatura_id !== candidaturaId/);
  assert.match(api, /ADMISSION_DRAFT_ID_MISMATCH/);
  assert.doesNotMatch(api, /const retry = await supabase\.rpc\("admissao_upsert_draft"/);
});

test('replay de matrícula e idempotência exigem permissão e isolamento da candidatura', () => {
  const api = route('convert');
  const authIndex = api.indexOf('const { error: authError } = await requireRoleInSchool');
  const completedIndex = api.indexOf('if (statusAtual === "matriculado"');
  assert.ok(authIndex > 0 && completedIndex > authIndex, 'authorization before replay');
  assert.match(api, /ADMISSION_IDEMPOTENCY_SCOPE_MISMATCH/);
  assert.match(api, /\.eq\("scope", "admissao_finalizar_matricula"\)/);
});

test('demais operações usam as RPCs reais com parâmetros instalados', () => {
  const mappings: Array<[string, RegExp, string[]]> = [
    ['approve', /supabase\.rpc\('admissao_approve'/, ['p_escola_id', 'p_candidatura_id', 'p_observacao']],
    ['pendencias', /supabase\.rpc\('admissao_marcar_pendencias_documentos'/, ['p_escola_id', 'p_candidatura_id', 'p_pendencias', 'p_motivo']],
    ['revisar-documentos', /supabase\.rpc\('admissao_revisar_documentos_reenviados'/, ['p_escola_id', 'p_candidatura_id', 'p_motivo']],
    ['archive', /supabase\.rpc\("admissao_archive"/, ['p_escola_id', 'p_candidatura_id', 'p_motivo']],
    ['reject', /supabase\.rpc\('admissao_reject'/, ['p_escola_id', 'p_candidatura_id', 'p_motivo', 'p_metadata']],
    ['reabrir', /rpc\(rpcName as "admissao_unsubmit" \| "admissao_reabrir"/, ['p_escola_id', 'p_candidatura_id', 'p_motivo']],
    ['[id]/promover', /rpc\("admissao_promover_pre_candidatura"/, ['p_escola_id', 'p_candidatura_id', 'p_turma_id', 'p_idempotency_key']],
  ];
  for (const [path, pattern, params] of mappings) {
    const api = route(path);
    assert.match(api, pattern, path);
    for (const p of params) assert.ok(api.includes(p + ':'), path + ': ' + p);
    assert.match(api, /requireRoleInSchool\(/, path);
  }
});

test('lista de espera usa matrícula com verificação de capacidade, não aprovação simples', () => {
  assert.equal(getAdmissionInboxNextStep('lista_espera').action, 'convert');
  assert.match(inbox, /const APPROVABLE_STATUSES:[^\n]*\['submetida', 'em_analise', 'pendente'\]/);
  assert.match(route('convert'), /TURMA_LOTADA_CAPACIDADE/);
});

test('ações secundárias respeitam o conjunto de transições das RPCs', () => {
  assert.match(inbox, /const REJECTABLE_STATUSES:[^\n]*'aguardando_compensacao'/);
  assert.doesNotMatch(inbox, /const REJECTABLE_STATUSES:[^\n]*'pre_candidatura'/);
  assert.doesNotMatch(inbox, /const ARCHIVABLE_STATUSES:[^\n]*'rejeitada'/);
  assert.doesNotMatch(inbox, /const REOPENABLE_STATUSES:[^\n]*'arquivado'/);
});

test('replay de conversão não pode mudar turma nem usar matrícula desaparecida', () => {
  const api = route('convert');
  assert.match(api, /ADMISSION_ALREADY_MATRICULATED_OTHER_CLASS/);
  assert.match(api, /ADMISSION_MATRICULA_NOT_FOUND/);
  assert.match(api, /idempotencyResult\.turma_id/);
  assert.match(api, /matricula\.turma_id !== turma_id/);
});

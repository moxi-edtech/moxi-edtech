import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import Access from '../../src/lib/aluno/boletimAccess.ts';
const { isBoletimPaid, checkBoletimAccess } = Access;
import Notas from '../../src/lib/aluno/boletimNotas.ts';
const { organizarNotasLancadas, loadNotasLancadas } = Notas;
import Pdf from '../../src/lib/aluno/boletimPdf.ts';
const { criarPdfBoletim } = Pdf;

const ESCOLA_A = 'escola-a';
const ESCOLA_B = 'escola-b';
const A = 'aluno-a';
const B = 'aluno-b';
const MAT_A = 'matricula-a';
const MAT_B = 'matricula-b';
const GRANT = { escola_id: ESCOLA_A, aluno_id: A, matricula_id: MAT_A, servico_codigo: 'DOC_BOLETIM_TRIMESTRAL', status: 'granted', valor_cobrado: 4000, pagamento_intents: [{ status: 'settled' }] };

function bancoFalso(tabelas, errorTable = null) {
  const queries = [];
  return {
    queries,
    from(nome) {
      const filtros = [];
      queries.push({ tabela: nome, filtros });
      const query = {
        select() { return query; },
        eq(chave, valor) { filtros.push((row) => row[chave] === valor); return query; },
        gt(chave, valor) { filtros.push((row) => Number(row[chave]) > valor); return query; },
        in(chave, valores) { filtros.push((row) => valores.includes(row[chave])); return query; },
        order() { return query; },
        limit(limite) { return Promise.resolve({ data: (tabelas[nome] ?? []).filter((row) => filtros.every((filter) => filter(row))).slice(0, limite), error: nome === errorTable ? { message: 'sem conexão' } : null }); },
      };
      return query;
    },
  };
}

test('taxa liquidada e concedida libera notas somente da matrícula correspondente', async () => {
  const pedidos = [
    GRANT,
    { ...GRANT, escola_id: ESCOLA_B, aluno_id: B, matricula_id: MAT_B },
  ];
  const db = bancoFalso({ servico_pedidos: pedidos });
  assert.deepEqual(await checkBoletimAccess(db, { escolaId: ESCOLA_A, alunoId: A, matriculaId: MAT_A }), { granted: true, error: false });
  assert.deepEqual(await checkBoletimAccess(db, { escolaId: ESCOLA_A, alunoId: B, matriculaId: MAT_A }), { granted: false, error: false });
  assert.deepEqual(await checkBoletimAccess(db, { escolaId: ESCOLA_B, alunoId: A, matriculaId: MAT_A }), { granted: false, error: false });
  assert.deepEqual(await checkBoletimAccess(db, { escolaId: ESCOLA_A, alunoId: A, matriculaId: MAT_B }), { granted: false, error: false });
  assert.ok(db.queries.every(({ filtros }) => filtros.length >= 4));
});

test('não desbloqueia por comprovativo pendente, cancelado, gratuito ou liquidação sem concessão', async () => {
  for (const variant of [
    { status: 'pending_payment' },
    { status: 'canceled' },
    { valor_cobrado: 0 },
    { pagamento_intents: [{ status: 'pending' }] },
    { pagamento_intents: [{ status: 'draft' }] },
    { pagamento_intents: [] },
  ]) {
    const order = { ...GRANT, ...variant };
    assert.equal(isBoletimPaid([order]), false, JSON.stringify(variant));
    assert.equal((await checkBoletimAccess(bancoFalso({ servico_pedidos: [order] }), { escolaId: ESCOLA_A, alunoId: A, matriculaId: MAT_A })).granted, false);
  }
  const legacyPaid = { ...GRANT, servico_codigo: 'DOC_DECLARACAO_NOTAS' };
  assert.equal(isBoletimPaid([legacyPaid]), true, 'pagamento legado não exige nova cobrança');
  assert.equal(isBoletimPaid([{ ...legacyPaid, valor_cobrado: 0 }]), false);
});

test('validação pela secretaria muda a autorização sem login adicional', async () => {
  const pedido = { ...GRANT, status: 'pending_payment', pagamento_intents: [{ status: 'pending' }] };
  const db = bancoFalso({ servico_pedidos: [pedido] });
  const scope = { escolaId: ESCOLA_A, alunoId: A, matriculaId: MAT_A };
  assert.equal((await checkBoletimAccess(db, scope)).granted, false);
  pedido.status = 'granted';
  pedido.pagamento_intents[0].status = 'settled';
  assert.equal((await checkBoletimAccess(db, scope)).granted, true);
});

test('falha da consulta financeira bloqueia acesso, não inventa estado de pagamento', async () => {
  assert.deepEqual(await checkBoletimAccess(bancoFalso({ servico_pedidos: [GRANT] }, 'servico_pedidos'), { escolaId: ESCOLA_A, alunoId: A, matriculaId: MAT_A }), { granted: false, error: true });
});

const disciplinas = [
  { id: 'td-1', escola_id: ESCOLA_A, turma_id: 'turma-a', curso_matriz: { disciplina_id: 'mat', disciplinas_catalogo: { nome: 'Matemática' } } },
  { id: 'td-2', escola_id: ESCOLA_B, turma_id: 'turma-b', curso_matriz: { disciplina_id: 'port', disciplinas_catalogo: { nome: 'Português' } } },
];
const notas = [
  { escola_id: ESCOLA_A, matricula_id: MAT_A, valor: 0, avaliacao: { nome: 'Mini teste', tipo: 'MAC', trimestre: 1, turma_disciplina_id: 'td-1' } },
  { escola_id: ESCOLA_A, matricula_id: MAT_A, valor: 17, avaliacao: { nome: 'Prova', tipo: 'NPP', trimestre: 1, turma_disciplina_id: 'td-1' } },
  { escola_id: ESCOLA_A, matricula_id: MAT_A, valor: null, avaliacao: { nome: 'Não lançada', tipo: 'PT', trimestre: 1, turma_disciplina_id: 'td-1' } },
  { escola_id: ESCOLA_B, matricula_id: MAT_B, valor: 19, avaliacao: { nome: 'Prova', tipo: 'PT', trimestre: 2, turma_disciplina_id: 'td-2' } },
];

test('notas reais parciais incluem zero e não incluem avaliações sem lançamento nem outra escola', async () => {
  const db = bancoFalso({ notas, turma_disciplinas: disciplinas });
  const out = await loadNotasLancadas(db, { escolaId: ESCOLA_A, matriculaId: MAT_A, turmaId: 'turma-a' });
  assert.equal(out.length, 1);
  assert.equal(out[0].nome, 'Matemática');
  assert.deepEqual(out[0].avaliacoes.map((nota) => nota.nota), [0, 17]);
  assert.equal(out[0].avaliacoes[0].nome, 'Mini teste');
  const other = await loadNotasLancadas(db, { escolaId: ESCOLA_B, matriculaId: MAT_B, turmaId: 'turma-b' });
  assert.deepEqual(other.map((disc) => disc.nome), ['Português']);
  assert.deepEqual(organizarNotasLancadas([], []), []);
});

test('PDF mantém avaliações e pagina quando há muitas notas, sem exigir trimestre fechado', async () => {
  const avaliacoes = Array.from({ length: 125 }, (_, i) => ({ nome: `Avaliação ${i + 1}`, tipo: 'MAC', nota: i % 21, trimestre: (i % 3) + 1 }));
  const bytes = await criarPdfBoletim({
    nomeAluno: 'Aluno de Teste', escola: { nome: 'Escola de Teste' },
    disciplinas: [{ id: 'mat', nome: 'Matemática', avaliacoes }],
    dataEmissao: '13/10/2026 20:00',
  });
  const pdf = await PDFDocument.load(bytes);
  assert.ok(pdf.getPageCount() >= 3, `esperadas múltiplas páginas, obtidas ${pdf.getPageCount()}`);
  const empty = await PDFDocument.load(await criarPdfBoletim({ nomeAluno: 'Sem avaliações', escola: { nome: 'Escola de Teste' }, disciplinas: [], dataEmissao: '13/10/2026' }));
  assert.equal(empty.getPageCount(), 1);
});

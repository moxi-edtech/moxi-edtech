import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sql=readFileSync('supabase/migrations/20261018052421_retificacao_classe_matricula.sql','utf8');
const api=readFileSync('apps/web/src/app/api/secretaria/matriculas/[matriculaId]/rectify-class/route.ts','utf8');
const form=readFileSync('apps/web/src/components/secretaria/TransferForm.tsx','utf8');
for(const table of ['notas','notas_avaliacoes','melhoria_nota_pedidos','pautas_oficiais','pagamentos','financeiro_cobrancas','mensalidades','financeiro_contratos','financeiro_lancamentos','exame_resultados','frequencia_status_periodo']) {
 assert.match(sql,new RegExp('FROM public\\.'+table+'\\b'),'Missing link invariant '+table);
}
assert.match(sql,/v_m_apos\.aluno_id IS DISTINCT FROM v_m\.aluno_id/);
assert.match(sql,/v_m_apos\.session_id IS DISTINCT FROM v_m\.session_id/);
assert.match(sql,/v_historico_apos IS DISTINCT FROM v_historico/);
assert.match(sql,/RAISE EXCEPTION 'INTEGRIDADE:/);
assert.match(sql,/FOR UPDATE/);
assert.match(sql,/INSERT INTO public\.audit_logs/);
assert.match(sql,/p_confirmar_historico boolean DEFAULT false/);
assert.doesNotMatch(sql,/(DELETE FROM public\.|UPDATE public\.(notas|mensalidades|pagamentos|financeiro_|pautas))/i);
assert.match(api,/confirmar_historico: z\.boolean\(\)\.default\(false\)/);
assert.match(form,/confirmarHistorico/);
console.log('Class rectification identity and linkage contracts OK');

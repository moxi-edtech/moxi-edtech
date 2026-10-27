# Ano corrente, retificação de classe e reimpressão pós-pagamento — 27/10/2026

## Escopo e decisões

- `matriculas.session_id` e `anos_letivos.ativo` determinam o ano corrente da escola, não o ano visualizado na ficha nem a data civil do servidor.
- Matriculações do ano corrente têm estados explícitos: **ativa**, **pendente**, **sem matrícula** ou **reconciliação**. Duplicidade, turma/sessão incompatível e estado `status/ativo` divergente bloqueiam as ações.
- O perfil completo e o Command Center usam a mesma componente `CurrentYearEnrollmentPanel`.
- **Corrigir classe** usa a função transacional já aplicada `retificar_classe_matricula`: apenas admin/admin_escola, motivo mínimo 10 caracteres, prévia de impacto, confirmação de histórico, validação de capacidade, mesma sessão e curso, sem exclusão das notas ou mensalidades e com registo de auditoria. Correção de classe não é promoção/reprovação e não altera matrícula de ano anterior.
- **Confirmar matrícula corrente** nunca chama o RPC legado `confirmar_matricula`, que ativa matrículas diretamente. Reutiliza `finalizar_rematricula_balcao` exclusivamente para retomar uma **reserva pré-existente** que já tenha pedido de rematrícula associado, receita liquidada, recibo existente, sem dívida vencida da origem e com validação RAA. Nunca cria cobrança/taxa. Uma reserva sem pedido ou evidência suficiente vai para reconciliação/Balcão; o servidor não assume o resultado académico nem inventa vínculo financeiro.
- **Recibo após pagamento rápido:** a janela é reservada sincronicamente no clique; a chave idempotente da mesma tentativa é preservada; caso a resposta não tenha `print_url`, a interface consulta **apenas** `GET /api/secretaria/recibos/consultar` enquanto o worker emite o documento já pago. O estado **Pagamento confirmado — recibo em preparação** e um botão de consulta permanecem visíveis. A página oficial de impressão é a única a chamar `window.print`; não há segundo print dialog a partir do modal.
- O motor fiscal AGT mantém-se desligado; esta frente não altera `fiscal_*`, migrações ou dados financeiros.

## Dados reais auditados (leitura, sem mutação)

No ano ativo 2026/2027 da escola consultada: 509 matrículas ativas e uma reserva pendente. Essa reserva tem vínculo ao ano anterior, mas **não tem pedido `SERV_REMATRICULA` associado** e, por isso, não é elegível para ativação administrativa direta. A operação correta é a reconciliação pelo fluxo de rematrícula do Balcão. Não foi tocado nenhum registo real.

## Testes

`apps/web/tests/unit/current-year-enrollment-and-receipt-recovery.spec.ts`: recibo disponível após várias consultas, persistência de pendência sem POST adicional, recusa de URL externo, autorização e tenant do read model, scope do ano ativo, bloqueios de estado/duplicidade, evidência financeira e recibo antes de confirmar, integridade da retificação e composição da ficha/Command Center.

## Limites

- O navegador pode bloquear pop-ups; o link explícito de impressão permanece disponível.
- Uma abertura contabilizada do documento não comprova que o utilizador efetivamente imprimiu.
- Correções com notas e pauta anterior preservam os vínculos, mas exigem revisão administrativa das avaliações no destino.
- Recibos antigos inexistentes não são criados automaticamente pelo botão de consulta.
- Não aplicar a `main` nem publicar até typecheck, testes e workflows aprovados. É necessário smoke autenticado no ambiente de homologação antes do deploy final.

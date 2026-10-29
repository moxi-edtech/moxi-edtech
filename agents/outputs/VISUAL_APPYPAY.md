# AppyPay — validação visual local

Componente de produção renderizado pela fixture `apps/web/tests/fixtures/appypay-preview.mjs`, em 127.0.0.1:8782. Dados inteiramente fictícios; sem conexão a AppyPay/Supabase. A fixture exige expectedAmount=1500 no POST. Navegador do chat controlado por CUA.

| Cenário | Resultado observado |
|---|---|
| Abrir diálogo | Saldo e aviso exibidos; contador do servidor confirmou zero POSTs financeiros |
| Confirmar emissão | Entidade 00123, referência 123456789, valor 1 500 Kz e vencimento exibidos |
| Vencimento | 31/10/2030 23:59:59, explicitamente hora de Angola, independente do fuso brasileiro do navegador |
| Verificar pagamento no cenário paid | Só depois da resposta reconciled: texto Pagamento confirmado e registado |
| Escape | Diálogo fecha e foco volta ao botão Gerar referência |
| Erro de emissão incerta | Botão de nova emissão substituído por Consultar estado |
| Consultar após erro | Reserva pendente exibida; contador confirmou um único POST, sem repetição |
| Gateway disabled | Nenhum controle de emissão aparece |
| Versão final com expectedAmount | Fixture aceitou o POST do componente e exibiu a referência emitida |

Captura final: `/private/tmp/klasse-appypay-evidence/reference.jpg`.

Limites: esta prova cobre o componente com API de fixture; não prova sessão autenticada no portal publicado, pagamento no provedor, entrega real de webhook ou RLS completo de produção. A integração com as páginas reais é coberta pela compilação e pelos tipos do projeto; o fluxo financeiro completo ainda precisa do ensaio autorizado após publicação.

## Extensão do aluno — 2026-10-29
Botão StudentAppyPayButton real, servido pela mesma fixture com mode=service ou mode=monthly; solicitações incluem studentId, kind, targetId e saldo esperado. Cenário serviço: consulta exibiu Certificado escolar/1 500 Kz, servidor confirmou posts=0 antes da emissão; emissão explícita exibiu entidade/referência; Copiar dados exibiu sucesso; Verificar pagamento exibiu Pagamento confirmado e registado após resposta reconciled. A API da clipboard do navegador não retornou o conteúdo copiado; não afirmar validação do clipboard do sistema.

Cenário propina uncertain: um POST, retorno503, UI substituiu emissão por Consultar estado; a nova consulta exibiu reserva pendente. Contador do servidor confirmou posts=1, sem segunda emissão. Captura sintética /private/tmp/klasse-appypay-evidence/student-service.png.

Painel AppyPay real: webhooks Sem resultados; aplicação REF identificada. Formulário apenas inspecionado e cancelado, sem salvar. Nenhuma cobrança/validação financeira real feita.

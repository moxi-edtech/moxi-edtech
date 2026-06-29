# SOP-CRM-03 - Acompanhamento de Documentos de Onboarding no CRM

Versao: 1.1.0
Data: 2026-06-29
Modulo: CRM / Portal do Parceiro
Perfil principal: afiliado_membro (Operador do Parceiro)

## 1. Objetivo

Acompanhar documentos administrativos e cadastrais enviados pelos colégios parceiros durante as fases iniciais de onboarding, baixando arquivos, verificando pendencias visuais e cobrando reenvios quando necessario.

## 2. Quando usar

- Diariamente, ao auditar os uploads das escolas sob responsabilidade do escritório.
- Sempre que uma escola realizar a submissão de arquivos no portal público de acompanhamento.

## 3. Responsáveis

- **Acompanhamento Administrativo:** Equipe do parceiro (`afiliado_membro`), que baixa e confere visualmente documentos para cobrar correcoes da escola.
- **Validador Formal:** Super Admin da KLASSE (David Chocaliye) — responsavel pela aprovação/rejeição no sistema e pela aprovação final das planilhas de importação.
- **Escalonamento:** David Chocaliye (para redefinição de termos ou tratamento de exceções cadastrais).

## 4. Pré-condições

- Operador logado no portal `/influencers/[codigo]`.
- Escola em onboarding com uploads visiveis no detalhe da escola.

## 4.1 Estado fiel ao codigo

Validado contra `apps/web/src/app/influencers/[codigo]/page.tsx`, `apps/web/src/app/api/influencers/[codigo]/portal/route.ts` e `apps/web/src/app/api/super-admin/onboarding/uploads/[uploadId]/review/route.ts`.

- No portal do parceiro, os uploads aparecem no detalhe da escola em `Arquivos e Staging de Importação`.
- A UI do parceiro mostra nome do arquivo, status (`pendente`, `aprovado`, `rejeitado`), link `BAIXAR` e motivo quando estiver rejeitado.
- Nao existem botoes `Aprovar`, `Rejeitar` ou `Pré-validada pelo Parceiro` no portal `/influencers/[codigo]`.
- A revisao formal de upload existe no Super Admin em `POST /api/super-admin/onboarding/uploads/{uploadId}/review`.
- Portanto, aprovar/rejeitar documentos pelo parceiro e `NAO OPERACIONAL NO CODIGO ACTUAL`.

## 5. Passo a passo (execução)

1. **Abrir a escola em onboarding:** No portal do parceiro, acesse a area de onboarding e abra o detalhe da escola.
2. **Visualizar Arquivos:** No bloco `Arquivos e Staging de Importação`, identifique o colégio, a etapa, o status e baixe o arquivo em `BAIXAR`.
3. **Executar conferência visual (Critérios por Etapa):**
   - **NIF (docs_legais):** Abra o arquivo PDF e verifique se o número do NIF no documento oficial emitido pela AGT condiz com a Razão Social cadastrada. O documento deve estar legível e válido.
   - **Regulamento Interno (docs_legais):** Certifique-se de que o colégio submeteu o arquivo correto contendo o regimento administrativo escolar (usado para parametrização pedagógica posterior).
   - **Contrato Assinado (docs_legais):** Validar se o contrato está com todas as páginas e assinado digitalmente ou fisicamente com carimbo oficial do diretor legal da instituição.
   - **Planilha de Alunos/Professores (planilhas):** O parceiro realiza apenas uma conferencia visual rápida (se as colunas estão preenchidas e sem caracteres quebrados). A aprovação final e carga do banco são realizadas pelo Super Admin.
4. **Comunicar pendencias:** Se houver inconsistências, envie mensagem à secretaria da escola explicando o motivo e solicitando reenvio.
5. **Escalar para Super Admin:** Quando o arquivo estiver legivel e completo, sinalize ao Super Admin para revisao formal quando necessario.

NAO OPERACIONAL NO CODIGO ACTUAL:
- Aprovar upload pelo portal do parceiro.
- Rejeitar upload pelo portal do parceiro.
- Marcar planilha como `Pré-validada pelo Parceiro` no sistema.

## 6. Resultado esperado

- Escola orientada sobre pendencias de arquivo.
- Uploads acompanhados pelo parceiro, com status visivel no detalhe da escola.
- Revisao formal realizada pelo Super Admin quando aplicavel.

## 7. Erros comuns e correção

| Erro observado | Causa provável | Correção imediata | Escalar quando |
|---|---|---|---|
| Arquivo não abre (formato inválido) | A escola submeteu formato não suportado ou corrompido. | Solicitar reenvio em formato PDF ou PNG/JPG e escalar a revisão formal ao Super Admin quando necessario. | Caso o painel de visualização web apresente erro contínuo para formatos válidos. |
| Nao aparece botao Aprovar/Rejeitar | Funcao nao existe no portal do parceiro. | Encaminhar para Super Admin revisar no painel proprio. | Se houver necessidade de implementar revisao pelo parceiro. |

## 8. Evidências obrigatórias

- Print do arquivo/status no detalhe da escola.
- Print ou mensagem enviada à escola quando houver pendencia.
- Quando o Super Admin revisar, print do novo status no portal.

## 9. KPI operacional do procedimento

- **SLA de Acompanhamento:** Conferencia visual e cobrança de pendencias em até **24 horas úteis** após a submissão.
- **Taxa de acerto cadastral:** 100% dos NIFs aprovados correspondendo ao cadastro oficial na AGT.

## 10. Riscos e controles

- **Risco:** Informar à escola que o documento foi aprovado sem revisão formal.
  - *Controle:* O parceiro deve tratar sua conferencia como triagem; aprovação/rejeição formal fica no Super Admin no codigo atual.

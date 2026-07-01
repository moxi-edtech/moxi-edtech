# SOP-CRM-03 - Triagem e Acompanhamento de Documentos de Onboarding no CRM

Versao: 2.0.0
Data: 2026-07-01
Modulo: CRM / Portal do Parceiro
Perfil principal: afiliado_membro (Operador do Parceiro)

## 1. Objetivo

Acompanhar e realizar a triagem preliminar dos documentos administrativos e cadastrais enviados pelos colégios parceiros durante as fases de onboarding, classificando tipos de documento, apontando pendências imediatas e encaminhando arquivos validados para a homologação final da KLASSE.

## 2. Quando usar

- Diariamente, ao auditar os uploads das escolas sob responsabilidade do escritório.
- Sempre que uma escola realizar a submissão de arquivos no portal público de acompanhamento.

## 3. Responsáveis

- **Triagem Preliminar (Parceiro Comercial):** Operador do parceiro (`afiliado_membro`), responsável por inspecionar os arquivos baixados, classificar o tipo do documento e mover o status de triagem para a próxima etapa.
- **Validador Final (Super Admin da KLASSE):** Responsável por aprovar ou rejeitar definitivamente o documento no banco de dados para concluir a etapa de onboarding correspondente.

## 4. Pré-condições

- Operador logado no portal `/influencers/[codigo]`.
- Gaveta de detalhes da escola aberta (`OnboardingSchoolDetailsSheet`).
- Presença de uploads no bloco `Arquivos e Staging de Importação`.

## 4.1 Lógica de Status de Triagem no Código

Conforme implementado no banco de dados e na interface de triagem, os arquivos de upload possuem os seguintes estados operacionais:
* **`pendente` / `processando`:** Estado inicial após o upload pela escola.
* **`em_revisao_parceiro`:** O operador do parceiro iniciou a análise do documento.
* **`pendencia_cliente`:** O parceiro identificou um erro (ex: documento ilegível ou incompleto) e devolveu para correção da escola (exige nota explicativa).
* **`pronto_para_klasse`:** O parceiro validou a triagem básica e encaminhou para a homologação definitiva da equipe KLASSE.
* **`aprovado` / `rejeitado`:** Status finais e imutáveis definidos pelo Super Admin da KLASSE. Uma vez neste estado, a triagem do parceiro é travada para este arquivo.

## 5. Passo a passo (execução)

1. **Acessar os Uploads:** No portal do parceiro, abra o Drawer de Detalhes da Escola e role até a seção **Arquivos e Staging de Importação**.
2. **Baixar o Documento:** Clique em `BAIXAR` para inspecionar o arquivo enviado pela escola.
3. **Executar Conferência Visual (Critérios por Categoria):**
   - **Documento Legal (NIF, etc.):** Verifique se o NIF no papel coincide com a Razão Social da escola e se está nítido.
   - **Regulamento Interno / Matriz:** Verifique se as páginas estão completas e se o arquivo corresponde ao regimento pedagógico da escola.
   - **Contrato Assinado:** Valide a assinatura do Diretor Geral da escola e o carimbo oficial.
4. **Classificar o Documento:**
   - No dropdown **"Classificar documento"**, selecione a categoria apropriada: `legal` (docs legais), `planilha` (dados escolares), `contrato` (contrato assinado), `logotipo`, `pauta`, `termo_aceite` ou `outro`.
5. **Definir Status da Triagem:**
   - No dropdown de status, selecione:
     * `Em Revisão (Parceiro)` se estiver analisando.
     * `Pendência Cliente` se houver alguma pendência e precisar de reenvio.
     * `Pronto para KLASSE` se o documento estiver correto.
6. **Escrever Nota Técnica:**
   - No campo de texto correspondente, insira observações relevantes. **Importante:** Se o status for `Pendência Cliente`, descreva detalhadamente o erro técnico para orientar a escola na correção.
7. **Salvar a Triagem:** Clique em `Salvar triagem`. A ação atualizará o banco via API de forma transparente e notificará a equipe de auditoria da KLASSE.

## 6. Resultado esperado

- Triagem documental realizada de forma fluida pelo operador comercial.
- Pendências técnicas sinalizadas imediatamente à escola parceira com descrições claras de correção.
- Documentação limpa e classificada disponível para homologação final da KLASSE.

## 7. Erros comuns e correção

| Erro observado | Causa provável | Correção imediata | Escalar quando |
|---|---|---|---|
| Erro "Classifique o tipo de documento antes de salvar" | O operador tentou salvar a triagem sem escolher a categoria do arquivo. | Selecione o tipo correto no dropdown "Classificar documento". | - |
| Erro "Informe a pendência..." ao selecionar Pendência Cliente | O operador tentou recusar o documento sem preencher o campo de observações. | Escreva uma nota explicativa sobre a correção necessária no campo de comentário. | - |
| Opções de triagem bloqueadas ou ocultas | O documento já foi analisado e obteve parecer final (`aprovado` ou `rejeitado`) pelo Super Admin da KLASSE. | Nenhuma ação necessária; documentos com parecer final não podem ser retriados pelo parceiro. | Se houver erro material no parecer final que exija reabertura pela KLASSE. |

## 8. Evidências obrigatórias

- Registro visual do status atualizado do arquivo na seção de staging da escola.
- Notas de pendências enviadas à escola em caso de reenvio necessário.

## 9. KPI operacional do procedimento

- **SLA de Triagem:** Triagem documental realizada em até **24 horas úteis** após a submissão da escola.
- **Índice de Retrabalho:** Menos de 5% de documentos classificados como "Pronto para KLASSE" rejeitados posteriormente na homologação final.

## 10. Risks e controles

- **Risco:** Encaminhar documentos ilegíveis ou incompletos para a KLASSE, atrasando a homologação final.
  - *Controle:* O operador deve baixar e conferir visualmente 100% dos arquivos antes de marcar como `pronto_para_klasse`.

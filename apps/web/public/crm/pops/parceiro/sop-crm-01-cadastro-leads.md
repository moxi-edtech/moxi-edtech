# SOP-CRM-01 - Cadastro e Qualificação de Leads no CRM Comercial

Versao: 1.1.0
Data: 2026-06-29
Modulo: CRM / Portal do Parceiro
Perfil principal: afiliado_membro (Operador do Parceiro)

## 1. Objetivo

Cadastrar e qualificar novos colégios privados em prospecção na base de dados do CRM da KLASSE, registrando os termos iniciais acordados (plano, alunos estimados, trial e taxa de ativação).

## 2. Quando usar

- Ao realizar a primeira abordagem comercial com um colégio em Luanda.
- Ao agendar uma demonstração do sistema para um diretor de escola.
- Sempre que houver negociação ativa de novos contratos.

## 3. Responsáveis

- **Executor:** Membro/Operador do parceiro (`afiliado_membro`) que está realizando a venda.
- **Apoiador técnico:** Engenharia da KLASSE (para validação técnica do colégio).
- **Escalonamento:** David Chocaliye (Super Admin da KLASSE), caso haja necessidade de planos personalizados ou acima dos limites de tabela.

## 4. Pré-condições

- Operador autenticado no portal do parceiro `/influencers/[codigo]` usando seu PIN pessoal de membro.
- Informações básicas coletadas: Nome oficial da escola, nome do contato pedagógico/financeiro, telefone ativo e estimativa de alunos.

## 4.1 Estado fiel ao codigo

Validado contra `apps/web/src/app/influencers/[codigo]/page.tsx` e `apps/web/src/app/api/influencers/[codigo]/crm/leads/route.ts`.

- A aba real chama `CRM Pré-Vendas` / `Leads Comerciais`.
- O CTA real e `Novo Lead`; quando nao ha leads, tambem aparece `Cadastrar Primeiro Lead`.
- A criacao usa `POST /api/influencers/{codigo}/crm/leads` e a RPC `create_influencer_crm_lead`.
- O backend limita `trial_days` entre 0 e 30 e usa `15` como padrao; `taxa_ativacao` usa minimo 0 e padrao `50000`.

## 5. Passo a passo (execução)

1. **Acessar o CRM:** Acesse o painel do parceiro, navegue até a aba **CRM de Leads / Pipeline**.
2. **Abrir Novo Cadastro:** Clique em **Novo Lead** ou, quando a lista estiver vazia, **Cadastrar Primeiro Lead**.
3. **Preencher Informações Básicas:**
   - **Nome da Escola:** Digite o nome oficial completo do colégio.
   - **Nome do Contato:** Nome do Diretor, Secretário Geral ou responsável pela contratação.
   - **Telefone e E-mail:** Inserir contatos válidos (preferencialmente WhatsApp da escola para facilitar o follow-up).
4. **Definir Perfil Comercial:**
   - **Segmento:** Selecione `privada` (padrão de atuação contratual em Luanda).
   - **Plano Estimado:** Escolha entre `Essencial` (até 600 alunos), `Profissional` (até 1500 alunos) ou `Premium` (sob consulta).
   - **Alunos Estimados:** Digite o total de alunos projetados (usado para validar limites de plano e faturamento).
5. **Configurar Condições Financeiras (Crucial):**
   - **Período de Degustação (Trial Days):** Defina o número de dias de teste grátis negociado com a escola. **Limite máximo: 30 dias** (por SLA contratual). O padrão é 15 dias.
   - **Taxa de Ativação (Kz):** Defina o valor acordado para instalação e treinamento inicial. Valor padrão de tabela: **50.000 Kz a 100.000 Kz** (100% repassado ao parceiro).
6. **Definir Próxima Ação:**
   - Digite a próxima ação comercial (ex.: *"Demonstração presencial com os coordenadores"*) e selecione a data correspondente para follow-up.
7. **Salvar:** Clique em **Criar Lead**. O lead será inserido no pipeline na etapa "Pendente / Contato".

## 6. Resultado esperado

- Registro criado com sucesso na tabela `crm_leads` do banco de dados.
- O lead aparece no pipeline visual do parceiro em `/influencers/[codigo]`.
- Logs de auditoria criados registrando a autoria do cadastro pelo `member_id` do operador.

## 7. Erros comuns e correção

| Erro observado | Causa provável | Correção imediata | Escalar quando |
|---|---|---|---|
| Nome da escola duplicado | Lead já está cadastrado ou em atendimento por outro operador. | Pesquisar na barra de busca se o lead já existe. Se for de outro membro do mesmo escritório, conciliar internamente. | Se houver conflito de comissão por lead duplicado. |
| Erro de validação de e-mail | Formato de e-mail inválido. | Verificar se não há espaços em branco no final ou corrigir a grafia do domínio. | Se o sistema persistir em rejeitar e-mails válidos. |
| Botão "Criar Lead" desabilitado | Nome da escola ou campos obrigatórios vazios. | Preencher o nome da escola e o telefone de contato. | Caso o formulário esteja todo preenchido e mesmo assim travar. |

## 8. Evidências obrigatórias

- Visualização do cartão do lead no pipeline visual do portal.
- Registro da data da próxima ação e status atualizado para "Contato realizado" ou "Demonstração agendada".

## 9. KPI operacional do procedimento

- **Tempo médio de cadastro:** < 3 minutos por lead.
- **Taxa de completude de dados:** 100% dos leads salvos com telefone e estimativa de alunos.

## 10. Riscos e controles

- **Risco:** Cadastrar leads fictícios para inflar métricas comerciais do escritório.
  - *Controle:* Toda conversão de lead exige o upload posterior do NIF e documentos legais reais da escola para prosseguir para a fase de ativação.
- **Risco:** Oferecer trial acima de 30 dias.
  - *Controle:* O sistema de banco de dados possui uma `CHECK CONSTRAINT` que bloqueia a gravação de `trial_days` maior que 30.

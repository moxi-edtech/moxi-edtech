# POP-P2-02 - Mensalidades e Emolumentos (Admin)

Versao: 1.0.0
Data: 2026-04-03
Modulo: Admin da Escola
Perfil principal: admin_escola
Tempo medio alvo: 20-40 minutos

## 1. Objetivo

Padronizar o cadastro e manutencao de precos (propina/matricula) e do catalogo de servicos/documentos cobraveis.

## 2. Quando usar

- Implantacao inicial de tabela de precos.
- Revisao de valores por curso/classe.
- Inclusao ou manutencao de servicos avulsos e documentos.

## 3. Responsaveis

- Executor: Admin da Escola
- Co-responsavel: Financeiro/Secretaria
- Escalonamento: Suporte tecnico

## 4. Pre-condicoes

- Acesso a `Admin > Configuracoes > Mensalidades`.
- Escola correta selecionada.
- Regra interna de valores aprovada.

## 5. Procedimento A - Tabela de precos (propina e matricula)

1. Abrir `Mensalidades & Emolumentos`.
2. No card `Tabela de Preços`, operar o formulario `Nova Regra de Preço` ou `Editar Regra`.
3. Definir destino da regra:
- `Aplicar ao Curso` (ou todos)
- `Aplicar à Classe` (ou todas)
4. Definir valores:
- `Valor da Matrícula` (Kz)
- `Mensalidade (Propina)` (Kz)
5. Salvar como:
- `Criar Regra` para nova regra
- `Atualizar Regra` para edicao
6. Validar mensagem `Tabela salva com sucesso`.
7. Confirmar lista `Regras Ativas` atualizada.

## 6. Procedimento B - Simulacao de preco final

1. No bloco `Simulador de Preço Final`, selecionar curso e classe.
2. Conferir retorno de:
- valor de mensalidade
- valor de matricula
- `Fonte` da regra resolvida
3. Usar a simulacao para validar se a hierarquia de regras esta correta.

## 7. Procedimento C - Catalogo de servicos e documentos

1. No bloco `Catálogo de Serviços & Documentos`, clicar `Gerenciar catálogo`.
2. No modal `Catálogo de Serviços`, definir `Tipo de item`:
- `Serviço`
- `Documento`
3. Preencher:
- `Código`
- `Nome`
- `Preço (Kz)`
- `Status` (`Ativo`/`Inativo`)
- `Descrição` (opcional)
4. Regra obrigatoria para documento:
- codigo deve usar prefixo `DOC_`
5. Clicar `Salvar`.
6. Confirmar mensagem `Serviço salvo com sucesso.`
7. Fechar modal e manter rastreabilidade interna das mudancas.

## 8. Resultado esperado

- Regras de preco aplicadas por curso/classe conforme decisao da escola.
- Simulacao coerente com a regra ativa.
- Catalogo de servicos/documentos atualizado e utilizavel no balcao.

## 9. Erros comuns e correcao

| Erro observado | Causa provavel | Correcao imediata | Escalar quando |
|---|---|---|---|
| `Erro ao carregar preços` | Falha de leitura das tabelas | Atualizar pagina e repetir carga | Persistencia da falha |
| `Falha ao salvar preços` | Payload invalido ou indisponibilidade | Rever campos e tentar novamente | Falha recorrente |
| `Código e nome são obrigatórios.` | Campos obrigatorios vazios | Preencher ambos e salvar | Validacao bloqueando sem motivo |
| `Documentos devem usar prefixo DOC_.` | Codigo sem padrao de documento | Ajustar codigo para `DOC_*` | Regra continuar rejeitando codigo valido |
| `Falha ao carregar serviços` | API de catalogo indisponivel | Reabrir modal e recarregar | Erro recorrente no catalogo |

## 10. Evidencias obrigatorias

- Captura da regra de preco criada/atualizada.
- Captura da simulacao com curso/classe.
- Captura do item de catalogo salvo (codigo, nome, valor, status).
- Registo interno de operador e timestamp.

## 11. Referencia tecnica (fiel ao codigo)

- Catalogos de apoio:
- `GET /api/escolas/{escola}/cursos`
- `GET /api/escolas/{escola}/classes`
- `GET /api/secretaria/school-sessions`
- Tabelas de preco:
- `GET /api/financeiro/tabelas?...`
- `POST /api/financeiro/tabelas`
- `PATCH /api/financeiro/tabelas`
- Catalogo servicos:
- `GET /api/escola/{escola}/admin/servicos` (`cache: no-store`)
- `POST /api/escola/{escola}/admin/servicos`

## 12. Revisao e versao

- Ultima revisao: 2026-04-03
- Proxima revisao: 2026-04-17
- Mudancas desta versao: versao inicial P2 de mensalidades e emolumentos.

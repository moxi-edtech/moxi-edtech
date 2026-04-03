# POP-P3-03 - Documentos Oficiais em Lote (Admin)

Versao: 1.0.0
Data: 2026-04-03
Modulo: Admin da Escola
Perfil principal: admin_escola
Tempo medio alvo: 15-45 minutos por lote

## 1. Objetivo

Padronizar a emissao em lote de documentos oficiais por turma, com controlo de pendencias, reprocessamento e download ZIP.

## 2. Quando usar

- Fecho de periodo para emissao de pautas.
- Geracao de `Declaração com Notas` em escala.
- Geracao de `Certificado` em escala.

## 3. Responsaveis

- Executor: Admin da Escola
- Co-responsavel: Secretaria/Coordenacao pedagogica
- Escalonamento: Suporte tecnico

## 4. Pre-condicoes

- Acesso a `Admin > Documentos Oficiais`.
- Turmas com dados pedagogicos completos.
- Trimestre selecionado quando tipo for trimestral.

## 5. Procedimento A - Configurar tipo e filtros

1. Abrir `Documentos Oficiais`.
2. Selecionar tipo no topo:
- `Pauta Trimestral`
- `Pauta Anual`
- `Declaração com Notas`
- `Certificado`
3. Se tipo trimestral, selecionar `Trimestre`.
4. Opcional:
- ativar/desativar `Ocultar turmas com pendências de notas`
- clicar `Atualizar status`
- clicar `Selecionar turmas prontas`

## 6. Procedimento B - Validar turma antes de gerar

1. Na tabela, revisar por turma:
- alunos
- status pedagogico (`Pronta` ou `Faltam Notas`)
- pendencias
2. Quando houver pendencia:
- usar botao `Pendências`
- usar `Lançar notas` no modal
- voltar e atualizar pendencias
3. Para revisao previa, usar:
- `Rascunho`
- `Modelo`

## 7. Procedimento C - Gerar lote oficial

1. Selecionar as turmas prontas.
2. No CTA flutuante, clicar:
- `Gerar Lote Oficial (ZIP)` ou acao equivalente ao tipo
3. Aguardar estado `A processar...`.
4. Durante processamento, usar `Cancelar lote` somente quando necessario.
5. Ao concluir, baixar ZIP quando aparecer `download_url`.

## 8. Procedimento D - Pos-processamento e historico

1. No bloco `Histórico`, verificar:
- status (`SUCCESS`, `FAILED`, `PROCESSING`)
- total processado/sucesso/falhas
2. Se `FAILED`, usar `Reprocessar`.
3. Registrar lote final (tipo, timestamp, resultado, ficheiro ZIP).

## 9. Resultado esperado

- Lote oficial gerado com sucesso.
- Turmas processadas dentro do esperado.
- Evidencia ZIP armazenada para auditoria.

## 10. Erros comuns e correcao

| Erro observado | Causa provavel | Correcao imediata | Escalar quando |
|---|---|---|---|
| `Selecione o trimestre.` | Tipo trimestral sem periodo definido | Definir trimestre e repetir | Trimestre selecionado e erro persistir |
| `Falha ao gerar {tipo}` | Erro na fila de lote ou validacao | Verificar turmas e reexecutar | Falhas recorrentes |
| Turma bloqueada por `Faltam Notas` | Pendencias pedagogicas | Resolver em `Lançar notas` e atualizar | Pendencia nao reduz apos lancamento |
| Download ZIP indisponivel | Job nao concluido ou sem artefacto | Aguardar/reprocessar | Job `SUCCESS` sem download |

## 11. Evidencias obrigatorias

- Captura do filtro/tipo usado.
- Captura do status final do lote no historico.
- Arquivo ZIP final arquivado com operador e timestamp.

## 12. Referencia tecnica (fiel ao codigo)

- Turmas: `GET /api/secretaria/documentos-oficiais/turmas`
- Lotes:
- `GET /api/secretaria/documentos-oficiais/lote`
- `POST /api/secretaria/documentos-oficiais/lote`
- `POST /api/secretaria/documentos-oficiais/lote/reprocess`
- `POST /api/secretaria/documentos-oficiais/lote/cancel`
- Pendencias por turma:
- `GET /api/secretaria/documentos-oficiais/turmas/{turmaId}/pendencias`
- Apoio/preview por turma:
- `GET /api/secretaria/turmas/{turmaId}/pauta-geral?...`
- `GET /api/secretaria/turmas/{turmaId}/pauta-anual`
- `GET /api/secretaria/turmas/{turmaId}/pauta-geral/modelo?...`
- `GET /api/secretaria/turmas/{turmaId}/pauta-anual/modelo`

## 13. Revisao e versao

- Ultima revisao: 2026-04-03
- Proxima revisao: 2026-04-17
- Mudancas desta versao: versao inicial P3 de documentos oficiais em lote.

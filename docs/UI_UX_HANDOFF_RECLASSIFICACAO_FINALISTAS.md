# KLASSE — Handoff UI/UX: Centro de Resolução de Finalistas

**Destinatário:** Antygravity
**Estado:** especificação para construção da UI
**Data:** 2026-08-05
**Escopo:** frontend do fluxo de reclassificação de alunos finalistas após a virada do ano letivo

## 1. Contexto e problema

Na virada de ano letivo, alguns alunos não podem ser enviados automaticamente para uma turma final porque o destino depende de uma decisão da escola:

- 6.ª classe: conclusão do Ensino Primário;
- 9.ª classe: conclusão do I Ciclo do Ensino Secundário;
- Pré-Escolar: destino definido pela secretaria conforme a estrutura da escola.

Esses alunos não estão reprovados. Estão em estado operacional explícito:

`aguardando_destino`

O sistema deve impedir a emissão de recibo enquanto a decisão não estiver concluída, mas o bloqueio deve sempre conduzir a uma resolução rápida. Nunca apresentar apenas “erro” ou deixar a secretaria sem caminho de ação.

## 2. Objetivo da experiência

Permitir que a secretaria resolva um ou vários alunos em poucos passos, sem abrir cada perfil individualmente.

As duas decisões válidas são:

1. **Matricular no novo ciclo** — escolher a turma de destino.
2. **Concluir e arquivar** — quando o aluno termina o ciclo, sai da escola ou não continuará naquele percurso.

Todas as ações devem mostrar confirmação, resultado e possibilidade de atualização da lista sem recarregar a aplicação inteira.

## 3. Onde a UI aparece

### 3.1 Entrada principal: Centro de Resolução

Adicionar no módulo de Turmas/Operações Académicas uma entrada:

**Reclassificação de Finalistas**

Badge com o total de alunos pendentes, quando `count > 0`.

### 3.2 Entrada contextual: bloqueio de recibo

Quando a emissão de recibo responder com:

`MATRICULA_AGUARDANDO_RECLASSIFICACAO`

abrir imediatamente um modal ou drawer de resolução rápida sobre o fluxo atual.

O utilizador não deve ser enviado para uma página perdida nem obrigado a procurar o aluno manualmente.

Mensagem principal sugerida:

> Este aluno concluiu um ciclo e ainda aguarda definição de destino académico.

CTAs:

- **Resolver agora**
- **Fechar e resolver depois**

Fechar o modal não deve emitir o recibo nem contornar o bloqueio.

## 4. Centro de Resolução — layout

### Cabeçalho

- Título: **Reclassificação de Finalistas**
- Subtítulo: “Resolva alunos que terminaram um ciclo antes de emitir novos recibos ou concluir a matrícula.”
- Indicador: `N alunos aguardando destino`
- Botão secundário: Atualizar

### Filtros rápidos

- Todos
- 6.ª classe — badge “Fim do Primário”
- 9.ª classe — badge “Fim do I Ciclo”
- Pré-Escolar

Filtros devem usar o parâmetro `tipo`:

- `FIM_PRIMARIO`
- `FIM_I_CICLO`
- `PRE_ESCOLAR`

### Tabela

Colunas mínimas:

| Campo | Apresentação |
|---|---|
| Seleção | checkbox por linha e checkbox global da página |
| Aluno | nome completo e BI, quando disponível |
| Origem | turma e ano de origem |
| Tipo | badge com texto humano |
| Estado | badge amber “Aguardando destino” |
| Ação | “Resolver” |

Usar dados reais da API. Não inferir o estado comparando anos ou notas no frontend.

### Barra de ações em massa

Só aparece quando existe pelo menos um aluno selecionado.

- **Matricular no novo ciclo** — ação primária, dourada
- **Concluir e arquivar** — ação secundária, com confirmação

Mostrar sempre o total selecionado: “Resolver 12 alunos”.

## 5. Modal/drawer de resolução

Preferência: drawer lateral largo ou modal responsivo. No desktop, o drawer deve permitir consultar a lista atrás sem perder o contexto. No mobile, usar tela cheia.

### Cabeçalho do drawer

- Nome do aluno quando ação individual;
- “12 alunos selecionados” quando ação em massa;
- Tipo de ciclo;
- Origem académica;
- Badge amber “Aguardando destino”.

### Caminho A — Matricular no novo ciclo

Campos:

1. **Turma de destino** — obrigatório.
2. **Motivo/observação** — opcional, máximo 500 caracteres.

O campo de turma deve apresentar apenas turmas compatíveis com o ano letivo de destino e com vagas. Não permitir escolher uma turma do ano de origem.

Resumo antes de confirmar:

> 12 alunos serão matriculados em 10.ª A.

CTA:

**Confirmar matrícula no novo ciclo**

### Caminho B — Concluir e arquivar

Mostrar confirmação explícita:

> Estes alunos deixarão de ocupar uma vaga ativa e passarão ao estado “Concluído”. Esta ação deve ser usada quando não continuarão numa turma do novo ciclo.

Motivo opcional, mas recomendado para auditoria:

- Concluiu o percurso da escola
- Transferência para outra escola
- Não continuará no próximo ano
- Outro

CTA:

**Concluir e arquivar**

Não usar linguagem de reprovação, expulsão ou dívida.

## 6. Contrato de API existente

### Listagem

```http
GET /api/secretaria/operacoes-academicas/reclassificacao-finalistas?status=aguardando_destino&tipo=FIM_I_CICLO&limit=200
```

Resposta relevante:

```json
{
  "ok": true,
  "count": 1,
  "records": [
    {
      "id": "reclassificacao-id",
      "aluno_id": "aluno-id",
      "matricula_id": "matricula-id",
      "tipo": "FIM_I_CICLO",
      "status": "aguardando_destino",
      "origem_turma": { "id": "...", "nome": "9.ª A" },
      "destino_turma": null,
      "aluno": { "id": "...", "nome": "Nome do aluno", "bi_numero": "..." },
      "matricula": { "session_id": "...", "ativo": true }
    }
  ]
}
```

### Resolver em massa

#### Matricular no novo ciclo

```http
POST /api/secretaria/operacoes-academicas/reclassificacao-finalistas
Content-Type: application/json
```

```json
{
  "action": "enroll",
  "reclassificacao_ids": ["reclassificacao-id"],
  "turma_destino_id": "turma-id",
  "motivo": "Escolha de curso confirmada pela secretaria"
}
```

#### Concluir e arquivar

```json
{
  "action": "archive",
  "reclassificacao_ids": ["reclassificacao-id"],
  "motivo": "Concluiu o percurso da escola"
}
```

Limite de lote: 500 alunos. O backend valida permissões, escola, estado pendente, capacidade da turma e compatibilidade do ano letivo.

## 7. Contrato do bloqueio de recibo

O endpoint de emissão responde `409` quando existe uma reclassificação pendente:

```json
{
  "ok": false,
  "code": "MATRICULA_AGUARDANDO_RECLASSIFICACAO",
  "error": "Não é possível emitir recibo enquanto o aluno aguarda definição de destino académico.",
  "reclassificacao_tipo": "FIM_I_CICLO"
}
```

Implementação obrigatória no frontend:

1. reconhecer `code`;
2. preservar a operação financeira já registada, quando aplicável;
3. abrir o modal de resolução rápida;
4. carregar o registo pendente do aluno;
5. após resolução bem-sucedida, atualizar a lista e permitir nova tentativa de emissão;
6. não fazer retry automático infinito.

Enquanto o backend não disponibilizar `reclassificacao_id` diretamente nesse erro, localizar o registo pelo `aluno_id` usando a listagem pendente ou adicionar esse campo ao contrato da resposta.

## 8. Estados visuais

| Estado | Cor | Texto |
|---|---|---|
| `aguardando_destino` | amber | Aguardando destino |
| `matriculado_novo_ciclo` | green | Matriculado no novo ciclo |
| `concluido_arquivado` | slate/green | Concluído e arquivado |
| erro de capacidade | red | Turma sem vagas suficientes |
| conflito de ano | red | Turma pertence a outro ano letivo |

Após sucesso, remover o item da fila pendente e mostrar toast:

> 12 alunos resolvidos com sucesso.

Em falha parcial, mostrar quais IDs/alunos falharam e manter esses itens selecionados para nova tentativa.

## 9. Regras de segurança e confiança

- Não mostrar “reprovado” para `aguardando_destino`.
- Não permitir resolver por alteração direta de campos no cliente.
- Não ocultar o bloqueio de recibo com um botão “continuar mesmo assim”.
- Não permitir escolher turma fora do ano de destino.
- Não assumir aprovação, curso ou turma automaticamente para 6.ª/9.ª classe.
- Exibir confirmação antes de ações em lote.
- Atualizar a lista com dados do servidor após cada mutação.
- Em caso de erro, não apresentar sucesso otimista.

## 10. Critérios de aceite

- A secretaria encontra a fila em até dois cliques a partir de Operações Académicas.
- Um bloqueio de recibo abre o modal contextual, sem página de erro genérica.
- É possível filtrar 6.ª, 9.ª e Pré-Escolar.
- É possível selecionar vários alunos e resolver em lote.
- O modal exige turma para “Matricular no novo ciclo”.
- O modal exige confirmação para “Concluir e arquivar”.
- Depois da resolução, o aluno deixa de aparecer como pendente.
- Um recibo não é emitido enquanto o aluno estiver pendente.
- O fluxo deixa claro que o aluno aguarda uma decisão e não está reprovado.
- Erros de capacidade, permissão ou ano incompatível são apresentados em linguagem humana.
- A UI funciona em desktop e mobile.

## 11. Fora do escopo desta entrega

- Inferência automática de curso para a 10.ª classe.
- Alteração de notas, pautas ou histórico académico.
- Emissão automática de certificados.
- Cobrança ou alteração de dívida.
- Alteração da lógica da virada de ano letivo.

## 12. Princípio de navegação — Próximo ano letivo

O utilizador não deve precisar conhecer a sequência técnica entre virada, ano letivo, turmas, preços, candidaturas e rematrículas.

O portal de Operações Académicas deve apresentar um único bloco contextual:

**Próximo ano letivo**

Esse bloco consome:

```http
GET /api/secretaria/operacoes-academicas/proximo-ano
```

O modelo operacional possui uma única janela de inscrições: abrir inscrições formais abre conjuntamente candidaturas e rematrículas para o mesmo ano letivo. A secretaria não deve tomar essas duas decisões separadamente.

E apresenta uma ação principal determinada pelo estado real:

- preparar o próximo ano;
- concluir preparação académica;
- resolver finalistas;
- abrir inscrições e rematrículas;
- rever operação.

Regra de UX: mostrar uma ação principal por vez e manter os detalhes técnicos sob demanda. O card deve explicar o que falta em linguagem operacional, sem expor `session_id`, RPC, readiness ou nomes de tabelas.

## 13. Centro de Pendências Pós‑Virada

Depois de uma virada concluída, a escola não deve voltar ao wizard para resolver exceções. O portal expõe **Pendências pós‑virada**, disponível também para `admin_financeiro`, com origem e destino resolvidos automaticamente pelo ano letivo ativo:

- **Dívida**: aluno que ficou no ano anterior por saldo positivo; mostrar o valor e manter a ação “Aguarda pagamento”. Após a regularização, “Promover agora” executa a promoção auditada.
- **Finalista**: aluno aguardando destino de ciclo; abrir o Centro de Reclassificação de Finalistas para concluir/arquivar ou escolher turma do novo ciclo.
- **Revisão**: aluno sem dívida identificada que não foi localizado no destino; encaminhar para revisão manual, sem marcar como reprovado.

Contrato operacional:

```http
GET  /api/secretaria/operacoes-academicas/pos-virada
POST /api/secretaria/operacoes-academicas/pos-virada
```

O endpoint nunca aceita o ano letivo vindo da UI para decidir a operação: ele resolve o ano ativo e o anterior no servidor. A tela deve sempre mostrar “origem → destino”, permitir atualizar os dados e remover o aluno da lista somente após confirmação do servidor.

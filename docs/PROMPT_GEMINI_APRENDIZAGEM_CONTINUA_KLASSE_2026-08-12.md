# Prompt para Gemini — Aprendizagem contínua no KLASSE

## Contexto

O KLASSE tem agora o backend inicial para aprendizagem contínua. A tua tarefa é implementar a experiência de professor e aluno sobre esse contrato.

Não redesenhes a arquitectura nem inventes tabelas paralelas. Primeiro lê:

- `docs/SPRINT_LACUNAS_PRODUTO_KLASSE_2026-08-12.md`
- `supabase/migrations/20270812160000_learning_activities_backend.sql`
- `apps/web/src/app/api/professor/atividades/route.ts`
- `apps/web/src/app/api/professor/atividades/[id]/route.ts`
- `apps/web/src/app/api/professor/materiais-pedagogicos/route.ts`
- `apps/web/src/app/api/professor/materiais-pedagogicos/[id]/route.ts`
- `apps/web/src/app/api/aluno/atividades/route.ts`
- `apps/web/src/app/api/aluno/atividades/[id]/submeter/route.ts`

## Objectivo

Entregar um fluxo completo e gracioso:

1. Professor cria um material ou actividade.
2. Guarda como rascunho.
3. Retoma o rascunho sem perder dados.
4. Publica para a turma/disciplina correcta.
5. Aluno vê apenas actividades publicadas da sua matrícula activa.
6. Aluno guarda respostas sem finalizar.
7. Aluno retoma e submete.
8. Professor acompanha entregas e estados.

Tipos suportados: `quiz`, `exercicio`, `tarefa`, `simulado`.

## Contratos obrigatórios

Usa as APIs existentes:

- `GET/POST /api/professor/materiais-pedagogicos`
- `PATCH /api/professor/materiais-pedagogicos/:id`
- `GET/POST /api/professor/atividades`
- `GET/PATCH /api/professor/atividades/:id`
- `GET /api/aluno/atividades`
- `POST /api/aluno/atividades/:id/submeter`

Não exponhas `resposta_correta` no portal do aluno.

O campo `finalizar: false` guarda a tentativa em andamento. O campo `finalizar: true` submete a tentativa.

Quando a API responder `next_action`, a interface deve mostrar uma acção primária clicável. Nunca mostrar apenas “Erro”.

## Regras de experiência graciosa

- Manter o contexto actual; preferir modal/drawer para criar, editar e publicar.
- Mostrar rascunhos visíveis com “Retomar rascunho”.
- Confirmar publicação com turma, disciplina, prazo e número de questões.
- Impedir publicação sem questões e encaminhar para edição.
- Permitir guardar progresso sem submeter.
- Mostrar prazo, tentativas usadas e estado da entrega.
- Se o prazo terminar, explicar o motivo e oferecer “Contactar professor”.
- Em falha de rede, preservar o formulário localmente e oferecer “Tentar novamente”.
- Não converter automaticamente a actividade em nota oficial.
- Usar o ano letivo e a turma devolvidos pelo backend; não inferir no frontend.

## IA pedagógica

Não implementes ainda um NotebookLM completo. Nesta etapa, prepara apenas pontos de extensão seguros:

- botão “Gerar rascunho de questões” no editor;
- confirmação humana antes de inserir questões geradas;
- indicação dos materiais usados como fonte;
- nunca publicar automaticamente conteúdo gerado por IA;
- nunca alterar nota oficial, frequência ou estado académico por IA.

Se a integração de IA não estiver disponível, deixa a acção explicitamente como “Em preparação”, sem simular sucesso.

## Segurança

- Respeitar escola, turma, disciplina e utilizador devolvidos pelo backend.
- Não usar service role em rotas humanas.
- Não introduzir queries sem escopo de `escola_id`.
- Não expor respostas correctas, entregas de outros alunos ou rascunhos.
- Não colocar credenciais, URLs privadas ou segredos no código.

## Validação antes de concluir

Executa:

```bash
pnpm -C apps/web typecheck
git diff --check
```

Testa manualmente ou com testes de rota:

- criar rascunho;
- recarregar e retomar rascunho;
- publicar sem questões;
- publicar actividade válida;
- aluno guardar sem finalizar;
- aluno retomar;
- aluno submeter;
- professor acompanhar entrega;
- aluno de outra turma não ver a actividade;
- utilizador sem papel adequado receber caminho de resolução.

## Restrições de escopo

- Não tocar em `portfolio`, TCC, artigos, artefactos ou outputs de agentes.
- Não aplicar migrações ao banco sem instrução explícita.
- Não alterar notas oficiais nem o fluxo de pautas.
- Não declarar a funcionalidade concluída sem evidência do fluxo ponta a ponta.

## Entrega esperada

No final, apresenta:

1. ficheiros alterados;
2. fluxos implementados;
3. limitações reais;
4. comandos de validação executados;
5. qualquer pendência que precise de validação posterior.

Este trabalho será validado posteriormente contra o contrato, o banco e os fluxos reais. Não assumes que uma página criada equivale a uma funcionalidade concluída.

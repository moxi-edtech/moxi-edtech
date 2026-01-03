# Funil de Admissão com Turma Preferencial

- **Cadastro**: `/secretaria/alunos/novo` cria `alunos` e registra a intenção em `candidaturas` com `curso_id`, `ano_letivo` e, agora, `turma_preferencial_id` (opcional).
- **Cascata de seleção** (Passo 4): Curso → Classe → Turno; o sistema busca turmas ativas do ano letivo selecionado e mostra código, turno e vagas restantes. A secretária pode marcar uma turma preferida ou deixar para decidir depois.
- **Conversão**: `/secretaria/matriculas/nova` carrega a candidatura e, se existir `turma_preferencial_id`, sugere automaticamente essa turma (se ainda disponível) na etapa de alocação. O status final da candidatura segue para `matriculado` ao confirmar.
- **DDL**: nova coluna em `candidaturas` — `turma_preferencial_id uuid REFERENCES public.turmas(id)` (migration `20260907000000_add_turma_preferencial_to_candidaturas.sql`).

**Benefícios**
- Agilidade: código/turno visíveis para escolha rápida.
- Segurança operacional: vagas restantes à vista evitam escolhas lotadas.
- Continuidade: na confirmação financeira a intenção de turma já está registrada.

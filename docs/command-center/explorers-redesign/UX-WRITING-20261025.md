# UX Writing dos exploradores — 25/10/2026

Objetivo: menos linguagem técnica e mais informação útil à secretaria.

Superfícies alteradas: Command Palette, Curso, Classe, Turma, Professor, Disciplina, horário publicado e aviso de ano histórico.

## Regras preservadas

- Lista parcial: não afirmar ausência definitiva. Usar «Podem existir outros».
- Vínculo docente registado sem perfil acessível: «Professor por identificar», nunca «Professor não atribuído».
- Capacidade não definida: vagas e capacidade agregada ficam indisponíveis, não valem zero.
- Matriz curricular atualmente inativa: não presumir estado no ano histórico.
- Horário publicado: exibir apenas versão publicada, sem inferir presença ou atribuição formal.
- Ano histórico: consulta somente, com navegação por páginas e sem pesquisa operacional e exportação.
- Manter os avisos acessíveis com role=status/alert.
- Não alterar cálculos, APIs, permissões, estados, rotas, supabase ou fluxos do Balcão.

## Validação

Testes do repositório, typecheck, lint, build, preview e verificação do deploy na Vercel.

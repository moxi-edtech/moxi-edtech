# CC-009 / CC-011 / CC-012 / CC-017 / CC-018 — homologação funcional (fase B)

**Estado:** branch de revisão empilhada sobre #245; testes com dados fictícios, sem migrações aplicadas a produção. CC-001 está exclusivamente com o proprietário.

## Contractos testados

- CC-009: `ambos` é uma conjunção, não uma união: documento assinalado **e** propina efectivamente vencida na matrícula/ano correctos. RPC `command_center_roster_operational_v1` redefinida por migration aditiva sem mudar assinatura; total filtrado antes do cursor, desempate estável por nome/UUID. Fixture de 55 alunos, pesquisa textual em conjunto, recusa da escola B, tentativa de entrada SQL e reaplicação.
- CC-011: as seis ações são exactamente as do `action-registry` do Balcão, sem novas variantes dos fluxos financeiros ou de notas. `Matrícula` não recebe aluno seleccionado; as outras ações recebem apenas o aluno da escola/ano, e o backend de destino precisa voltar a validar autorização. Permissão consultada ao abrir o diálogo, sem expor uma ação desautorizada. Escopo de polo **nega** até existir relação canónica.
- CC-012: os snapshots de página, rolagem, pesquisa, ordenação e filtro são efémeros; o contexto só regressa se utilizador/escola/polo/ano/portal continuarem iguais. Teste 700 transições, máximo 40 views / 24 breadcrumbs e confirmação de que a navegação de rota simples restaura. A ausência de aluno na página não é prova de transferência: a interface orienta confirmar turma/matrícula.
- CC-017: erros 400/401/403/409/429/500 recebem códigos e IDs correlacionáveis, sem ecoar SQL, nome de menor, busca ou saldo, inclusive nos endpoints auxiliares. O servidor divulga apenas duração agregada em `Server-Timing`, sem pedido extra.
- CC-018: Playwright com cinco tamanhos de viewport × três escalas 100%, 125%, 150%, axe WCAG 2.x A/AA na lista e no diálogo de ações em cada tamanho/escala. Testa acesso ao filtro/ordenação por teclado e ausência de scroll horizontal da página. Capturas anexadas como artefacto.

## Limites que não devem ser confundidos com homologação

- **O pacote visual isolado monta o componente real de Turma com API simulada**; ainda não cobre interacção real autenticada para todos os cinco exploradores (Curso, Classe, Professor, Disciplina e Turma). Isso é um gate do bloco D.
- **Só NVDA/VoiceOver manual pode validar** o anúncio real de regiões, instruções, leitura de estado, ordem natural de leitura e navegação assistida nos cinco exploradores. Passo do proprietário: Windows/NVDA e macOS/VoiceOver, testar 360, 390, 768, 1366, 1920, com rota/Balcão/volta e zoom 100/125/150; registar bugs, capturas sem menores e passos de reprodução.
- **Polo:** consulta read-only do catálogo actual do Supabase não revelou nenhuma tabela ou coluna de ligação canónica a polo. Até existir um modelo aprovado com RLS, qualquer pedido explícito de polo falha fechado; não declarar isolamento real entre polos. Bloqueio de domínio e dados, não uma licença para alterar RLS.
- **Autenticação GoTrue/RLS real:** exige base descartável com migrations realmente aplicadas e políticas instaladas; o replay histórico CC-001 pertence ao proprietário. A fixture de CI usa PostgreSQL com funções/policies sintéticas compatíveis; não é prova integral de GoTrue.
- **Balcão/IA:** não duplicar `action-registry.ts`, componentes do Balcão nem fluxo financeiro. Integração estática/replay combinados apenas no bloco D.

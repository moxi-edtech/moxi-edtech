# Avaliação de pré-requisitos para documentos acadêmicos e financeiros

Resumo do que já existe no código e ajustes necessários para implementar os 11 artefatos solicitados.

## 1. Declaração de Matrícula
- **O que já temos:** endpoint gera PDF simples com dados do aluno, turma e escola para uma matrícula, sem cabeçalho institucional estruturado, QR ou assinaturas. 【F:apps/web/src/app/api/secretaria/matriculas/[id]/declaracao/route.ts†L5-L71】
- **Ajustes necessários:** adicionar layout institucional (logotipo/cabeçalho), campos de identificação completos do aluno e turma (curso/turno/ano letivo), QR code para autenticação, assinatura digital configurável e metadados de verificação.

## 2. Certificado de Frequência
- **O que já temos:** endpoint gera PDF listando registros de frequência por matrícula com tabela simples. 【F:apps/web/src/app/api/secretaria/matriculas/[id]/frequencia/route.ts†L5-L94】
- **Ajustes necessários:** aplicar layout minimalista com tipografia adequada, resumir estatísticas de presença/ausência por período, incluir assinatura do diretor e QR code de autenticação.

## 3. Lista de Alunos por Turma
- **O que já temos:** API retorna apenas IDs e nomes de alunos ativos por turma. 【F:apps/web/src/app/api/secretaria/turmas/[id]/alunos/route.ts†L4-L42】
- **Ajustes necessários:** expandir seleção para dados pessoais, documentos, contactos, encarregado de educação, status da matrícula e integração com QR/assinaturas para registro de presenças.

## 4. Lista de Turmas por Classe
- **O que já temos:** API lista turmas por escola, calcula ocupação atual e estatísticas por turno, mas usa capacidade padrão fixa (30) e não classifica status de ocupação. 【F:apps/web/src/app/api/secretaria/turmas/route.ts†L7-L158】
- **Ajustes necessários:** incluir agrupamento por classe/série, capacidade configurável por turma, percentual de ocupação calculado no backend e categorização (lotada/adequada/vagas), além de dados de sala/turno na saída.

## 5. Dossiê do Aluno
- **O que já temos:** não há endpoint ou página que consolide dados pessoais, familiares, histórico acadêmico e financeiro em um único dossiê.
- **Ajustes necessários:** criar agregador que una alunos, matrículas, notas, frequência e financeiro, com observações internas e alertas de documentação pendente.

## 6. Relatório de Propinas
- **O que já temos:** dashboard financeiro com total de matriculados, inadimplência, valores confirmados/pendentes e visão de valores em aberto por mês. 【F:apps/web/src/app/api/financeiro/dashboard/route.ts†L4-L73】【F:apps/web/src/app/api/financeiro/aberto-por-mes/route.ts†L4-L23】
- **Ajustes necessários:** gerar relatório mensal detalhado por aluno/ano letivo, com valores pagos e em atraso, taxa percentual e gráficos; aplicar codificação por cores para status.

## 7. Extrato de Pagamentos por Aluno
- **O que já temos:** não há endpoint dedicado para extrato financeiro individual com cronograma de vencimentos/quitados.
- **Ajustes necessários:** criar API que consolide mensalidades e pagamentos por aluno/turma/ano, formate em uma página, destaque pendências e inclua QR para acesso rápido.

## 8. Relatório de Ocupação das Turmas
- **O que já temos:** API de turmas calcula ocupação atual (contagem de matrículas ativas) e traz capacidade padrão. 【F:apps/web/src/app/api/secretaria/turmas/route.ts†L62-L138】
- **Ajustes necessários:** armazenar capacidade máxima por turma, calcular percentuais e classificar situação (lotada/adequada/com vagas); expor visão consolidada por classe/turno.

## 9. Declaração de Notas
- **O que já temos:** não existe rota que gere certificado de notas ou média final por matrícula/ano.
- **Ajustes necessários:** coletar notas lançadas por disciplinas e compor PDF com identificação completa, participação e média final (quando aplicável), além de QR/assinatura.

## 10. Relatório de Documentos Pendentes
- **O que já temos:** não há listagem tabular de documentos faltantes por aluno com indicadores visuais.
- **Ajustes necessários:** criar modelo de documentos exigidos, status por aluno e relatório com filtros/categorização e indicadores (cores/ícones).

## 11. Documentos Avançados (Fase 1.7)
- **O que já temos:** não há dashboard PDF diário com indicadores de alunos ativos/inadimplência, movimentação de matrículas ou certidão financeira para transferência.
- **Ajustes necessários:** produzir gerador de PDF com KPIs diários, alertas de risco, gráfico de movimentação e certidão financeira com assinatura digital e QR code.

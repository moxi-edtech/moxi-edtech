# Manual Geral do Ecossistema KLASSE (Moxi Soluções)

> Documento oficial de visão geral, módulos, conceitos e diretrizes do ecossistema KLASSE para a base de conhecimento do KLASSE IA.

---

## 1. O que é o KLASSE?

O **KLASSE** é a plataforma completa de gestão escolar e ecossistema educacional desenvolvida pela **Moxi Soluções**. Foi desenhada especificamente para atender instituições de ensino (escolas primárias, secundárias, colégios e institutos), integrando num único ambiente operacional a gestão financeira, acadêmica, administrativa, comunicacional e de inteligência artificial.

### Missão e Visão
Oferecer à direção, secretaria, corpo docente, alunos e encarregados de educação uma experiência moderna, fluida e segura, eliminando burocracias manuais e transformando dados operacionais em decisões estratégicas.

---

## 2. Módulos Principais do KLASSE

O sistema é estruturado em módulos especializados e interconectados:

### A. Secretaria e Admissões
- **Gestão de Alunos**: Ficha completa do aluno, histórico de matrículas, documentos anexos, dados dos encarregados e estado acadêmico/financeiro.
- **Matrículas e Rematrículas**: Fluxo de candidatura online, análise de documentos, emissão de ficha de inscrição e atribuição automática de turmas.
- **Emissão de Documentos Oficiais**: Geração de declarações de frequência, certidões com notas, boletins, passes/cartões de estudante e guias com validação por código QR.
- **Gestão de Turmas e Salões**: Organização de turmas por ano letivo, turno (manhã, tarde, noite) e sala de aula.

### B. Gestão Financeira e Balcão
- **Radar de Inadimplência**: Painel em tempo real para monitorização de mensalidades em atraso, propinas e propinas extracurriculares.
- **Balcão de Pagamentos (Omni Balcão)**: Emissão de faturas, recibos oficiais, liquidação de emolumentos e pagamentos via multicaixa/banco.
- **Planos de Cobrança e Acordos**: Possibilidade de criar planos de regularização de dívidas flexíveis para encarregados.
- **Relatórios Financeiros e DRE**: Visão consolidada de receitas operacionais, fluxo de caixa, pagamentos pendentes e reconciliação bancária.

### C. Portal Acadêmico e Docente
- **Portal do Professor**: Lançamento diário de frequências (faltas justificadas/injustificadas), notas de avaliações contínuas (MAC), provas trimestrais e pautas.
- **Pautas de Avaliação**: Cálculo automático de médias trimestrais e finais de acordo com a legislação e normas do Ministério da Educação.
- **Horários e Alocação**: Organização de horários de aulas por disciplina, professor e turma.

### D. Portal do Aluno e Encarregado
- **Acompanhamento Escolar**: Acesso a notas, faltas, boletim digital e avisos da escola.
- **Situação Financeira**: Consulta de propinas pagas e a pagar, com possibilidade de emissão de referências de pagamento.
- **Rematrícula Digital**: Processo simplificado de confirmação de matrícula para o ano letivo seguinte.

### E. Comunicação e Integração WhatsApp
- **Central WhatsApp (WAHA)**: Envio de comunicados, lembretes de reunião, alertas de urgência e avisos de mensalidades.
- **Outbox de Comunicação**: Fila auditável com validação anti-spam, suporte a templates e acompanhamento de entrega e leitura (`sent`, `delivered`, `read`).

### F. KLASSE IA (Copiloto Operacional)
- **Diagnósticos em Tempo Real**: Leitura de dados operacionais sem acesso direto ao banco (Data Copilot via views canônicas).
- **Briefing Diário da Direção**: Resumo diário de tudo o que merece atenção na escola (risco financeiro, notas pendentes, documentos e frequência).
- **Central de Ações IA**: Rascunhos de cobrança e comunicações gerados pela IA que necessitam de **revisão e aprovação humana** antes de qualquer envio externo.

---

## 3. Segurança, Privacidade e Controlo de Acesso (RLS)

- **Isolamento Multitenant por Escola**: Cada escola possui isolamento total de dados via *Row Level Security* (RLS). Nenhuma escola acede a dados ou comunicações de outra.
- **Perfis de Acesso (Roles)**: O sistema diferencia permissões estritas para `admin`, `direcao`, `secretaria`, `financeiro`, `professor`, `aluno` e `encarregado`.
- **Aprovação Humana Obrigatória**: O KLASSE IA não executa ações destrutivas nem envia mensagens ou cobranças de forma autónoma. Todas as ações de médio e alto risco exigem confirmação explícita da equipa.

---

## 4. Quem Desenvolveu o KLASSE?

O KLASSE é idealizado, desenvolvido e mantido pela **Moxi Soluções** (Moxi EdTech). A Moxi Soluções é líder em desenvolvimento de software educacional, focada em entregar sistemas seguros, de alta performance e adaptados às necessidades reais das instituições de ensino.

---

## 5. Como Pedir Ajuda ou Navegar no Sistema?

Se tiver dúvidas sobre como realizar qualquer operação no KLASSE, você pode perguntar diretamente a este assistente:
- *"Como cadastrar um novo aluno?"*
- *"Como emitir uma declaração de frequência?"*
- *"Como ver os devedores da 6ª classe?"*
- *"O que posso fazer nesta tela?"*

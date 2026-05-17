# Design de Produto: Mapa de Frequência Mensal (Sincronizado)

Este documento descreve a evolução da listagem de alunos em PDF para um **Mapa de Frequência Mensal**, integrando os dados lançados pelos professores no portal com a geração de documentos oficiais da secretaria.

## 1. Visão Geral
Atualmente, o sistema gera uma lista de alunos com colunas em branco para chamada física. A evolução permitirá que este mesmo PDF seja gerado com os dados de presença (P), falta (F) e atrasos (A) já preenchidos, servindo como um relatório de auditoria e fechamento mensal.

## 2. Requisitos Funcionais

### 2.1. API de Geração de PDF
A rota `/api/secretaria/turmas/[id]/alunos/lista` e `/pdf` será expandida para suportar:
- **`month` (1-12):** Mês de referência para o mapa.
- **`year` (YYYY):** Ano de referência.
- **`disciplina_id` (UUID, opcional):** Para filtrar frequências de uma disciplina específica.

### 2.2. Layout de Mapa Mensal
- **Orientação:** Paisagem (Landscape).
- **Grade:** 31 colunas (uma para cada dia do mês).
- **Legenda:** Rodapé com `P` (Presente), `F` (Falta), `A` (Atraso), `FJ` (Falta Justificada).
- **Estilo:** Zebra striping para legibilidade e destaque visual para finais de semana.

### 2.3. Sincronização de Dados
- A API consultará a tabela `frequencias` filtrando por `matricula_id`, `data` (dentro do mês/ano) e `escola_id`.
- Se `disciplina_id` for fornecido, filtrará apenas as frequências daquela disciplina via `curso_matriz_id`.

## 3. Experiência do Usuário (UX)

### 3.1. Portal do Professor
No menu de **Frequências**, será adicionado um botão de ação:
- **Botão:** "Imprimir Mapa Mensal".
- **Comportamento:** Abre um pequeno modal ou dropdown para selecionar o mês. Ao confirmar, abre o PDF preenchido.

### 3.2. Secretaria (Portal Admin)
Na visualização de **Turmas**, o botão de "Lista de Alunos" ganhará uma opção "Mapa de Frequência" com seletor de mês.

## 4. Estratégia de Implementação (Fases)

### Fase 1: Estrutura (Current)
- [x] Refatoração do motor de PDF para suporte a tabelas robustas.
- [x] Suporte a orientação Paisagem.
- [x] Definição do contrato da API (parâmetros `month`, `year`).

### Fase 2: Integração de Dados
- [ ] Implementação da query de `frequencias` na API do PDF.
- [ ] Mapeamento lógico de `status` -> `P/F/A`.
- [ ] Lógica de detecção de finais de semana no PDF.

### Fase 3: UI/UX
- [ ] Adição dos botões no Portal do Professor.
- [ ] Adição do seletor de mês na Secretaria.

## 5. Exemplo de Comportamento do Mapa
| Nº | Aluno | 01 | 02 | 03 | 04 | ... | 31 |
|----|-------|----|----|----|----|-----|----|
| 01 | João Silva | P | P | F | P | ... | P |
| 02 | Maria Souza | P | A | P | P | ... | F |

---
*Este design prioriza a fidelidade entre o sistema digital e o arquivo físico da escola.*

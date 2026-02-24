# KLASSE – Análise Competitiva (AngoSchool) + Direção Académica Oficial

Versão: 2026-02-05  
Status: Aprovado para Execução

---

## 🔥 1. Executive Summary

Após análise minuciosa do AngoSchool (vídeos, screenshots e UI), identificámos:
- Eles dominam a burocracia (relatórios ministeriais)
- Nós dominamos tecnologia, UX, finanças e arquitetura

O caminho ideal é simples:

Copiar tudo o que eles fazem bem (pautas, horários, relatórios)  
E esmagar em UX, automação, geração inteligente e integração completa.

Este documento define:
- Gaps atuais (académico KLASSE)
- O que copiar 1:1
- O que melhorar 10×
- O que descartar
- Roadmap interno
- Pilares estratégicos da vantagem competitiva

---

## 🧩 2. Diagnóstico Rápido — KLASSE vs AngoSchool

### ✔ Forças do KLASSE
- Arquitetura moderna (Next.js + Supabase + RLS)
- Multi-tenant real
- Currículos com presets (único no mercado)
- UX enterprise extremamente superior
- Balcão 30s + Conciliação + MCX (ninguém tem)
- Segurança sólida (políticas, isolamento, auditoria)
- Velocidade/Performance
- Modernidade e estética impecável

### ✔ Forças do AngoSchool
- Relatórios ministeriais prontos
- Pautas oficiais (MAC, NPT, MT1/MT2 etc.)
- Horário escolar (ainda que manual)
- Muito alinhado ao modelo tradicional das escolas públicas e privadas
- Professores reconhecem o formato → curva de adoção baixa

### ❌ Fraquezas do AngoSchool
- UI extremamente antiga (Bootstrap 2010 vibes)
- Falta de automação
- Turmas não são atômicas
- Professor faz tudo manual
- Sem IA, sem presets, sem workflow
- Arquitetura frágil (provável PHP/MySQL sem multi-tenancy)
- Zero diferenciação financeira
- Falta de inovação

### 🎯 Oportunidade (KLASSE)

KLASSE consegue:

→ “Roubar” a familiaridade deles  
→ Entregar a modernidade que falta  
→ Integrar financeiro + académico num ecossistema único  
→ Reduzir erros com automação e presets  
→ Atingir mercado premium e médio com uma UI que vende sozinha

---

## 📌 3. O que deve ser COPIADO 1:1 (CORE do Ministério)

Estas features são obrigatórias para aceitação cultural em Angola:

### 3.1. Pautas Oficiais

Formatos exatos a copiar:
- Mapa de Aproveitamento por Disciplina (imagem analisada)
- Mini-Pauta
- Pauta Trimestral
- Mapa Geral da Turma
- Relatório de Aproveitamento
- Relatório de Frequência

Todos com cabeçalho real: República de Angola, Governo Provincial, etc.

➡ KLASSE deve gerar PDF idêntico, mas com layout moderno.

---

### 3.2. Interfaces de Lançamento de Notas

UX a copiar:
- Tabela por aluno (Nº F, Comportamento, Assiduidade)
- Inputs rápidos 1ª, 2ª, 3ª, 4ª Avaliação
- Cálculo automático do MAC/NPT/MTI
- Autosave
- Indicadores visuais claros

➡ KLASSE deve manter exatamente o mesmo modelo mental.

---

### 3.3. Gestão de Turmas e Disciplinas (Visão Tradicional)

Mesmo que internamente nossas turmas sejam atômicas, a interface deve permitir:
- Nº de pauta
- Diretor / Sala / Período
- Linguagem / Disciplina de Opção
- Tempos / Intervalos
- Aulas até “3ª-feira”
- Nº de Tempos por dia

➡ Isso fideliza escolas que já estão acostumadas ao AngoSchool.

---

## ⚙ 4. O que deve ser MELHORADO (10×) no KLASSE

### 4.1. Horário Automático (AngoSchool v0 → KLASSE v2)

Eles têm:
- edição manual da grelha
- geração manual por turma
- visual simples

KLASSE terá:

V2 — Gerador Automático Inteligente
- input: currículo + professores + salas
- motor de conflito
- IA para gerar horários válidos
- sugestão otimizada para carga horária
- validação instantânea
- exportação PDF oficial
- visual KLASSE moderno

---

### 4.2. Currículo + Presets (nosso trunfo invisível)

Eles não têm nada parecido.

KLASSE:
- curso atômico
- preset curricular
- hidratação automática
- fluxo seguro via triggers
- disciplinas não editáveis após publicação

➡ Isso destrói a arquitetura deles por completo.

---

### 4.3. Pautas → Automação + Auditoria

AngoSchool:
- cálculo manual
- visual engessado
- professores fazem tudo

KLASSE:
- autosave
- auto-cálculo
- logs
- aprovação do diretor
- bloqueio por período
- integração com faltas (futuro)

---

### 4.4. UI/UX

Eles:
- Arcaico
- Sem identidade
- Textos desformatados
- Inputs aleatórios
- Acessibilidade zero

KLASSE:
- UI enterprise
- Tokens consistentes
- Colunas monoespaçadas
- Interação rápida
- Performance SSOT
- Mobile-first

---

## 🛠 5. Roadmap Técnico Oficial (Académico KLASSE)

### Fase 1 — Harmonização Ministerial (2 sprints)
- Criar pacote oficial de exportação (PDFs)
- Reproduzir todos modelos de pauta
- Criar scheduler SSOT (avaluations)
- Interface de notas “professor turbo”
- Mini-pautas e pautas trimestrais

### Fase 2 — Horários Inteligentes (3 sprints)
- Editor manual
- Visor de horários
- Geração automática
- Motor de conflitos
- Exportação oficial
- Alocação dinâmica prof × sala × turma

### Fase 3 — Automatização Total do Processo Académico
- Workflow para diretor
- Restrições por período
- Auditoria de notas
- Unidade de decisão da escola (visto pedagógico)

---

## 🔐 6. Decisão Arquitetural (Canonical)
- Turmas continuam atômicas (posição oficial KLASSE)
- UI imita o modelo cultural (AngoSchool)
- Backoffice é atomic, seguro, escalável
- Currículo continua hydratando turmas via factory
- PDF oficial é espelhado exatamente como o MINED exige
- KLASSE permanece com visão moderna → inovação contínua

---

## 🏆 7. Vantagem Competitiva do KLASSE

KLASSE ganha porque é:
- mais bonito
- mais moderno
- mais rápido
- mais seguro
- mais automatizado
- mais integrado (financeiro + académico)
- mais simples de usar
- mais escalável

AngoSchool ganha onde?

Somente em:
→ acostumamento cultural  
→ templates ministeriais

Ou seja:
não é uma ameaça — é um guia.

---

## 🧠 8. Conclusão Estratégica

Copiamos o que eles têm de cultural +
superamos com tecnologia, segurança e automação.

Se fizermos isso, o KLASSE domina:
- escolas privadas (rápido)
- institutos médios (médio prazo)
- escolas públicas (longo prazo)

---

## Referências relacionadas
- `agents/CONTRACTS.md`
- `agents/specs/performance.md`
- `agents/outputs/ROADMAP_REAL_DATA_IMPLEMENTATION.md`

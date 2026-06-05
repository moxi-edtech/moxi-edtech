# Plano de Evolução — Landing Page K12 (V2)

**Status:** PROPOSTA
**Data:** 2026-06-04
**Foco:** Transformar a página pública de admissões (`/admissoes/[escolaSlug]`) de um simples formulário transacional num **Hub Educacional (Digital Front Door)** focado em Atração, Posicionamento White-label e Conversão.

---

## 1. Objetivos da V2

1.  **Redução de Abandono (Drop-off):** Otimizar o formulário de admissão para que encarregados não desistam no meio do processo por excesso de campos ou falta de documentos na hora.
2.  **Portal Unificado:** Servir como o "site oficial" da escola no ecossistema Klasse, oferecendo acesso rápido aos portais internos (Aluno/Professor).
3.  **Posicionamento Premium:** Garantir que a identidade visual da escola (`logo`, `cor_primaria`) domine a página, gerando confiança.
4.  **Engajamento de Vendas:** Utilizar gatilhos visuais (escassez de vagas) e suporte rápido (WhatsApp) para acelerar inscrições.

---

## 2. Escopo de Implementação

### Fase 1: Arquitetura da Página (O "Hub")
Atualmente, a página carrega diretamente no `AdmissionForm`. Na V2, a página terá uma estrutura de Landing Page clássica:

*   **Header (Navbar):**
    *   Logo da escola à esquerda.
    *   Botões de Login: "Portal do Aluno" e "Portal do Professor" à direita (com redirecionamento automático baseado na sigla/slug da escola).
*   **Hero Section:**
    *   Fundo estilizado (padrões geométricos ou blobs usando a `cor_primaria` com 10% de opacidade).
    *   Título dinâmico forte (Ex: "Inscrições Abertas - Ano Letivo [ANO]").
    *   CTA Principal: "Fazer Inscrição Agora" (ancorando para a seção do formulário).
*   **Catálogo de Cursos (Novo Componente):**
    *   Renderizar os cursos disponíveis em *cards* visuais antes do formulário.
    *   Cada card exibirá o nome do curso, turnos e os Badges de Vagas gerados pelo `disponibilidadePublica` (ex: 🔴 Lista de Espera, 🟡 Últimas Vagas, 🟢 Vagas Disponíveis).

### Fase 2: Refatoração do Formulário (Progressive Profiling)
Quebrar o componente monolítico `AdmissionForm.tsx` em *steps* cognitivos mais leves e focados:

*   **Step 1: O Que Você Procura? (Intenção)**
    *   Escolha do Curso e Turma Preferencial.
    *   (Mostrando as tags de vagas restantes).
*   **Step 2: Dados do Candidato**
    *   Nome, BI, Data de Nascimento, Gênero.
*   **Step 3: Dados do Encarregado (Responsável)**
    *   Nome do Pai/Mãe, Nome do Encarregado, Telefones, Email.
    *   *Implementação de rascunho (Draft):* Salvar os dados no `localStorage` neste momento para não perder caso o usuário saia.
*   **Step 4: Documentação (Upload)**
    *   O componente atual de `DocumentUpload` já funciona bem, será apenas reposicionado.
*   **Animação:** Adicionar `framer-motion` para transições suaves de deslizamento entre as etapas.

### Fase 3: Transparência e Suporte Operacional
*   **Mural Público (Opcional/Futuro):** Exibir os últimos 3 avisos marcados como "Público" na tabela de notificações para dar "vida" à página.
*   **WhatsApp Flutuante (FAB):** Se a escola configurou `whatsapp_suporte` no `config_portal`, exibir um botão flutuante persistente no canto inferior direito para dúvidas imediatas.
*   **Modo Rascunho / Retomada:** Um pequeno botão "Já comecei uma inscrição" que restaura o `draftId` e os dados do `localStorage`.

---

## 3. Arquitetura Técnica e Arquivos Afetados

| Arquivo/Componente | Ação Proposta |
| :--- | :--- |
| `apps/web/src/app/(publico)/admissoes/[escolaSlug]/page.tsx` | Refatorar para renderizar o Header, Hero e injetar os dados no novo layout antes de carregar o form. Adicionar botões de login para portais. |
| `apps/web/src/app/(publico)/admissoes/[escolaSlug]/AdmissionForm.tsx` | Dividir o formulário em sub-componentes (Step1Curso, Step2Candidato, Step3Encarregado). |
| `apps/web/src/app/(publico)/admissoes/[escolaSlug]/PublicHero.tsx` | **[NOVO]** Componente visual do topo da página utilizando a `cor_primaria`. |
| `apps/web/src/app/(publico)/admissoes/[escolaSlug]/CourseCatalog.tsx` | **[NOVO]** Exibição dos cursos em formato de cards. |
| `apps/web/src/app/(publico)/admissoes/[escolaSlug]/FloatingSupport.tsx` | **[NOVO]** Componente para o botão do WhatsApp. |

---

## 4. Estratégia de Deploy e Segurança

*   **Feature Flag / Estágios:** Nenhuma migração de banco de dados é estritamente necessária para a V2 visual, pois os dados (escola, turmas, ocupação) já são expostos pela V1.
*   **Segurança:** A rota de `POST /api/public/admissoes/[escolaSlug]/candidatar` não sofrerá mutações críticas que quebrem compatibilidade. O Honeypot (`hp_field`) atual será mantido na última etapa do novo formulário.
*   **Performance:** A página continua usando Server Components na `page.tsx` para fazer o fetch rápido paralelo dos dados do Supabase, passando para os Client Components (Form) apenas a estrutura visual e os dados estritos (`AdmissionConfig`).

---
*Este documento servirá de guia para a execução da V2 do portal de admissões público quando priorizado.*
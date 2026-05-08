# Plano de Optimização: Navegação e Performance UI

Este documento detalha a estratégia para eliminar os recarregamentos totais de página e os fetches redundantes nas rotas de **Turmas, Matrículas e Lista de Alunos**.

## 1. Problemas Identificados

1.  **Sidebar Flicker:** O `AppShell` desmonta toda a interface (incluindo a sidebar) enquanto valida o papel do utilizador (`UserRole`), resultando num estado de "Loading..." que força o browser a re-renderizar tudo.
2.  **Layout Jump:** Páginas baseadas em Client-side Fetching (`useEffect`) começam vazias e "saltam" quando os dados chegam.
3.  **Fetches Redundantes:** Algumas páginas fazem fetches no servidor (para validação) e os mesmos fetches no cliente (para exibição).
4.  **Desperdício de Cache:** A cada clique na sidebar, o estado da aplicação é reiniciado, perdendo dados já carregados anteriormente.

---

## 2. Fase 1: Estabilização do AppShell (Navegação Fluida)

**Objectivo:** Garantir que a estrutura básica (Sidebar + Topbar) seja persistente e nunca desmonte.

*   **Implementação de `UserRoleProvider`:**
    *   Criar um Context Provider para o papel do utilizador.
    *   Envolver o portal neste provider para que a validação ocorra uma única vez por sessão.
*   **Refatoração do `AppShell.tsx`:**
    *   **Remover** o `if (isLoadingRole) return <div>Loading...</div>`.
    *   Renderizar a estrutura `Sidebar` + `Main Content` imediatamente.
    *   Usar *skeleton screens* ou estados neutros para os menus que dependem de permissões, mas manter o contentor da Sidebar fixo.

---

## 3. Fase 2: Hidratação de Dados (Server-side First)

**Objectivo:** Renderizar a página já com dados no primeiro carregamento.

*   **SSR para Dados Iniciais:**
    *   Converter `page.tsx` de Alunos e Turmas para aceitar dados vindos do servidor.
    *   Fazer o fetch da primeira página de resultados no Servidor (Next.js Server Components).
*   **Hidratação Client-side:**
    *   Passar os dados para os componentes Client via props (`initialData`).
    *   Ajustar os hooks de fetch para usar o `initialData` como estado inicial, evitando a primeira chamada de rede no `mount`.

---

## 4. Fase 3: Cache e SWR (Experiência SPA)

**Objectivo:** Navegação instantânea entre rotas já visitadas.

*   **Adopção de SWR/React Query:**
    *   Substituir chamadas directas de `fetch` dentro de `useEffect` por hooks do SWR.
    *   Configurar cache de 5-10 minutos para dados de leitura (Turmas, Listas).
*   **Navegação Inteligente:**
    *   Ao navegar de "Alunos" para "Turmas" e voltar, os dados devem aparecer instantaneamente do cache enquanto o SWR valida se houve alterações em background.

---

## 5. Próximos Passos

1.  [x] Criar `UserRoleProvider.tsx`.
2.  [x] Modificar `AppShell.tsx` para persistência estrutural (Flicker fix).
3.  [x] Implementar `initialData` na página de Turmas (SSR ready).
4.  [x] Implementar `initialData` na página de Alunos (SSR ready).
5.  [x] Implementar `initialData` na página de Admissões (SSR ready).
6.  [x] Instalar e configurar SWR (Fase 3).
7.  [x] Refatorar hooks de fetch para usar SWR com `initialData`.

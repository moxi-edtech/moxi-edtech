# KLASSE IA — pré-produção, revisão de UX (PR sobre #215)

## Integração sem duplicação

- Base: **#212 → #214 → #215 (HEAD do chat com verde vibrante)**. Esta revisão fica numa PR **empilhada sobre #215**; não se fazem merges intermédios, migrações nem deploy.
- Reutiliza o estado `klasse_ai_v3_open_${schoolId}` e a anulação por mudança de escola, reforçando-os com identidade/ano/polo e autorização antes de renderizar. Conversa, rascunho e cache são **apenas memória do componente**, nunca `localStorage`.
- O modo expandido é o próprio chat (não um novo painel). Preferência expandida em `localStorage` **só como booleano por utilizador**; nunca armazena mensagens, filtros, IDs de alunos ou respostas.

## Decisões de UX e acesso

1. **Expandir**: lateral larga no desktop, mesmo diálogo em ecrã inteiro no telemóvel. Escape recolhe, foco dirige-se para fechar na expansão e regressa ao controlo na recolha. A janela mantém o contexto de trabalho visível no desktop.
2. **Leitura**: resposta principal curta; título, indicadores com unidade e acções; origem, âmbito/filtros, carimbo horário, cobertura parcial e evidências completas em `<details>`. Cabeçalhos `<th scope="col">`, tabela dentro de deslocamento horizontal local. Nunca confiar numa métrica sem proveniência: se faltar, apresentar indisponível.
3. **Escrita/teclado**: textarea `scrollHeight` até 128px, rolagem depois. Enter envia apenas no desktop fora de IME; Shift+Enter insere linha, Enter móvel insere linha; botão visível. Escuta `visualViewport.resize/scroll` e ajusta o diálogo ao espaço visível. Capturas com altura reduzida simulam teclado virtual; não provam o comportamento de cada teclado nativo de iOS/Android.
4. **Estados**: uma consulta pendente de cada vez; Cancelar chama `AbortController`. Retry manual único reenvia sem repetir pergunta no histórico; 429, acesso negado e indisponibilidade têm mensagens neutras. Sem loop de retry; interrupção do provedor descarta a saída parcial e sinaliza explicitamente.
5. **Isolamento**: `userId:schoolId:academicYearId:poloId` invalida histórico, rascunho, cache, conversa da ferramenta e consultas pendentes; eventos de auth existentes `SIGNED_OUT` e mudança de utilizador limpam memória; «Nova conversa» força reset local. Conversa antiga não é recuperada sem infraestrutura homologada.
6. **Brevidade**: **65 palavras alvo** por resposta simples e 1–2 frases, até 3 pontos. Backend RAG usa **máximo absoluto de 384 tokens** (por omissão 320), inclusive quando o ambiente pede mais; conteúdo operacional determinístico preserva contagens e cobertura sem cortar. Texto de resposta longa é separado em frases/parágrafos completos, com «Ver detalhes»; nenhuma truncagem a meio de um número ou tabela. Lista de docentes já usa paginação canónica **PAGE_SIZE=8** em `school-intelligence.ts`.

## Orçamento de pedidos

| Situação | Antes (#215) | Depois | Diferença |
| --- | ---: | ---: | ---: |
| Abrir chat, se autorizado | 1 verificação de acesso | 1 verificação de acesso | 0 |
| Pergunta sem fast-path em cache | 1 POST ao assistente | 1 POST ao assistente | 0 |
| Pergunta fast-path repetida | 0 extra no cache local | 0 extra no cache local | 0 |
| Expandir/recolher, rolar, Ver detalhes, editar, fechar/abrir | 0 | 0 | 0 |
| Cancelar consulta | — | 0 extra; aborta POST ativo | 0 |
| Tentar de novo | a tecla de retry fazia novo POST e repetia mensagem | 1 POST explícito, sem mensagem duplicada | 0 extra |
| Troca de ano, polo, escola, conversa | escola fazia verificação de acesso | escola conserva verificação; ano/polo não consultam | 0 extra |

Sem nova fonte Supabase, nova chamada de modelo, novo poll nem reconciliação automática. A regra actual do servidor para rate limiting e contextos permanece inalterada.

## Validação / limites

- Provas mockadas: `assistant-chat-presentation.spec.ts` verifica resposta curta, recusa, tabela e paginação; Playwright usa fixture sintética, simula auth e API, valida teclado, foco, interrupções, retry, scoped context, isolamento e UI em 5 resoluções × 3 escalas. Capturas e manifesto são artefactos do GitHub Actions.
- Regressões do produto (copiloto/Balcão/auth) ainda requerem homologação na escola e com utilizador autorizado antes de merge; CI não prova banco real nem diferentes teclados físicos.
- Sem chamada de LLM real, SQL livre, escrita de dados, exposição de dados de menores, mudança RLS, quotas, schema ou motor académico/fiscal.

# Portal do Aluno — Auditoria da linguagem visual
**Data:** 21/11/2026 · **Escopo:** `apps/web` · **Referência:** `docs/design-tokens.md` e `docs/product/PORTAL_UX_STANDARDS_20261027.md`

## Diagnóstico no código

| Gravidade | Inconsistência | Origem | Tratamento |
|---|---|---|---|
| P1 | Layout do aluno sobrepunha cartão branco de página aos cartões dos módulos, com margens e larguras divergentes | `AlunoLayoutClient` + Dashboard + páginas-filhas | Container único de 1200px, padding 16/24px, superfícies independentes |
| P1 | Cabeçalho usava `font-black`, etiquetas em caixa alta, perfil demasiado ornamentado e nome de escola abreviado | `AlunoHeader` | Marca, escola completa truncada só visualmente, seleção de educando com foco e saída preservadas |
| P1 | Bottom navigation apresentava excesso de animações, formas e estados, destoando do Portal do Professor | `AlunoBottomNav` | Barra compacta com ícones Lucide, ativo dourado, menu secundário acessível |
| P1 | Dashboard duplicava branding/navegação e usava hero promocional gigante | `DashboardLoader` | Cabeçalho editorial compacto, títulos verdes, cartões informativos neutros |
| P2 | Financeiro, Perfil, Horário e Notas usavam cores slate fixas e raios diferentes das superfícies canónicas | `TabFinanceiro`, `TabPerfil`, `TabHorario`, `TabNotas` | `bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, `rounded-xl` |
| P2 | Actividades e rota `/home` legada tinham cartões enormes, peso de fonte elevado, sombras fortes e fundos de aviso usados como hero | `atividades/page`, `TabHome`, `home/page` | Hierarquia e superfícies simplificadas, métricas e ações preservadas |
| P2 | Controlos do Cartão de Estudante/QR e carregamentos diferiam do portal | `CartaoEstudante`, `aluno/loading` | Controlos com `aria-pressed`, skeletons semânticos; arte oficial do cartão/QR intacta |
| P2 | Notificações Push usavam paleta e tipografia próprias | `PushSettings` | Componente reusando neutros e marca; estados de erro continuam semânticos |

## Convenções efetivas

- **Marca:** verde `#1F6B3B` para identificação e títulos. **Dourado:** `#E3B23C` nos CTAs/seleção, nunca para preencher um ecrã inteiro.
- **Superfície:** fundo discreto, cartões compactos e independentes (`border-border bg-card rounded-xl`), sem cartão gigante envolvendo todas as secções.
- **Navegação:** Lucide de 18–20px, altura tátil mínima 44px, estado ativo explícito, foco dourado, todos os destinos e query `aluno` preservados.
- **Estados:** verde/âmbar/vermelho/azul só quando exprimem informação real (pago, pendente, rejeitado, informativo); não reinterpretar autorização, notas nem propinas.
- **Identidade digital:** o documento físico digitalizado conserva design/QR próprio por ser artefacto funcional, não a decoração da aplicação.
- **Contexto:** a rota real `/escola/[id]/aluno/*` reexporta a implementação em `(portal-aluno)/aluno/*`. O `StudentPortalLayout` legado não participa desse percurso e não deve ser reaproveitado sem auditoria de consumidores.

## Funcionalidades que não devem sofrer regressão

Login no servidor e vínculo escola/aluno, isolamento por tenant e RLS; troca de educando, `ano_letivo_id`, carregamento SWR, links e preloads; consulta de notas autorizadas; geração de documentos, recibos e pagamentos; QR de validação, cache offline, matrícula e rematrícula; notificações Push; pesquisa e execução de actividades; estados de erro.

Esta entrega modifica **apenas apresentação de React e classes Tailwind**, sem alterações de API, RPC, SQL ou políticas RLS.

## Validação

- Testes de contrato em `apps/web/tests/unit/aluno-visual-identity-ssot.spec.ts`, além da suite existente `portal-klasse-brand-academic-ux` e `portal-ui-standards`.
- CI de TypeScript, regressões funcionais, temas e integridade de rotas obrigatório antes de integrar.
- Pendente de verificação manual: telas autenticadas a 320/375/390/768/1280px, zoom 200%/400%, VoiceOver/Safari, estados com vários educandos, conta sem dados e módulos financeiros reais. Não alegar homologação WCAG 2.2 AA apenas por testes de código.


## Continuação — hardening de navegação e identidade (21/11/2026)

- A lista de actividades, a resolução e a Home legada usavam links `/aluno/...` sem reter `/escola/[slug]`, `aluno` e `ano_letivo_id`. O helper `buildStudentPortalHref` passa a preservar explicitamente estes campos (não transporta parâmetros alheios à navegação).
- A rota contextual de execução expõe `[atividadeId]`, mas o runner partilhado espera `[id]`. Um adaptador tipado no reexport mapeia o ID antes de carregar o runner, sem alterar APIs nem submissões.
- A cache offline do cartão digital usava `studentId` ou `default` como chave: insuficiente para multi-tenant. A chave v2 inclui utilizador autenticado no layout, escola e **educando explicitamente selecionado**; sem parâmetro `aluno`, a página funciona online mas não grava nem recupera cache offline ambígua. Pedidos abortados não atualizam cartões de outro contexto.
- Os registos locais do formato anterior são eliminados por não permitirem comprovar a escola e a conta. **Na primeira utilização após a atualização, o cartão necessita de acesso online para reconstituir o cache offline de forma isolada.** O QR e a apresentação continuam disponíveis offline depois desse primeiro carregamento.
- A separação por chave evita reutilização acidental entre sessões, mas **não cifra** os dados guardados no navegador. Em dispositivos partilhados, a retenção de dados pessoais offline continua a exigir política específica; não tratar localStorage como armazenamento confidencial.
- Regressões adicionadas: helper contextual com isolamento de parâmetros, contrato de mapeamento `atividadeId`, emissão e recuperação offline com `AbortController`, sem suprimir ações de guardar/submeter.

## Política de retenção offline e limpeza no logout

- A cache local do cartão passa a usar envelope **v3**, TTL máximo de **24 horas** e é invalidada antecipadamente quando expira a validade do documento. Registos v2 e legados são purgados na primeira utilização.
- Apenas o conjunto mínimo de dados para apresentar o QR/identificação é guardado. O número do BI, fotografias e atributos adicionais da API não são persistidos offline.
- A chave exige conta autenticada, escola e educando explícito. Sem parâmetro `aluno`, o cartão continua disponível online, mas não fica disponível offline.
- O botão global **Sair** limpa as caches locais e de sessão antes de revogar a sessão, além da cache do Service Worker e IndexedDB já existentes. Um evento `SIGNED_OUT` ou troca de conta `SIGNED_IN` também limpa caches, incluindo outras abas.
- LocalStorage não é criptografado. A funcionalidade offline é limitada à janela de retenção e exige uma sessão atual validada pelo layout do portal; não garante revogação imediata num dispositivo que permanece offline. Para maior segurança deve-se avaliar armazenamento cifrado específico da plataforma numa iteração futura.
- Retenção da identidade no browser **não** modifica políticas legais de retenção do histórico fiscal nem documentos originais armazenados no servidor.

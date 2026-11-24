# Operações — Dashboard clean (2026-11-24)

- Prioridade: contexto académico, alertas existentes quando relevantes, acompanhamento diário, ações rápidas, indicadores gerais, resumo financeiro, painéis secundários e avisos.
- Ações e contadores existentes preservados; o contador de aulas é rotulado «Aulas por confirmar» porque não contabiliza todas as aulas do dia; Fecho diário continua a abrir a gestão de fechos. Recebimentos e horários mantêm os modais e guardas. Nova matrícula e Nova admissão permanecem acessíveis.
- Contexto compacto mostra bloqueios/exames e permite consultar o evento corrente e o calendário. O resumo de caixa conserva os valores e a decomposição financeira num modal; sem previsão não se mostra percentagem de meta.
- Alterações exclusivamente de apresentação, condicionadas ao modo Operações; sem alteração de APIs, SQL, permissões, polling ou Realtime. O dashboard Secretaria e o modo Administração conservam a composição existente.
- Validação: testes de contrato adicionados; CI e smoke autenticado ainda necessários. Confirmar layout desktop/notebook e acesso por admin/admin_financeiro.

## Revisão pré-merge

- Cards diários e atalhos com densidade compacta opt-in; preservam texto, foco, ações e motivo de bloqueio. Secretaria e Admin mantêm variantes anteriores.
- Um botão «Atualizar painel» coordena o refresh dos dados de servidor e dos contadores; a tentativa local continua disponível em caso de erro. Mantém o polling e Realtime existentes.
- Propinas pendentes passam a usar o estado operacional pendente do ano lectivo activo, com âmbito explícito; o cálculo antigo total menos pagas antecipadas incluía liquidações não antecipadas. Propinas em atraso usam o mesmo read model. Não se afirma um total mensal que a view não fornece.
- Caixa acima do previsto mostra distinção de competência/caixa sem abrir modal. Sem migração, sem consulta adicional e sem mudança de RLS.
- CI da revisão e homologação autenticada ainda pendentes.

- Em caso de falha no resumo de estados ou ausência de ano activo, os cartões e o foco exibem dados indisponíveis em vez de zero. Grelhas de atalhos usam 2/3/4 colunas conforme largura útil.

## Ajuste de identidade e atalhos (feedback pós-publicação)

- Ícones funcionais dos cards compactos de acompanhamento, indicadores e atalhos voltam ao padrão verde do design system (`bg-emerald/10 text-emerald dark:text-emerald-300`). Estados de alerta mantêm o valor em âmbar; ícone de bloqueio mantém estilo neutro.
- Ações rápidas de Operações: Fecho diário, Recebimentos, Quadro de Horários e Criar Aviso. Nova matrícula, Nova admissão e Importar Alunos deixam apenas esta superfície; não se removem rotas, permissões nem fluxos de outros portais.
- Quatro atalhos em 4/2/1 colunas conforme largura útil; sem fila de três com cartão isolado. CI e homologação visual pendentes.

## Regra contextual dos ícones compactos

- Verde: estado normal ou ação disponível. Dourado/âmbar: pendência confirmada (aulas, planos, reaberturas, propinas e fechos por validar ou regularizar). Cinzento: ação bloqueada ou indicador sem dados. Precedência do estado indisponível; números e rótulos continuam a transmitir o significado sem depender só da cor.
- A cor é derivada dos contadores já existentes, sem novas consultas. Atalhos sem contadores próprios ficam verdes; não se usa a variante estática amarela para simular pendências. Indicador de alunos não sinaliza falta de turmas como se fosse uma pendência de alunos.
- Regra partilhada em `operational-card-tone.ts`, com testes dos estados normal, atenção e indisponível; variantes não compactas preservadas. CI e homologação visual pendentes.

## Alinhamento e hierarquia das famílias de cards

- Acompanhamento diário: três métricas com a mesma grelha de cabeçalho/valor, mínimo de 7rem e uma coluna quando não houver largura para três; evita um card isolado em segunda fila.
- Ações rápidas e atalhos financeiros: mesma variante horizontal de 80px mínimos e grelha 1/2/4 colunas (480px e 920px de largura útil). Os quatro indicadores gerais usam os mesmos pontos de mudança, com cabeçalho, número e rodapé alinhados e mínimo de 8.25rem. Reservar o rodapé não desloca a linha dos números quando apenas alguns têm descrição.
- Todas as grelhas esticam os cards da família; alturas mínimas permitem quebra de texto e zoom, sem cortar rótulos. Ícones de 16px em suportes de 32px, cores contextuais existentes. Financeiro secundário mantém links e modal; inadimplência sinaliza pendência quando confirmada. Nenhuma mudança de rota, consulta ou outro portal.
- CI e inspeção visual autenticada ainda necessários; os contratos estáticos não substituem validação em browser.

# Calendário escolar — agenda de Operações e Secretaria

- Página partilhada: a rota Operações delega à Secretaria. Breadcrumb contextual, sem layout duplicado.
- Agenda agrupada por mês, scroll normal da página, datas em destaque, sem barras coloridas, emojis, etiquetas técnicas ou descrição genérica redundante. Descrições reais, curso aplicável e públicos específicos preservados.
- Novo evento abre ModalShell; mantém API, ano lectivo seleccionado e públicos existentes. Fim opcional envia null, valida ordem temporal e bloqueia submissão concorrente. Erro da criação não apaga o formulário.
- Filtros de ano/curso no servidor; pesquisa e próximos eventos no conjunto carregado. Requests cancelados ao trocar filtros. Não aumenta consultas; mantém limite existente de 300 com aviso quando atingido.
- Datas de leitura exibidas em Africa/Luanda. Contrato de escrita de datas existente mantido; API, RLS e regras académicas não alteradas. Auditoria de limites/tenant/timezone da API fora desta entrega.
- CI e homologação autenticada pendentes.

## Estados e categorias

- Estado derivado localmente: Agendado, Em curso, Terminado ou Data indisponível. Datas académicas inclusivas no fuso Africa/Luanda; eventos gerais com hora usam instantes reais. Evento pontual sem fim termina após o instante inicial. Actualização local por minuto e foco, sem polling de rede.
- Filtro de categorias a partir de tipos existentes, incluindo feriados, pausas/férias, avaliações/exames, matrículas, ano lectivo, eventos escolares e fallback Outros. Estados independentes das categorias. Feriado e pausa pedagógica recebem a indicação de interrupção pedagógica, conforme os tipos do motor actual (vw_escola_estado_hoje); não afirma que a escola inteira está fechada nem altera permissões. Âmbito por curso preservado. Férias dos alunos não são inferidas como bloqueio do diário.
- Testes de fronteira da meia-noite em Luanda, datas inclusivas, eventos com hora, datas inválidas e categorias. Sem nova consulta, coluna ou migração. CI pendente.

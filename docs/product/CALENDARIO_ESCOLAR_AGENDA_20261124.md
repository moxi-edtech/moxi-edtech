# Calendário escolar — agenda de Operações e Secretaria

- Página partilhada: a rota Operações delega à Secretaria. Breadcrumb contextual, sem layout duplicado.
- Agenda agrupada por mês, scroll normal da página, datas em destaque, sem barras coloridas, emojis, etiquetas técnicas ou descrição genérica redundante. Descrições reais, curso aplicável e públicos específicos preservados.
- Novo evento abre ModalShell; mantém API, ano lectivo seleccionado e públicos existentes. Fim opcional envia null, valida ordem temporal e bloqueia submissão concorrente. Erro da criação não apaga o formulário.
- Filtros de ano/curso no servidor; pesquisa e próximos eventos no conjunto carregado. Requests cancelados ao trocar filtros. Não aumenta consultas; mantém limite existente de 300 com aviso quando atingido.
- Datas de leitura exibidas em Africa/Luanda. Contrato de escrita de datas existente mantido; API, RLS e regras académicas não alteradas. Auditoria de limites/tenant/timezone da API fora desta entrega.
- CI e homologação autenticada pendentes.

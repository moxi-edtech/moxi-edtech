# Navegação financeira em Operações

- Card Propinas em atraso: abre a carteira canónica /operacoes/financeiro/cobrancas com ano_letivo_id do ano activo usado nos indicadores, sem hardcode do Curtume. Sem ano resolvido, mantém URL sem parâmetro (resolução existente do destino).
- Radar → Alunos e turmas e retorno: links absolutos por escola e portal, com ano lectivo preservado. Elimina resolução errada de ../turmas-alunos a partir de /operacoes/radar. Reutiliza aliases existentes /operacoes/radar e /operacoes/turmas-alunos, mantendo rotas /financeiro no portal financeiro.
- Cobranças usa rewrite financeiro existente. Não cria página, filtro de cobrança automático, queries, mudanças de dados ou permissões. Contexto académico reconhece ambos os aliases.
- Teste com URL exacta do Curtume e outros contextos. CI e smoke autenticado pendentes. PR separada da agenda escolar.

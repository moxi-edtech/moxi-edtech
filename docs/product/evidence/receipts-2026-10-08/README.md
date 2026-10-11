# Recibos: evidência visual isolada — 2026-10-08

Os arquivos deste diretório foram gerados localmente pelo `agent-browser` em 1440×900 usando os componentes de impressão da aplicação, mas **exclusivamente dados fictícios**, sem autenticação, RPC fiscal, escola real, valores de produção ou emissão de documentos.

- `receipt-consolidated-screen.png`: apresentação do recibo consolidado com três mensalidades e total de 15.000 Kz.
- `receipt-consolidated-print.pdf`: exportação PDF do componente canónico de impressão, 1 página, duas vias e as três mensalidades discriminadas.
- `financeiro-receipt-print.pdf`: exportação do componente de impressão utilizado no Financeiro, 1 página, duas vias e mesmas mensalidades.
- O teste do Financeiro verificou via DOM `print-ready=recibo pronto`, `dateCorrect=true`, `oldDate=false` para data civil 2026-10-08. A exportação foi repetida após corrigir a data de recibo.

A rota temporária da fixture foi apagada e não faz parte do PR. Não houve abertura de recibos de estudantes reais nem teste autenticado de autorização por escola/polo; isso continua um gate.

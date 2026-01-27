-- mv_total_escolas
CREATE MATERIALIZED VIEW mv_total_escolas AS
SELECT count(*) AS total FROM escolas WHERE status <> 'excluida';
CREATE UNIQUE INDEX ON mv_total_escolas (total);

-- mv_total_usuarios_globais
CREATE MATERIALIZED VIEW mv_total_usuarios_globais AS
SELECT count(*) AS total FROM profiles WHERE role IN ('super_admin', 'global_admin');
CREATE UNIQUE INDEX ON mv_total_usuarios_globais (total);

-- mv_total_matriculas
CREATE MATERIALIZED VIEW mv_total_matriculas AS
SELECT count(*) AS total FROM matriculas;
CREATE UNIQUE INDEX ON mv_total_matriculas (total);

-- mv_total_notas_lancadas
CREATE MATERIALIZED VIEW mv_total_notas_lancadas AS
SELECT count(*) AS total FROM notas WHERE nota IS NOT NULL;
CREATE UNIQUE INDEX ON mv_total_notas_lancadas (total);

-- mv_total_notas
CREATE MATERIALIZED VIEW mv_total_notas AS
SELECT count(*) AS total FROM notas;
CREATE UNIQUE INDEX ON mv_total_notas (total);

-- mv_total_pagamentos_pagos
CREATE MATERIALIZED VIEW mv_total_pagamentos_pagos AS
SELECT count(*) AS total FROM pagamentos WHERE status = 'pago';
CREATE UNIQUE INDEX ON mv_total_pagamentos_pagos (total);

-- mv_total_pagamentos
CREATE MATERIALIZED VIEW mv_total_pagamentos AS
SELECT count(*) AS total FROM pagamentos;
CREATE UNIQUE INDEX ON mv_total_pagamentos (total);

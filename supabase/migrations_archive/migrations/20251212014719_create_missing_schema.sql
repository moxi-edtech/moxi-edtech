-- 2.1. turma_disciplinas
create table if not exists turma_disciplinas (
    id uuid primary key default gen_random_uuid(),
    escola_id uuid not null references escolas(id) on delete cascade,
    turma_id uuid not null references turmas(id) on delete cascade,
    disciplina_id uuid not null references disciplinas(id) on delete restrict,
    carga_horaria int, -- opcional
    ordem int, -- para ordenar no boletim
    created_at timestamptz not null default now()
);

create unique index if not exists turma_disciplinas_unica on turma_disciplinas (escola_id, turma_id, disciplina_id);

-- 3.1. Tabela avaliacoes (This table already exists, but the user's definition is slightly different, I will add the missing columns)
ALTER TABLE public.avaliacoes
    ADD COLUMN IF NOT EXISTS turma_disciplina_id uuid references turma_disciplinas(id) on delete cascade,
    ADD COLUMN IF NOT EXISTS tipo text,
    ADD COLUMN IF NOT EXISTS bimestre int,
    ADD COLUMN IF NOT EXISTS max_valor numeric(6,2) not null default 20.0,
    ADD COLUMN IF NOT EXISTS created_by uuid,
    ADD COLUMN IF NOT EXISTS created_at timestamptz not null default now();


-- 3.2. Tabela notas_avaliacoes
create table if not exists notas_avaliacoes (
    id uuid primary key default gen_random_uuid(),
    avaliacao_id uuid not null references avaliacoes(id) on delete cascade,
    matricula_id uuid not null references matriculas(id) on delete cascade,
    aluno_id uuid not null references alunos(id) on delete restrict,
    valor numeric(6,2) not null,
    observado_em timestamptz not null default now(),
    observacao text,
    unique (avaliacao_id, matricula_id, aluno_id)
);


-- 3.3. View para média automática (MVP)
create or replace view vw_medias_por_disciplina as
select
    m.escola_id,
    m.aluno_id,
    td.disciplina_id,
    a.bimestre,
    sum(n.valor * a.peso) / nullif(sum(a.peso),0) as media_ponderada
from notas_avaliacoes n
join avaliacoes a on a.id = n.avaliacao_id
join matriculas m on m.id = n.matricula_id
join turma_disciplinas td on td.id = a.turma_disciplina_id
group by
    m.escola_id,
    m.aluno_id,
    td.disciplina_id,
    a.bimestre;


-- 4.1. aulas
create table if not exists aulas (
    id uuid primary key default gen_random_uuid(),
    escola_id uuid not null references escolas(id) on delete cascade,
    turma_disciplina_id uuid not null references turma_disciplinas(id) on delete cascade,
    data date not null,
    conteudo text,
    numero_aula int, -- 1,2,3... dentro do período
    created_by uuid, -- professor
    created_at timestamptz not null default now()
);

-- 4.2. frequencias (This table exists, but the user's definition is slightly different, I will add the missing columns)
ALTER TABLE public.frequencias
    ADD COLUMN IF NOT EXISTS aula_id uuid references aulas(id) on delete cascade,
    ADD COLUMN IF NOT EXISTS observacao text;

-- 5.1. historico_anos
create table if not exists historico_anos (
    id uuid primary key default gen_random_uuid(),
    escola_id uuid not null references escolas(id),
    aluno_id uuid not null references alunos(id),
    ano_letivo int not null,
    turma_id uuid not null references turmas(id),
    resultado_final text not null, -- aprovado, reprovado, transferido...
    media_geral numeric(6,2),
    data_fechamento date not null default current_date,
    unique (escola_id, aluno_id, ano_letivo)
);

-- 5.2. historico_disciplinas
create table if not exists historico_disciplinas (
    id uuid primary key default gen_random_uuid(),
    historico_ano_id uuid not null references historico_anos(id) on delete cascade,
    disciplina_id uuid not null references disciplinas(id),
    media_final numeric(6,2),
    resultado text, -- aprovado / reprovado / isento
    faltas_totais int,
    unique (historico_ano_id, disciplina_id)
);


-- 6.1. Contrato financeiro por aluno/ano
create table if not exists financeiro_contratos (
    id uuid primary key default gen_random_uuid(),
    escola_id uuid not null references escolas(id),
    aluno_id uuid not null references alunos(id),
    matricula_id uuid not null references matriculas(id),
    ano_letivo int not null,
    plano text, -- "Normal", "Bolsa 50%", etc.
    desconto_percentual numeric(5,2) default 0,
    status text not null default 'ativo',
    created_at timestamptz not null default now()
);

-- 6.2. Contas a receber (mensalidades, matrícula, etc.)
create table if not exists financeiro_titulos (
    id uuid primary key default gen_random_uuid(),
    escola_id uuid not null references escolas(id),
    contrato_id uuid references financeiro_contratos(id) on delete set null,
    aluno_id uuid not null references alunos(id),
    tipo text not null check (tipo in ('matricula','mensalidade','multa','outro')),
    competencia text, -- "2025-03" por ex.
    vencimento date not null,
    valor_original numeric(12,2) not null,
    valor_desconto numeric(12,2) default 0,
    valor_pago numeric(12,2) default 0,
    status text not null default 'pendente' check (status in ('pendente','pago','atrasado','cancelado')),
    pago_em date,
    referencia text, -- código boleto / entidade MCX
    created_at timestamptz not null default now()
);

-- KLASSE: defaults backend para curso_matriz
update public.curso_matriz
set periodos_ativos = '{1,2,3}'
where periodos_ativos is null or array_length(periodos_ativos, 1) = 0;

update public.curso_matriz
set avaliacao_mode = 'inherit_school'
where avaliacao_mode is null or avaliacao_mode = '';

update public.curso_matriz
set classificacao = 'core'
where classificacao is null or classificacao = '';

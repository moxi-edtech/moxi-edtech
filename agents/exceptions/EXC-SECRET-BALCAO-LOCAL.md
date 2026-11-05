# Excepção EXC-SECRET-BALCAO-LOCAL
regra: check-no-secrets.sh — URL PostgreSQL de fixture local
ficheiro: .github/workflows/balcao-academic-operations.yml
motivo: Os serviços postgres:17 do CI criam dois bancos descartáveis, sem dados de clientes. As URLs usam a credencial padrão pública postgres/postgres no loopback 127.0.0.1:5432, bancos balcao_academic_test e balcao_actions_test. O scanner do histórico recusou esses valores de teste como possível segredo. A exceção compara o path exato e a linha PGURL inteira, permitindo somente esses dois literais; qualquer outro utilizador, password, host, porta, banco, path ou texto adicional continua bloqueado. Nenhuma credencial real é obtida ou dispensada pelo controlo.
aprovado_por: utilizador — pedido de merge da branch nesta conversa; correção técnica de falso positivo dentro desse escopo, sem alegação de aprovação específica deste ficheiro.
data: 2026-11-05
expira_em: permanente

Validação: teste com repositórios descartáveis exercita ambos os literais permitidos e rejeita alterações de password, host, porta, banco, path e credencial adicional na mesma linha. Não usa credenciais reais.

# KLASSE — Codex Scan Report
contrato_versao: 2.0.0
run_timestamp: 2026-10-29T12:08:25.233366+00:00
run_id: f4dfa5d5-f9f8-4e03-beaa-15f414f60da2
commit: f9cbb42e413024b836e69c733357b7254fe1959e + working tree validada antes do commit final

## Sumário
| Severidade | Total | Bloqueantes |
|---|---|---|
| CRITICAL | 0 | 0 |
| HIGH | 0 | 0 |
| MEDIUM | 0 | 0 |
| LOW | 0 | 0 |
| REGRESSION | 0 | 0 |

## Veredito
WARN

Escopo: alterações AppyPay; não certifica o repositório inteiro. Sem PASS parcial. can_merge: false.

## Blockers activos
APY-003: pagamento e entrega real de webhook no ambiente publicado ainda não exercitados.
APY-004: gate contratual global ainda não certificado pelo scanner legado.
APY-005: proposta de estrutura/baixa de serviços aguardando aprovação específica em PENDING_APPROVAL.md; não instalada no Supabase.
APY-007: aviso lint preexistente de constante MAX_SPAN não usada; não é finding de regra contratual sem evidência adicional.

## Findings
Nenhuma violação de regra reportada neste escopo. Os itens acima são limites de validação, não findings de código sem evidência.

## Regressões
REPORT_SCAN_LAST_PASS.json ausente. Sem regressões a reportar; baseline não atualizado.

## Excepções activas
EXC-SEC-001-B e EXC-SEC-002-A para callback de máquina /api/webhooks/appypay, documentadas em agents/exceptions/.

## Validação
- 29 testes código/HTTP aprovados; fronteiras HTTP simuladas.
- Lint separado: zero erros e um aviso preexistente MAX_SPAN na rota financeira do aluno.
- Build Next de produção completo aprovado com verificação de tipos e 182 páginas, gateway desativado e credenciais fictícias. APY-002 resolvido.
- Componente real da tesouraria e do aluno validado no navegador com fixture sintética; detalhes em VISUAL_APPYPAY.md.
- 3 cenários PostgreSQL local aprovados anteriormente; RPC financeira existente representada por fixture.
- OAuth produção verificado anteriormente sem cobrança.
- SQL aprovado aplicado anteriormente; corpo, privilégios e probe não mutável conferidos.
- Scanner legado novamente executado: zero critical/high/medium, seis marcadores LOW VALIDATED; gate legado PASS. Não implementa o contrato integral; APY-004 aberto.

Novo SQL proposto, sem aplicação em produção. 6 grupos SQL de serviços passaram no PostgreSQL local descartável usando os dois gatilhos existentes capturados literalmente; inclui concorrência real, permissões negativas, aprovação de serviços, evento 101 e saldo alterado.

Sem dados reais, deploy, merge ou ativação. APY-001 e APY-002 resolvidos; APY-003/004/005/007 registados no WARN_REGISTRY.md. A autorização geral de publicar foi dada pelo usuário; falta a aprovação específica do SQL conforme contrato.

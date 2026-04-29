# Relatório de Pendências AGT — Fiscal

data_relatorio: 2026-04-28
ambiente_validado: local (http://localhost:3000) e remoto histórico

## Veredito atual
NO-GO para certificação AGT.

## Evidências analisadas
- agents/outputs/FISCAL_SMOKE_AUTH_E2E_20260428T224246Z.md
- agents/outputs/fiscal/agt/FISCAL_ORACLE_VALIDATION_20260428T223130Z.md
- agents/outputs/FISCAL_SMOKE_AUTH_E2E_20260428T221425Z.md

## Bloqueadores ativos
1. Autenticação local não fechada no smoke
   - Sinal: chamadas fiscais retornam HTML de login após redirect (307 -> /login -> 200 HTML)
   - Impacto: fluxo fiscal não executa endpoints de negócio no ambiente local

2. Validação Oracle AGT em FAIL HARD
   - Sinal: 6/6 cenários com FAIL (UNKNOWN), sem snapshot_id e sem totais comparáveis
   - Impacto: não há prova de divergência 0.0000 entre KLASSE e oráculo

3. Evidência consolidada AGT incompleta
   - Falta pacote com: PDF fiscal válido + XML SAF-T válido + log de assert 0.0000 por cenário + auditoria simulada PASS

## O que já existe (positivo)
- Smoke remoto autenticado bem-sucedido em run anterior (20260428T221425Z)
- Engine determinístico e camadas fiscais implementadas em código
- Scripts de geração de evidência disponíveis

## Critérios objetivos para GO
1. Smoke local/target com endpoints fiscais reais (sem fallback para login HTML)
2. Oracle validation com 100% PASS nos cenários AGT
3. Snapshot imutável gravado para todos cenários
4. PDF e SAF-T XML gerados e consistentes com DB
5. Simulação de auditoria com PASS (hash + assinatura + consistência cruzada)

## Próxima execução recomendada
Executar smoke via login automático (sem cookie manual truncado), depois rodar build-agt-evidence no mesmo ambiente autenticado e anexar os dois artefatos novos.

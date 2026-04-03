# Roadmap — KLASSE: de Vertical Escolar para Engine Fiscal Comercial

## 1. Norte estratégico (0-12 meses)
- Transformar o fiscal em produto-core transversal (não dependente do domínio escolar).
- Manter o KLASSE Escolar como primeiro cliente interno da engine.
- Operar com três camadas:
  1. Fiscal Core Engine (regras, assinatura, hash, SAF-T, cadeia)
  2. Domain Adapters (Escolar, Retalho, Serviços, Logística)
  3. Canal/API Produto (UI, API pública, webhooks, evidência e auditoria)

## 2. Fases de execução

### Fase A — Foundation (0-45 dias)
- Congelar contrato fiscal canônico (documento, linha, referências, totais, assinatura).
- Desacoplar semântica escolar do core (nomes de itens, unidades, fluxos).
- Completar tipologias no engine: FT, FR, NC, ND, RC, PP, GR, GT, FG.
- Definir matriz de capacidade por tipo documental + evidência automática.
- Entregável: Core fiscal agnóstico + testes de regressão por tipo.

### Fase B — Compliance First (45-90 dias)
- Fechar exigências AGT pendentes (pontos 3/4/5/7/8/9/11/12/13/14/15).
- Padronizar consistência tripla: DB = XML = PDF.
- Consolidar pacote de auditoria externa:
  - verificação hash_control
  - verificação assinatura
  - replay da cadeia
- Entregável: Dossiê AGT pronto para submissão.

### Fase C — Produto Comercial (90-150 dias)
- Criar Adapter SDK interno (contratos para novos domínios).
- Lançar perfil comercial com catálogo fiscal genérico:
  - bens/serviços
  - UoM variada
  - impostos por regime
- Expor API de emissão/versionamento com idempotência forte.
- Entregável: 1º piloto não-escolar (retalho ou serviços).

### Fase D — Escala e Plataforma (150-240 dias)
- Pipeline assíncrono robusto (fila, retry, DLQ, observabilidade fim-a-fim).
- Reexportação segura por período + histórico paginado + download assinado.
- Painel de conformidade por tenant (SLO de emissão, falha XSD, latência).
- Entregável: Fiscal Engine multi-tenant comercial em produção.

### Fase E — Monetização e Ecossistema (240-360 dias)
- Planos por volume, features premium (webservice, validações avançadas, auditoria).
- Parcerias com integradores/contabilidades.
- Portal de integração (chaves, sandbox, docs, webhooks).
- Entregável: nova linha de receita “Fiscal Engine as a Service”.

## 3. Workstreams transversais (obrigatórios)
- Segurança: isolamento tenant, RLS, trilha de auditoria imutável.
- Qualidade: suíte E2E fiscal por tipo documental e por setor.
- Dados: versionamento de schema fiscal sem breaking changes.
- Operação: runbooks de incidente fiscal + SLA de suporte.

## 4. KPIs de sucesso
- % documentos válidos XSD oficial > 99,9%
- % emissões com idempotência correta = 100%
- tempo médio emissão (P95) < 2s síncrono / < 2 min assíncrono
- % divergência DB/XML/PDF = 0
- nº domínios ativos (escolar + 2 setores comerciais em 12 meses)

## 5. Próximo passo imediato (próximos 7 dias)
1. Formalizar o Fiscal Core Contract v1.
2. Fechar matriz AGT pendente com status real por ponto.
3. Abrir backlog técnico por épico (Core, Compliance, SDK, Operação, Comercial).

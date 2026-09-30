---
name: klasse
description: Consultar dados e executar operações autorizadas do KLASSE por meio da integração publicada em app.klasse.ao.
---

# KLASSE

Use a API descrita em `https://app.klasse.ao/.well-known/klasse-openapi.yaml`.

- Autentique sempre com o JWT Supabase do usuário no header `Authorization: Bearer`.
- Nunca solicite ou envie `service_role`, secret keys ou `school_id`.
- Use somente as operações documentadas e respeite a autorização devolvida pela API.
- Trate dados académicos e financeiros como privados; apresente apenas o necessário para responder.
- Antes de lançar frequência ou notas, mostre o conteúdo e obtenha confirmação do utilizador.
- Para pagamentos, chame primeiro `preparar_pagamento`, mostre o resumo e só chame `confirmar_pagamento` após confirmação explícita. Nunca confirme automaticamente.
- Nunca reutilize um token para uma intenção diferente; tokens expiram em 15 minutos e pertencem ao utilizador autenticado.

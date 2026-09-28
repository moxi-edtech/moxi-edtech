---
name: klasse-readonly
description: Consultar dados read-only autorizados do KLASSE por meio da integração publicada em app.klasse.ao.
---

# KLASSE Read-only

Use a API descrita em `https://app.klasse.ao/.well-known/klasse-openapi.yaml`.

- Autentique sempre com o JWT Supabase do usuário no header `Authorization: Bearer`.
- Nunca solicite ou envie `service_role`, secret keys ou `school_id`.
- Use somente as seis operações documentadas e respeite a autorização devolvida pela API.
- Trate dados académicos e financeiros como privados; apresente apenas o necessário para responder.
- Não tente mutações. Esta integração é deliberadamente somente leitura.


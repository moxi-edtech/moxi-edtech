#!/usr/bin/env python3
"""Fail closed unless the validator is the exact live Supabase definition plus
narrow service-state guards. The production snapshot is SQL only, no user data.
"""
from pathlib import Path
import re

baseline = Path("supabase/ops/tests/finance_validator_production_baseline.sql").read_text().strip()
migration = Path("supabase/migrations/20271015110000_fix_validar_pagamento_idempotency.sql").read_text()
marker = "CREATE OR REPLACE FUNCTION public.validar_pagamento("
assert baseline.count(marker) == 1 and migration.count(marker) == 1
actual = migration[migration.index(marker):].strip()
assert baseline.endswith("$function$") or baseline.endswith("$function$;")
assert actual.endswith("$function$")
# The baseline was obtained from pg_get_functiondef on the production project.
assert "financeiro_aplicar_pagamento_existente(v_pagamento.id,v_actor_id)" in actual
assert actual.count("financeiro_aplicar_pagamento_existente(v_pagamento.id,v_actor_id)") == 2
assert "md5(pg_get_functiondef('public.validar_pagamento(uuid,boolean,text)'::regprocedure))" in migration
assert "'74696d60970bed3361b17ba712725398'" in migration
insert_rejection = """    IF v_intent.status='failed' THEN
      RETURN jsonb_build_object(
        'ok',true,'idempotent',true,'status','rejected','pagamento_id',p_pagamento_id
      );
    END IF;
    IF v_intent.status <> 'pending' THEN
      RAISE EXCEPTION 'STATE: apenas comprovativo de serviço pendente pode ser rejeitado';
    END IF;

"""
insert_approval = """  IF v_intent.status <> 'pending' THEN
    RAISE EXCEPTION 'STATE: apenas comprovativo de serviço pendente pode ser aprovado';
  END IF;

"""
assert actual.count(insert_rejection) == 1
assert actual.count(insert_approval) == 1
reconstructed = actual.replace(insert_rejection, "", 1).replace(insert_approval, "", 1)
assert reconstructed.rstrip(";\\n") == baseline.rstrip(";\\n"), "Production financial function modified outside two service state guards"
print("FINANCE_VALIDATOR_PRODUCTION_BASELINE_PASS: financial/fiscal allocation unchanged, service states guarded")

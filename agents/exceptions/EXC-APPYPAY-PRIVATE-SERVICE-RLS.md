# Excepção EXC-APPYPAY-PRIVATE-SERVICE-RLS
regra: Supabase advisor 0008_rls_enabled_no_policy (INFO)
ficheiro: supabase/migrations/20261029121743_appypay_portal_services.sql
motivo: appypay_service_references é uma tabela privada operada exclusivamente pelo worker de máquina assinado. RLS ativo sem políticas nega acesso por defeito; anon/authenticated não possuem SELECT/INSERT/UPDATE nem EXECUTE da função de confirmação. Adicionar políticas permissivas apenas para silenciar o advisor ampliaria indevidamente o acesso.
aprovado_por: gundja, APPROVE cf8dc48d-6b39-47d3-af87-410afcf95ddb (SQL exato inclui a ausência intencional de políticas)
data: 2026-10-29
expira_em: permanente

Instalação conferida no Supabase: RLS true, anon/authenticated SELECT false e EXECUTE false; service_role autorizado; SECURITY INVOKER/search_path fixo. Este registo documenta o desenho já aprovado; não altera políticas, permissões ou o bloqueio global de release.

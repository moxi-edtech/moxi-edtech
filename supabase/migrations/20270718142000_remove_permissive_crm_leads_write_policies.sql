-- CRM writes are mediated by guarded SECURITY DEFINER RPCs.
DROP POLICY IF EXISTS crm_leads_insert_policy ON public.crm_leads;
DROP POLICY IF EXISTS crm_leads_update_policy ON public.crm_leads;

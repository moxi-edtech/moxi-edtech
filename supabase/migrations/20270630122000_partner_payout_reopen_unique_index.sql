BEGIN;

DROP INDEX IF EXISTS public.ux_partner_commission_payout_items_active;

CREATE INDEX IF NOT EXISTS ix_partner_commission_payout_items_commission
  ON public.partner_commission_payout_items (commission_id);

COMMIT;

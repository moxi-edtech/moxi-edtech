-- Purpose: Remove legacy and overloaded matricula confirmation functions.
--
-- This migration completes the transition to a Single Source of Truth (SSOT)
-- for matricula confirmation by dropping all conflicting functions.

-- Drop the ambiguous wrapper function
drop function if exists public.confirmar_matricula(uuid, boolean);

-- Drop the old core logic function
drop function if exists public.confirmar_matricula_core(uuid, int, uuid, uuid);

-- Drop the combined create-and-confirm function
drop function if exists public.create_or_confirm_matricula(uuid, uuid, uuid, int);

-- Notify PostgREST to reload the schema
notify pgrst, 'reload schema';

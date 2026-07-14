-- Hardening: the application must read radar data through the tenant-filtered
-- public view only. Direct access to the internal materialized view and public
-- refresh execution are not required by browser/authenticated users.

REVOKE ALL ON TABLE internal.mv_radar_inadimplencia FROM anon;
REVOKE ALL ON TABLE internal.mv_radar_inadimplencia FROM authenticated;

REVOKE ALL ON TABLE public.vw_radar_inadimplencia FROM anon;
REVOKE ALL ON TABLE public.vw_radar_inadimplencia FROM authenticated;
GRANT SELECT ON TABLE public.vw_radar_inadimplencia TO authenticated;

REVOKE ALL ON FUNCTION public.refresh_mv_radar_inadimplencia() FROM anon;
REVOKE ALL ON FUNCTION public.refresh_mv_radar_inadimplencia() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_mv_radar_inadimplencia() TO service_role;

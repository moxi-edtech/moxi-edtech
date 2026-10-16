# Academic target session: strict published-calendar validation

DRAFT only. No deployment.
The original year-only choice could create a target session from
a published template with invalid, missing or overlapping dates.
The new pure validation requires real ISO civil dates, accepts
cross-year and atypical (shorter) calendars, checks ano_base against
the start or end year, prohibits spans greater than 550 days and
unpublished academic periods outside their template, rejects
overlap with the active academic year, and checks consistent
school target year for multiple published education subsystems.
It refuses existing target years with different start/end dates
and completes validation before mutating offering bindings or creating
a new session. The queries already require is_oficial and PUBLICADO.
Nine synthetic unit tests cover rollover, shorter periods, multiple
subsystems, missing dates, invalid leap days, overlap and stale years.
Review the real published calendar template interpretation and
setup_active_ano_letivo RPC before this Draft can merge.

# M1 — Form-state protection

## Contract

`BalcaoDraftState` is a single status-only React context (clean / dirty / saving / saved). Form owners publish their **React state snapshots** and last server-confirmed baseline. It never serializes or stores student data globally. Undo to the original value returns to `clean`; `saving` prevents changing students. On server rejection the previous saved baseline remains intact, leaving a dirty status. File/receipt metadata are included in the checkout snapshot; native File input is retained by keeping its tab mounted. Existing local draft restoration is session scoped by actor/polo/school and cleaned on logout.

Registering forms: `AlunoProfilePanel`, `BalcaoAtendimento` checkout and document action, `useRematriculaBalcao`, `AdmissaoWizardClient` identification and academic fit, and `GradeEntryGrid`. No button label or DOM event is used to derive draft state. Retained panels aggregate only statuses, not values. The browser unload guard is attached only during pending work. Back/forward are intercepted by a same-URL history fence while pending; navigation confirmation is conservatively required before discarding.

## Tests

- `balcao-draft-state.spec.ts`: programmatic changes, revert, receipt file, saving, failed-write baseline, saved, clean.
- `balcao-behavior.mjs`: actual mounted React components with synthetic student, button-free state tracking, programmatic updates, reverted values, attached fixture file, attempted student switch in flight, failed save retention, confirmation decisions, tenant and user isolation.
- `balcao-history.mjs`: dirty browser Back confirmation with rejection retaining the form; clean form does not prompt.

## Trade-offs

The browser's built-in `beforeunload` message cannot be customized. An App Router popstate interception uses a history fence and therefore may require a second Back after an edited form is saved; this requires authenticated Next.js E2E validation before merge. This implementation does not claim comprehensive finance RLS integration or real user Web Vitals.

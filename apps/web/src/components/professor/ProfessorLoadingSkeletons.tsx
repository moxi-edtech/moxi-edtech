/**
 * Placeholders alinhados com a estrutura real do Portal do Professor.
 * Partilham os mesmos breakpoints, grids e raios dos componentes carregados.
 * Apenas conteúdo visual: nenhum dado académico é simulado.
 */
export function ProfessorSkeletonBone({
  className = "",
  inverse = false,
}: {
  className?: string;
  inverse?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`block shrink-0 rounded-lg ${inverse ? "bg-klasse-green-700" : "bg-border"} ${className}`}
    />
  );
}

export function ProfessorTurmasSkeleton() {
  return (
    <div role="status" aria-label="A carregar turmas" className="grid gap-2 sm:grid-cols-2">
      <span className="sr-only">A carregar turmas</span>
      {[0, 1].map((item) => (
        <div
          key={item}
          aria-hidden="true"
          className="rounded-xl border border-border bg-card p-3 shadow-sm motion-safe:animate-pulse sm:p-4"
        >
          <div className="flex min-h-14 items-center gap-3">
            <ProfessorSkeletonBone className="h-9 w-9 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <ProfessorSkeletonBone className="h-4 w-3/5 max-w-52" />
              <ProfessorSkeletonBone className="h-3 w-4/5 max-w-64" />
            </div>
            <ProfessorSkeletonBone className="h-4 w-4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProfessorAgendaSkeleton() {
  return (
    <div role="status" aria-label="A carregar agenda" className="divide-y divide-border">
      <span className="sr-only">A carregar agenda</span>
      {[0, 1, 2].map((item) => (
        <div key={item} aria-hidden="true" className="py-3 first:pt-0 last:pb-0 motion-safe:animate-pulse">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex w-11 shrink-0 justify-center">
              <ProfessorSkeletonBone className="h-3 w-10" />
            </div>
            <div className="h-9 w-px shrink-0 bg-border" />
            <div className="min-w-0 flex-1 space-y-2">
              <ProfessorSkeletonBone className="h-4 w-3/5 max-w-44" />
              <ProfessorSkeletonBone className="h-3 w-4/5 max-w-56" />
            </div>
          </div>
          <div className="mt-1 pl-14">
            <ProfessorSkeletonBone className="h-3 w-32 max-w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProfessorCalendarSkeleton() {
  return (
    <div role="status" aria-label="A carregar calendário académico" className="space-y-4 sm:space-y-6">
      <span className="sr-only">A carregar calendário académico</span>
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section
          aria-hidden="true"
          className="rounded-xl border border-klasse-green-700 bg-klasse-green p-4 text-white shadow-sm motion-safe:animate-pulse sm:rounded-[2rem] sm:p-6"
        >
          <div className="space-y-3 sm:space-y-6">
            <div className="space-y-2">
              <ProfessorSkeletonBone inverse className="h-5 w-44 rounded-full" />
              <ProfessorSkeletonBone inverse className="h-6 w-44 sm:h-7" />
              <ProfessorSkeletonBone inverse className="h-3 w-60 max-w-full" />
            </div>
            <div className="w-full space-y-2 rounded-xl border border-klasse-green-700 bg-klasse-green-700/40 p-3 sm:w-auto sm:rounded-2xl sm:p-4">
              <ProfessorSkeletonBone inverse className="h-3 w-24" />
              <ProfessorSkeletonBone inverse className="h-4 w-3/5 max-w-full" />
              <ProfessorSkeletonBone inverse className="h-3 w-20" />
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="min-w-0 space-y-2 rounded-xl border border-klasse-green-700 bg-klasse-green-700/40 p-2 sm:rounded-2xl sm:p-4">
                  <ProfessorSkeletonBone inverse className="h-3 w-4/5" />
                  <ProfessorSkeletonBone inverse className="h-6 w-9 sm:h-8" />
                </div>
              ))}
            </div>
          </div>
        </section>
        <aside
          aria-hidden="true"
          className="rounded-xl border border-border bg-card p-3 shadow-sm motion-safe:animate-pulse sm:rounded-[2rem] sm:p-6"
        >
          <div className="flex items-center gap-2">
            <ProfessorSkeletonBone className="h-5 w-5 rounded-full" />
            <div className="space-y-1">
              <ProfessorSkeletonBone className="h-2.5 w-20" />
              <ProfessorSkeletonBone className="h-4 w-28" />
            </div>
            <ProfessorSkeletonBone className="ml-auto h-10 w-24 rounded-xl lg:hidden" />
          </div>
          <div className="mt-6 hidden space-y-3 lg:block">
            {[0, 1, 2].map((item) => (
              <div key={item} className="space-y-2 rounded-xl border border-border bg-muted p-4">
                <ProfessorSkeletonBone className="h-4 w-1/2" />
                <ProfessorSkeletonBone className="h-3 w-4/5" />
              </div>
            ))}
          </div>
        </aside>
      </div>
      <section
        aria-hidden="true"
        className="rounded-xl border border-border bg-card p-3 shadow-sm sm:rounded-[2rem] sm:p-6"
      >
        <div className="space-y-1">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">Linha do tempo</p>
          <h2 className="text-lg font-bold text-foreground sm:text-xl sm:font-black">Calendário do professor</h2>
        </div>
        <div className="mt-4 space-y-3 motion-safe:animate-pulse sm:mt-8">
          <ProfessorSkeletonBone className="mx-auto h-3 w-36" />
          <div className="grid gap-2 sm:gap-4 lg:grid-cols-2">
            {[0, 1].map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-xl border border-border bg-muted p-3 sm:rounded-[1.5rem] sm:p-5">
                <div className="flex w-14 shrink-0 flex-col items-center gap-1 rounded-xl border border-border bg-card px-2 py-2">
                  <ProfessorSkeletonBone className="h-5 w-7" />
                  <ProfessorSkeletonBone className="h-2.5 w-7" />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex gap-2">
                    <ProfessorSkeletonBone className="h-5 w-20 rounded-full" />
                    <ProfessorSkeletonBone className="h-5 w-16 rounded-full" />
                  </div>
                  <ProfessorSkeletonBone className="h-4 w-4/5" />
                  <ProfessorSkeletonBone className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/** Espelha o formulário e a lista de planos, sem exibir controlos incompletos. */
function LessonPlanFieldSkeleton({ multiline = false }: { multiline?: boolean }) {
  return (
    <div className="space-y-1.5">
      <ProfessorSkeletonBone className="h-3 w-20" />
      <ProfessorSkeletonBone className={`w-full rounded-xl ${multiline ? "h-24" : "h-11"}`} />
    </div>
  );
}

export function ProfessorLessonPlansSkeleton() {
  return (
    <div role="status" aria-label="A carregar planos de aula" className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
      <span className="sr-only">A carregar planos de aula</span>
      <section aria-hidden="true" className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center gap-3 motion-safe:animate-pulse">
          <ProfessorSkeletonBone className="h-5 w-5" />
          <div className="space-y-2">
            <ProfessorSkeletonBone className="h-4 w-28" />
            <ProfessorSkeletonBone className="h-3 w-48 max-w-full" />
          </div>
        </div>
        <div className="space-y-4 motion-safe:animate-pulse">
          <div className="grid gap-4 sm:grid-cols-2">
            <LessonPlanFieldSkeleton />
            <LessonPlanFieldSkeleton />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <LessonPlanFieldSkeleton />
            <LessonPlanFieldSkeleton />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 9 }, (_, index) => (
              <LessonPlanFieldSkeleton key={index} multiline />
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <LessonPlanFieldSkeleton multiline />
            <LessonPlanFieldSkeleton />
          </div>
          <div className="flex flex-wrap gap-3 pt-1">
            <ProfessorSkeletonBone className="h-11 w-40 rounded-xl" />
            <ProfessorSkeletonBone className="h-11 w-44 rounded-xl" />
          </div>
        </div>
      </section>
      <section aria-hidden="true" className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="space-y-2 motion-safe:animate-pulse">
          <ProfessorSkeletonBone className="h-5 w-36" />
          <ProfessorSkeletonBone className="h-3 w-56 max-w-full" />
        </div>
        <div className="mt-4 space-y-3">
          {[0, 1].map((index) => (
            <div key={index} className="rounded-xl border border-border p-4 motion-safe:animate-pulse">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-2">
                  <ProfessorSkeletonBone className="h-4 w-3/4" />
                  <ProfessorSkeletonBone className="h-3 w-24" />
                </div>
                <ProfessorSkeletonBone className="h-5 w-20 rounded-full" />
              </div>
              <ProfessorSkeletonBone className="mt-3 h-3 w-5/6" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

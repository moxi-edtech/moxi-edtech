export default function Page() {
  return (
    <main className="flex min-h-[60dvh] items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-3 rounded-xl border border-border bg-card p-5 text-center">
        <h1 className="text-xl font-semibold text-primary">Portal do Aluno indisponível</h1>
        <p className="text-sm text-muted-foreground mt-2">
          O Portal do Aluno está desactivado para a tua escola.
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Em caso de dúvidas, contacta a secretaria da escola.
        </p>
      </div>
    </main>
  )
}

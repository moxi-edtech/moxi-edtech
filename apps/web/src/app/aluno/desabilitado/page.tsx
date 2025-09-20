export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow p-8 max-w-md w-full text-center">
        <h1 className="text-xl font-semibold text-gray-800">Portal do Aluno indisponível</h1>
        <p className="text-sm text-gray-600 mt-2">
          O Portal do Aluno não está habilitado para sua escola no plano atual.
        </p>
        <p className="text-sm text-gray-600 mt-1">
          Em caso de dúvidas, entre em contato com a secretaria da sua escola.
        </p>
      </div>
    </main>
  )
}


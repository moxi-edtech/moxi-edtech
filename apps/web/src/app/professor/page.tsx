export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-yellow-100">
      <div className="bg-white rounded-xl shadow p-6 text-center">
        <h1 className="text-2xl font-bold text-yellow-700">🧑‍🏫 Portal do Professor</h1>
        <p className="text-sm text-gray-600 mt-2">Explore os fluxos do processo acadêmico.</p>
        <a href="/professor/fluxos" className="inline-block mt-3 px-3 py-1.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded">Ver Fluxo Acadêmico</a>
      </div>
    </div>
  );
}

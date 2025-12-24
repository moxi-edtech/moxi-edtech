export default function Sidebar() {
  return (
    <div className="bg-slate-950 text-slate-100 h-screen w-64 p-4">
      <h1 className="text-2xl font-bold mb-6">KLASSE</h1>
      <ul>
        <li className="mb-2">
          <a href="#" className="block p-2 rounded-lg hover:bg-slate-900/70">Dashboard</a>
        </li>
        <li className="mb-2">
          <a href="#" className="block p-2 rounded-lg hover:bg-slate-900/70">Alunos</a>
        </li>
        <li className="mb-2">
          <a href="#" className="block p-2 rounded-lg hover:bg-slate-900/70">Matrículas</a>
        </li>
      </ul>
    </div>
  );
}
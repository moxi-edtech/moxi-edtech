export default function Sidebar() {
  return (
    <div className="bg-klasse-dark text-white/90 h-screen w-64 p-4">
      <h1 className="text-2xl font-bold mb-6">KLASSE</h1>
      <ul>
        <li className="mb-2">
          <a href="#" className="block p-2 rounded-xl hover:bg-muted-foreground/20">Dashboard</a>
        </li>
        <li className="mb-2">
          <a href="#" className="block p-2 rounded-xl hover:bg-muted-foreground/20">Alunos</a>
        </li>
        <li className="mb-2">
          <a href="#" className="block p-2 rounded-xl hover:bg-muted-foreground/20">Matrículas</a>
        </li>
      </ul>
    </div>
  );
}
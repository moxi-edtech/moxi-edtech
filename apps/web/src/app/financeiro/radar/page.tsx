 
import RadarInadimplenciaActive from '../_components/RadarInadimplenciaActive';

// This is a server component, so we can't use hooks like useParams here directly.
// In a real app, you would get the escolaId from the user's session or route parameters.
// For example, if your route was /escola/[escolaId]/financeiro/radar, you could get it from props.
const RadarPage = () => {
  // Placeholder: Replace with actual logic to get the school ID
  const escolaId = "00000000-0000-0000-0000-000000000000";

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Radar de Inadimplência</h1>
      <p className="mb-4">
        Lista de alunos inadimplentes, ordenados por dias em atraso.
      </p>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <RadarInadimplenciaActive />
      </div>
    </div>
  );
};

export default RadarPage;

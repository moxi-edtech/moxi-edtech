import NovaMentoriaForm from "@/components/mentorias/NovaMentoriaForm";
import { FunnelViewTracker } from "@/components/analytics/FunnelViewTracker";

export const metadata = {
  title: "Lançar Mentoria | KLASSE Formação",
  description: "Crie a sua mentoria ou evento em segundos.",
};

export default function MentorNovaMentoriaPage() {
  return (
    <div className="py-8">
      <FunnelViewTracker event="mentor_nova_mentoria_view" stage="nova_mentoria" source="mentor_mentorias_nova" />
      <NovaMentoriaForm />
    </div>
  );
}

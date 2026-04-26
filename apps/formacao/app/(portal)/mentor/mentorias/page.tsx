import MentoriasPageClient from "@/components/mentorias/MentoriasPageClient";
import { FunnelViewTracker } from "@/components/analytics/FunnelViewTracker";

export default function MentorMentoriasPage() {
  return (
    <>
      <FunnelViewTracker event="mentor_mentorias_view" stage="mentorias" source="mentor_mentorias" />
      <MentoriasPageClient />
    </>
  );
}

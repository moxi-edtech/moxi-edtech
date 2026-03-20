 
import { redirect } from "next/navigation";

// This is a server component, so we can't use hooks like useParams here directly.
// In a real app, you would get the escolaId from the user's session or route parameters.
// For example, if your route was /escola/[escolaId]/financeiro/radar, you could get it from props.
export default function RadarPage() {
  redirect("/financeiro/cobrancas");
}

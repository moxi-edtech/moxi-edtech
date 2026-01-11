import { redirect } from "next/navigation";

export default function SecretariaDashboardRedirect({ params }: { params: { id: string } }) {
  redirect(`/escola/${params.id}/secretaria`);
}

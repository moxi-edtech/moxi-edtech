import { redirect } from "next/navigation";
import { getFormacaoAuthContext } from "@/lib/auth-context";
import PagamentosClient from "./PagamentosClient";

export const dynamic = "force-dynamic";

export default async function PagamentosFormacaoPage() {
  const auth = await getFormacaoAuthContext();
  if (!auth) redirect("/login");

  if (
    ![
      "formando",
      "formacao_financeiro",
      "formacao_admin",
      "super_admin",
      "global_admin",
    ].includes(String(auth.role))
  ) {
    redirect("/forbidden");
  }

  return <PagamentosClient />;
}

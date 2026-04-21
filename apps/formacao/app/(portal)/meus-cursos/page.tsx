import { redirect } from "next/navigation";
import { getFormacaoAuthContext } from "@/lib/auth-context";
import MeusCursosClient from "./MeusCursosClient";

export const dynamic = "force-dynamic";

export default async function MeusCursosPage() {
  const auth = await getFormacaoAuthContext();
  if (!auth) redirect("/login");

  if (!["formando", "super_admin", "global_admin"].includes(String(auth.role))) {
    redirect("/forbidden");
  }

  return <MeusCursosClient />;
}

// apps/web/src/app/super-admin/nova/page.tsx
import { redirect } from "next/navigation";

export default function Page() {
  // Redireciona para a rota correta de criação de escola
  redirect("/super-admin/escolas/nova");
}


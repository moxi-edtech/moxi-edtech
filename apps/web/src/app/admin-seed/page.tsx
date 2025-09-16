import { notFound } from "next/navigation";
import AdminSeedClient from "./AdminSeedClient";

export const dynamic = "force-dynamic";

export default function Page() {
  const enabled =
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_ENABLE_SEED === "1";
  if (!enabled) {
    notFound();
  }
  return <AdminSeedClient />;
}

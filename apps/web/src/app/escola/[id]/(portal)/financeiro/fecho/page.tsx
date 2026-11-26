import { redirect } from "next/navigation";
import { daySchema, todayLuanda } from "@/lib/secretaria/expediente";

export const dynamic = "force-dynamic";

export default async function FechoCaixaPage({ params, searchParams }: { params: Promise<{id:string}>; searchParams: Promise<{date?:string}> }) {
  const {id} = await params;
  const parsed = daySchema.safeParse((await searchParams).date);
  const query = parsed.success && parsed.data <= todayLuanda() ? "?date=" + encodeURIComponent(parsed.data) : "";
  redirect("/escola/" + encodeURIComponent(id) + "/financeiro/fecho-diario" + query);
}

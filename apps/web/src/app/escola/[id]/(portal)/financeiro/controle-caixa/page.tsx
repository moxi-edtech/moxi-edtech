import { redirect } from "next/navigation";
import { daySchema, todayLuanda } from "@/lib/secretaria/expediente";

export const dynamic = "force-dynamic";

export default async function ControleCaixaPage({params,searchParams}: {
  params: Promise<{id:string}>;
  searchParams?: Promise<{vista?:string;date?:string}>;
}) {
  const {id} = await params;
  const query = (await searchParams) ?? {};
  const base = "/escola/" + encodeURIComponent(id) + "/financeiro/";
  const parsed = daySchema.safeParse(query.date);
  const date = parsed.success && parsed.data <= todayLuanda() ? "?date=" + encodeURIComponent(parsed.data) : "";
  redirect(base + (query.vista === "fecho" ? "fecho-diario" + date : "conciliacao"));
}

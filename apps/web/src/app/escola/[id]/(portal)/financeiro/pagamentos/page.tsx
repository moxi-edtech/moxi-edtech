import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type SearchParams = { q?: string; days?: string };

export default async function Page(props: { searchParams?: Promise<SearchParams> }) {
  const searchParams = (await props.searchParams) ?? ({} as SearchParams);
  const q = searchParams.q || "";
  const days = searchParams.days || "30";
  const params = new URLSearchParams({ q, days });
  redirect(`/financeiro/pagamentos?${params.toString()}`);
}

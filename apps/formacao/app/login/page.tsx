import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { detectProductContextFromHostname } from "@moxi/tenant-sdk";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const productContext = detectProductContextFromHostname(host);

  if (productContext === "formacao") {
    redirect("https://app.klasse.ao/login");
  }
  redirect("http://localhost:3000/login");
}

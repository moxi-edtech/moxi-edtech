import { redirect } from "next/navigation";

function resolveAuthLoginUrl() {
  if (process.env.NODE_ENV !== "production") {
    return (process.env.KLASSE_AUTH_LOCAL_URL ?? "http://auth.lvh.me:3000/login").trim();
  }

  const configured = process.env.KLASSE_AUTH_URL?.trim();
  if (!configured) {
    throw new Error("Missing KLASSE_AUTH_URL in production");
  }
  return configured;
}

export default function Page() {
  redirect(resolveAuthLoginUrl());
}

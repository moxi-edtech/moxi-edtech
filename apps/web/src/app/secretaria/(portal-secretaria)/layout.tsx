import SecretariaShell from "@/components/secretaria/SecretariaShell";

export default function SecretariaPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <SecretariaShell>
      {children}
    </SecretariaShell>
  );
}


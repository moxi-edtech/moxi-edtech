import AppShell from "@/components/layout/klasse/AppShell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
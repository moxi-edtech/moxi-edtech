import { HorarioDataProvider } from "@/components/escola/horarios/HorarioDataProvider";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <HorarioDataProvider>{children}</HorarioDataProvider>;
}

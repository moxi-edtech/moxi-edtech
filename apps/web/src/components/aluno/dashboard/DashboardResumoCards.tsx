export default function DashboardResumoCards({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {children}
    </div>
  );
}

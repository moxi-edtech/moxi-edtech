export default function DashboardResumoCards({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid md:grid-cols-3 gap-6">
      {children}
    </div>
  );
}

